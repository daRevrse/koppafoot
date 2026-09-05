/**
 * KOPPAFOOT — Clôturer un amical resté ouvert.
 *
 * Sur /matches, un amical « upcoming » ou « live » ne propose que « Déplacer »
 * et « Annuler » : le coup de sifflet final ne se donne que depuis la console
 * live. Un match joué sans console, ou dont personne n'a sifflé la fin, reste
 * donc ouvert indéfiniment — il traîne dans le Direct, et ses statistiques ne
 * partent jamais. Ce script le ferme.
 *
 * IL NE RÉÉCRIT PAS LE SCORE. `score_home` / `score_away` du document font
 * foi, et le résultat W/N/D en découle : un match jamais couvert est donc
 * clôturé sur le 0-0 qu'il porte. Corriger le score AVANT de clôturer, sinon.
 *
 * Le rollup est celui de /api/matches/complete, importé et non recopié (voir
 * src/lib/match-cloture.ts) : bilan des deux clubs, carrières des joueurs et
 * des joueurs sans compte, feuilles de match, verrou anti-double-comptage.
 *
 * Usage:
 *   npx tsx scripts/cloture-match.ts                        # aperçu, n'écrit rien
 *   npx tsx scripts/cloture-match.ts --go                   # clôture
 *   npx tsx scripts/cloture-match.ts aigles eperviers       # deux autres équipes
 *   npx tsx scripts/cloture-match.ts --id <matchId> --go    # un match désigné
 *
 * Sans argument, il cherche « archimede » contre « kopa ». Il affiche toujours
 * ce qu'il a trouvé avant d'écrire, et refuse de clôturer plusieurs matchs
 * d'un coup : s'il en trouve deux, il les liste et attend un --id.
 *
 * À lancer en local avec les identifiants admin de .env.local (contourne les
 * règles de sécurité).
 */

import * as dotenv from "dotenv";
import * as path from "path";
import type { FirestoreMatch } from "@/types";

// Load .env.local from project root — AVANT d'importer firebase-admin, qui
// lit ces variables au chargement du module. D'où les imports dynamiques dans
// main() : un import statique serait évalué avant cette ligne.
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const args = process.argv.slice(2);
const ecrire = args.includes("--go");
const posId = args.indexOf("--id");
const matchIdVoulu = posId >= 0 ? args[posId + 1] : undefined;
// `posId + 1` est la valeur de --id, pas un nom d'équipe. Sans --id, posId
// vaut -1 : ne rien exclure, sinon le premier nom passé à la main disparaît.
const equipes = args.filter((a, i) => !a.startsWith("--") && !(posId >= 0 && i === posId + 1));
const [equipeA = "archimede", equipeB = "kopa"] = equipes;

// `--id` sans identifiant retomberait en silence sur la recherche par nom, et
// clôturerait donc un autre match que celui qu'on désignait.
if (posId >= 0 && (!matchIdVoulu || matchIdVoulu.startsWith("--"))) {
  console.error("\n❌ --id attend un identifiant de match : npx tsx scripts/cloture-match.ts --id <matchId> --go\n");
  process.exit(1);
}

/** « Archimède » et « archimede » sont le même club ; les accents partent. */
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function ligne(id: string, m: FirestoreMatch): string {
  const score = `${m.score_home ?? 0}-${m.score_away ?? 0}`;
  const quand = `${m.date ?? "?"}${m.time ? ` ${m.time}` : ""}`;
  return `  ${id}  ${quand}  ${m.home_team_name} ${score} ${m.away_team_name}  [${m.status}]`;
}

async function main() {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error("\n❌ Identifiants admin absents : renseigne .env.local (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY).\n");
    process.exit(1);
  }

  const { adminDb } = await import("@/lib/firebase-admin");
  const { apercuCloture, cloturerAmical } = await import("@/lib/match-cloture");

  // 1. Retrouver le match.
  let trouves: { id: string; m: FirestoreMatch }[];

  if (matchIdVoulu) {
    const snap = await adminDb.collection("matches").doc(matchIdVoulu).get();
    if (!snap.exists) {
      console.error(`\n❌ Aucun amical d'id "${matchIdVoulu}" dans /matches.\n`);
      process.exit(1);
    }
    trouves = [{ id: snap.id, m: snap.data() as FirestoreMatch }];
  } else {
    console.log(`\n🔍 Amical « ${equipeA} » contre « ${equipeB} »...`);
    const a = fold(equipeA);
    const b = fold(equipeB);
    const snap = await adminDb.collection("matches").get();
    trouves = snap.docs
      .map((d) => ({ id: d.id, m: d.data() as FirestoreMatch }))
      .filter(({ m }) => {
        const dom = fold(m.home_team_name ?? "");
        const ext = fold(m.away_team_name ?? "");
        // Peu importe qui reçoit : on cherche la rencontre, pas l'affiche.
        return (dom.includes(a) && ext.includes(b)) || (dom.includes(b) && ext.includes(a));
      });
  }

  if (trouves.length === 0) {
    console.error(`\n❌ Rien trouvé. Vérifie l'orthographe, ou passe --id <matchId>.\n`);
    process.exit(1);
  }

  if (trouves.length > 1) {
    console.error(`\n⚠️  ${trouves.length} matchs correspondent — je n'en clôture pas plusieurs à l'aveugle :\n`);
    trouves.forEach(({ id, m }) => console.error(ligne(id, m)));
    console.error(`\n   Relance avec: npx tsx scripts/cloture-match.ts --id <matchId> --go\n`);
    process.exit(1);
  }

  const { id, m } = trouves[0];
  console.log(`\n📋 Match trouvé :\n${ligne(id, m)}`);

  if (m.status === "completed") {
    console.log(`\n✅ Déjà terminé — rien à faire. (Le rollup ne se repasse pas : il incrémente des compteurs.)\n`);
    return;
  }

  // 2. Annoncer ce que la clôture va faire, avec le calcul qui l'écrira.
  const vue = apercuCloture(m);
  const vainqueur =
    vue.result === "draw"
      ? "match nul"
      : `victoire de ${vue.result === "win" ? m.home_team_name : m.away_team_name}`;

  const parts = await adminDb.collection("participations").where("match_id", "==", id).get();
  const confirmes = parts.docs.filter((d) => (d.data() as { status?: string }).status === "confirmed").length;
  const sansCompte =
    (Array.isArray(m.home_ghost_lineup) ? m.home_ghost_lineup.length : 0) +
    (Array.isArray(m.away_ghost_lineup) ? m.away_ghost_lineup.length : 0);

  console.log(`\n📊 Ce que la clôture écrit :`);
  console.log(`   • score retenu    ${m.score_home ?? 0}-${m.score_away ?? 0} → ${vainqueur}`);
  console.log(`   • couvert en direct : ${vue.couvertEnDirect ? "oui" : "non"}`);
  console.log(`   • adversaire hors plateforme : ${vue.horsPlateforme ? "oui (il ne cumule rien)" : "non"}`);
  console.log(`   • bilan des clubs : ${vue.horsPlateforme ? "1 club" : "2 clubs"} (+1 match, +1 V/N/D)`);
  console.log(
    vue.crediterLesJoueurs
      ? `   • carrières créditées : ${confirmes} joueur(s) confirmé(s), ${sansCompte} ligne(s) sans compte`
      : `   • carrières NON créditées (match non couvert en direct) — voir /api/matches/credit-stats`,
  );
  console.log(`   • feuilles de match : ${confirmes} participation(s) mise(s) à jour`);

  if (!ecrire) {
    console.log(`\n👀 Aperçu seulement, rien n'a été écrit.`);
    console.log(`   Pour clôturer : npx tsx scripts/cloture-match.ts --id ${id} --go\n`);
    return;
  }

  // 3. Siffler.
  const res = await cloturerAmical(id, m, "script:cloture-match");
  if (!res.ok) {
    console.log(`\n✅ Déjà terminé entre-temps — rien n'a été écrit deux fois.\n`);
    return;
  }

  console.log(`\n🏁 Match clôturé — résultat « ${res.result} » côté ${m.home_team_name}.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Échec :", err);
    process.exit(1);
  });
