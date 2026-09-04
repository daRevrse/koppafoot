/**
 * KOPPAFOOT — Bascule vers `user_type ∈ {user, player, manager, referee}`.
 *
 * CE QUE LE MODÈLE CORRIGE. `user_type` mélangeait deux questions : ce qu'on
 * EST sur le terrain, et ce qu'on FAIT autour. Un compte né « player » sans
 * avoir jamais choisi de l'être, un organisateur dont le type écrasait son
 * rôle de joueur, une révocation qui reposait quelqu'un en « player » faute
 * de valeur neutre — trois symptômes d'un même champ qui portait deux sens.
 *
 * DEUX PASSES, ET L'ORDRE COMPTE.
 *
 *   --flags   pose is_superadmin / is_organizer / is_venue_owner sur les
 *             comptes dont seul le `user_type` hérité les portait. Purement
 *             ADDITIF : rien ne perd d'accès, tout continue de lire les deux
 *             signaux. C'est le filet qui rend la seconde passe sûre.
 *
 *   --types   réécrit `user_type` :
 *               - un rôle activé dans Évolution fait foi      -> ce rôle
 *               - sinon, des traces de jeu : rôle hérité      -> inchangé
 *               - sinon                                        -> "user"
 *
 * LANCER --flags EN PREMIER, ET VÉRIFIER. Passer un superadmin à « user »
 * sans lui avoir posé `is_superadmin` ferme /admin et toutes les routes
 * d'administration, y compris celle qui servirait à réparer.
 *
 * `--dry` n'écrit rien et montre le plan. C'est le mode par défaut.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);

/** Ce qui interdit de déclasser un compte en simple « user ». */
function aDesTracesDeJeu(x: Record<string, unknown>): string[] {
  return [
    s(x.position) ? "poste" : null,
    s(x.team_name) ? "équipe" : null,
    n(x.matches_played) > 0 ? `${n(x.matches_played)} matchs` : null,
    n(x.goals) > 0 ? `${n(x.goals)} buts` : null,
    s(x.license_level) || s(x.license_number) ? "licence" : null,
  ].filter((v): v is string => Boolean(v));
}

const ROLES = ["player", "manager", "referee"];

async function main() {
  const args = process.argv.slice(2);
  const phase = args.includes("--types") ? "types" : "flags";
  const ecrire = args.includes("--write");

  const { adminDb } = await import("../src/lib/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const snap = await adminDb.collection("users").get();

  const plan: { uid: string; nom: string; avant: string; apres: string; maj: Record<string, unknown> }[] = [];

  snap.docs.forEach((d) => {
    const x = d.data() as Record<string, unknown>;
    const nom = `${s(x.first_name) ?? ""} ${s(x.last_name) ?? ""}`.trim() || "(sans nom)";
    const type = s(x.user_type);
    const role = s(x.evolution_role);
    const maj: Record<string, unknown> = {};

    if (phase === "flags") {
      // Le drapeau ne se pose que s'il MANQUE et que le type hérité le porte.
      if (type === "superadmin" && x.is_superadmin !== true) maj.is_superadmin = true;
      if (type === "organizer" && x.is_organizer !== true) maj.is_organizer = true;
      if (type === "venue_owner" && x.is_venue_owner !== true) maj.is_venue_owner = true;
      if (Object.keys(maj).length) {
        plan.push({ uid: d.id, nom, avant: `type=${type}`, apres: Object.keys(maj).join(", "), maj });
      }
      return;
    }

    // --- phase "types" ------------------------------------------------------
    let cible: string;
    let motif: string;

    if (role && ROLES.includes(role)) {
      cible = role;
      motif = "rôle activé dans Évolution";
    } else {
      const traces = aDesTracesDeJeu(x);
      if (type && ROLES.includes(type) && traces.length) {
        cible = type;
        motif = `rôle hérité, conservé (${traces.join(", ")})`;
      } else {
        cible = "user";
        motif = traces.length ? `aucun rôle activé (${traces.join(", ")})` : "aucun rôle, aucune trace";
      }
    }

    if (cible !== type) {
      maj.user_type = cible;
      maj.updated_at = FieldValue.serverTimestamp();
      plan.push({ uid: d.id, nom, avant: type ?? "(vide)", apres: `${cible} — ${motif}`, maj });
    }
  });

  console.log(`\nPASSE « ${phase} » — ${ecrire ? "ÉCRITURE" : "SIMULATION (ajoute --write pour écrire)"}`);
  console.log("=".repeat(96));
  if (!plan.length) {
    console.log("Rien à faire : tous les comptes sont déjà dans l'état attendu.");
    process.exit(0);
  }
  plan.forEach((p) => console.log(`  ${p.nom.padEnd(26).slice(0, 26)} ${p.avant.padEnd(14)} -> ${p.apres}`));
  console.log("=".repeat(96));
  console.log(`${plan.length} compte(s) concerné(s).`);

  if (!ecrire) {
    console.log("\nRien n'a été écrit.");
    process.exit(0);
  }

  // Un lot par tranche de 400 : la limite d'un batch Firestore est 500.
  for (let i = 0; i < plan.length; i += 400) {
    const lot = adminDb.batch();
    plan.slice(i, i + 400).forEach((p) => lot.update(adminDb.collection("users").doc(p.uid), p.maj));
    await lot.commit();
  }
  console.log(`\n${plan.length} compte(s) mis à jour.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e).slice(0, 500));
  process.exit(1);
});
