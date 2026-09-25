/**
 * KOPPAFOOT — Remettre les compteurs d'abonnés d'accord avec les abonnements.
 *
 * CE QU'ILS ONT DE FAUX. `users.followers_count`, `users.following_count` et
 * `teams.followers_count` sont tenus par /api/follows, dans la même
 * transaction que le document d'abonnement, et ne peuvent plus dériver. Mais
 * ils ont longtemps été écrits depuis le navigateur, sans garde : un double
 * clic comptait deux fois, un échec à mi-chemin laissait l'abonnement sans son
 * compteur. Constaté en production le 2026-09-25 : ROITELET FC affichait
 * 0 abonné pour 1 abonnement réel.
 *
 * CE QUE FAIT CE SCRIPT. Il recompte depuis la seule source qui ne ment pas —
 * les documents `follows` et `team_follows` — et réécrit les compteurs qui
 * s'en écartent. Les autres ne sont pas touchés.
 *
 * Usage :
 *   npx tsx scripts/recalculer-abonnes.ts          → simulation
 *   npx tsx scripts/recalculer-abonnes.ts --apply  → écrit
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const APPLIQUER = process.argv.includes("--apply");

const compter = (m: Map<string, number>, id: unknown) => {
  if (typeof id !== "string" || !id) return;
  m.set(id, (m.get(id) ?? 0) + 1);
};

async function main() {
  const [users, teams, follows, teamFollows] = await Promise.all([
    db.collection("users").get(),
    db.collection("teams").get(),
    db.collection("follows").get(),
    db.collection("team_follows").get(),
  ]);

  const abonnes = new Map<string, number>();
  const abonnements = new Map<string, number>();
  const abonnesEquipe = new Map<string, number>();
  for (const f of follows.docs) {
    compter(abonnes, f.data().following_id);
    compter(abonnements, f.data().follower_id);
  }
  for (const f of teamFollows.docs) compter(abonnesEquipe, f.data().team_id);

  console.log(
    `${follows.size} abonnement(s) à des comptes, ${teamFollows.size} à des équipes.\n`,
  );

  let batch = db.batch();
  let ops = 0;
  let corriges = 0;
  const ecrire = async (ref: FirebaseFirestore.DocumentReference, data: Record<string, number>) => {
    if (!APPLIQUER) return;
    batch.update(ref, data);
    if ((ops += 1) >= 400) { await batch.commit(); batch = db.batch(); ops = 0; }
  };

  for (const u of users.docs) {
    const d = u.data();
    const vrai = { abonnes: abonnes.get(u.id) ?? 0, abonnements: abonnements.get(u.id) ?? 0 };
    const avant = { abonnes: d.followers_count ?? 0, abonnements: d.following_count ?? 0 };
    if (avant.abonnes === vrai.abonnes && avant.abonnements === vrai.abonnements) continue;
    corriges += 1;
    console.log(
      `  compte ${`${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || u.id}` +
      `\n      avant : ${avant.abonnes} abonné(s), ${avant.abonnements} abonnement(s)` +
      `\n      après : ${vrai.abonnes} abonné(s), ${vrai.abonnements} abonnement(s)`,
    );
    await ecrire(u.ref, { followers_count: vrai.abonnes, following_count: vrai.abonnements });
  }

  for (const t of teams.docs) {
    const d = t.data();
    const vrai = abonnesEquipe.get(t.id) ?? 0;
    const avant = d.followers_count ?? 0;
    if (avant === vrai) continue;
    corriges += 1;
    console.log(`  équipe ${d.name ?? t.id}\n      avant : ${avant} abonné(s)\n      après : ${vrai} abonné(s)`);
    await ecrire(t.ref, { followers_count: vrai });
  }

  if (APPLIQUER && ops > 0) await batch.commit();

  console.log(
    `\n${corriges} document(s) ` +
    (APPLIQUER ? "corrigé(s)." : "seraient corrigé(s). Relancer avec --apply pour écrire."),
  );
  process.exit(0);
}

main().catch((e) => { console.error("ERR", e); process.exit(1); });
