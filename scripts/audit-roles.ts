/**
 * KOPPAFOOT — L'état des rôles et des casquettes, compte par compte.
 *
 * Sert à préparer et à contrôler la bascule vers le modèle
 * `user_type ∈ {user, player, manager, referee}` + casquettes en drapeaux.
 *
 * Il ne LIT que ce qui sert à décider : nom, type, rôle activé, drapeaux, et
 * les traces de jeu (équipe, poste, matchs). Ni email, ni téléphone, ni
 * jeton n'en sortent — ce script se lance à la main et son résultat se colle
 * dans une conversation, il n'a pas à porter des coordonnées.
 *
 * Lecture seule. La bascule elle-même est dans `migrate-user-type.ts`.
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

async function main() {
  const { adminDb } = await import("../src/lib/firebase-admin");
  const snap = await adminDb.collection("users").get();

  const lignes = snap.docs.map((d) => {
    const x = d.data() as Record<string, unknown>;
    const casquettes = [
      x.is_superadmin === true || x.user_type === "superadmin" ? "admin" : null,
      x.is_organizer === true || x.user_type === "organizer" ? "organisateur" : null,
      x.is_venue_owner === true || x.user_type === "venue_owner" ? "terrain" : null,
      x.is_scorer === true ? "scoreur" : null,
    ].filter(Boolean);

    // Les traces de jeu : ce qui interdit de déclasser un compte en `user`.
    const traces = [
      s(x.position) ? "poste" : null,
      s(x.team_name) ? "equipe" : null,
      typeof x.matches_played === "number" && x.matches_played > 0 ? `${x.matches_played} matchs` : null,
      typeof x.goals === "number" && x.goals > 0 ? `${x.goals} buts` : null,
      s(x.license_level) || s(x.license_number) ? "licence" : null,
    ].filter(Boolean);

    return {
      uid: d.id,
      nom: `${s(x.first_name) ?? ""} ${s(x.last_name) ?? ""}`.trim() || "(sans nom)",
      user_type: s(x.user_type) ?? "(vide)",
      evolution_role: s(x.evolution_role) ?? "—",
      casquettes: casquettes.join("+") || "—",
      traces: traces.join(", ") || "—",
      actif: x.is_active !== false,
    };
  });

  lignes.sort((a, b) =>
    a.evolution_role.localeCompare(b.evolution_role) || a.user_type.localeCompare(b.user_type),
  );

  const col = (v: string, n: number) => v.padEnd(n).slice(0, n);
  console.log(
    col("NOM", 24), col("user_type", 12), col("evolution", 10), col("casquettes", 22), "TRACES DE JEU",
  );
  console.log("-".repeat(110));
  for (const l of lignes) {
    console.log(
      col(l.nom + (l.actif ? "" : " (inactif)"), 24),
      col(l.user_type, 12),
      col(l.evolution_role, 10),
      col(l.casquettes, 22),
      l.traces,
    );
  }

  // Ce que la bascule ferait, sans rien écrire.
  const aRole = (l: (typeof lignes)[number]) => l.evolution_role !== "—";
  const typeEstRole = (l: (typeof lignes)[number]) =>
    ["player", "manager", "referee"].includes(l.user_type);

  const versUser = lignes.filter((l) => !aRole(l) && l.traces === "—");
  const aGarder = lignes.filter((l) => !aRole(l) && l.traces !== "—" && typeEstRole(l));

  console.log("\n" + "=".repeat(110));
  console.log(`comptes : ${lignes.length}`);
  console.log(`-> passeraient à user_type "user" (aucun rôle activé, aucune trace de jeu) : ${versUser.length}`);
  versUser.forEach((l) => console.log(`     ${l.nom} — ${l.user_type} / casquettes ${l.casquettes}`));
  console.log(`-> rôle HÉRITÉ à conserver (pas d'evolution_role mais des traces) : ${aGarder.length}`);
  aGarder.forEach((l) => console.log(`     ${l.nom} — ${l.user_type} — ${l.traces}`));
  process.exit(0);
}

main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});
