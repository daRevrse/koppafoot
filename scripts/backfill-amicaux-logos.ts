/**
 * KOPPAFOOT — Recopier l'écusson des équipes sur les matchs amicaux.
 *
 * Le jumeau de `backfill-match-logos.ts`, qui fait la même chose pour les
 * matchs de compétition. Un amical ne portait aucun blason jusqu'ici (voir
 * `FirestoreMatch.home_team_logo`) : le Direct et la fiche du match
 * affichaient deux initiales grises pour des clubs qui ont pourtant un logo.
 * Les matchs créés depuis le posent eux-mêmes ; ceux d'avant ont besoin de ce
 * passage.
 *
 * Il resynchronise AUSSI les matchs déjà pourvus : un club qui change d'écusson
 * ne le change pas sur ses matchs passés, c'est le prix de la copie.
 *
 * Une équipe hors plateforme n'a pas de fiche, donc pas de logo : sa moitié du
 * match reste vide, et c'est la vérité sur elle.
 *
 * Usage :
 *   npx tsx scripts/backfill-amicaux-logos.ts          → simulation, n'écrit rien
 *   npx tsx scripts/backfill-amicaux-logos.ts --apply  → écrit
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const APPLIQUER = process.argv.includes("--apply");

async function main() {
  const matchs = await db.collection("matches").get();

  // Les équipes citées par au moins un match, lues une seule fois chacune.
  const idsEquipes = new Set<string>();
  for (const m of matchs.docs) {
    for (const cle of ["home_team_id", "away_team_id"]) {
      const id = m.data()[cle];
      if (typeof id === "string" && id) idsEquipes.add(id);
    }
  }

  const logos = new Map<string, string | null>();
  await Promise.all(
    [...idsEquipes].map(async (id) => {
      const snap = await db.collection("teams").doc(id).get();
      logos.set(id, snap.exists ? ((snap.data()?.logo_url as string) ?? null) : null);
    }),
  );

  let batch = db.batch();
  let ops = 0;
  let aCorriger = 0;
  let sansEquipe = 0;

  for (const m of matchs.docs) {
    const d = m.data();
    const patch: Record<string, unknown> = {};

    for (const [cleId, cleLogo] of [
      ["home_team_id", "home_team_logo"],
      ["away_team_id", "away_team_logo"],
    ] as const) {
      const id = typeof d[cleId] === "string" ? (d[cleId] as string) : "";
      // Pas d'identifiant : adversaire hors plateforme, rien à recopier.
      if (!id) { sansEquipe += 1; continue; }
      const attendu = logos.get(id) ?? null;
      if ((d[cleLogo] ?? null) !== attendu) patch[cleLogo] = attendu;
    }

    if (Object.keys(patch).length === 0) continue;
    aCorriger += 1;
    console.log(
      `  ${m.id}  ${d.home_team_name} – ${d.away_team_name}  →  ${Object.keys(patch).join(", ")}`,
    );

    if (!APPLIQUER) continue;
    batch.update(m.ref, patch);
    ops += 1;
    if (ops >= 400) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  if (APPLIQUER && ops > 0) await batch.commit();

  console.log(
    `\n${matchs.size} match(s) lus, ${idsEquipes.size} équipe(s) consultée(s), ` +
    `${sansEquipe} camp(s) hors plateforme ignoré(s).`,
  );
  console.log(
    APPLIQUER
      ? `✅ ${aCorriger} match(s) mis à jour.`
      : `ℹ️  ${aCorriger} match(s) seraient mis à jour. Relancer avec --apply pour écrire.`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
