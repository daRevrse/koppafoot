/**
 * KOPPAFOOT — Backfill denormalised team name/logo onto comp_matches.
 *
 * Match docs snapshot home/away_team_name + logo at creation time. Logos
 * uploaded to a team afterwards don't reach matches created earlier. This
 * one-shot script re-syncs every match from its teams' current docs.
 *
 * Usage: npx tsx scripts/backfill-match-logos.ts
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

async function main() {
  const comps = await db.collection("competitions").get();
  let totalUpdated = 0;

  for (const c of comps.docs) {
    const teamsSnap = await c.ref.collection("comp_teams").get();
    const byId = new Map(
      teamsSnap.docs.map((t) => [t.id, { name: t.data().name as string, logo: (t.data().logo_url as string) ?? null }]),
    );

    const matchesSnap = await c.ref.collection("comp_matches").get();
    let batch = db.batch();
    let ops = 0;
    let updated = 0;

    for (const m of matchesSnap.docs) {
      const d = m.data();
      const home = byId.get(d.home_team_id);
      const away = byId.get(d.away_team_id);
      const patch: Record<string, unknown> = {};
      if (home) {
        if (d.home_team_name !== home.name) patch.home_team_name = home.name;
        if ((d.home_team_logo ?? null) !== home.logo) patch.home_team_logo = home.logo;
      }
      if (away) {
        if (d.away_team_name !== away.name) patch.away_team_name = away.name;
        if ((d.away_team_logo ?? null) !== away.logo) patch.away_team_logo = away.logo;
      }
      if (Object.keys(patch).length > 0) {
        batch.update(m.ref, patch);
        ops += 1;
        updated += 1;
        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }
    }
    if (ops > 0) await batch.commit();
    console.log(`${c.data().slug}: ${updated} match(es) mis à jour`);
    totalUpdated += updated;
  }

  console.log(`\n✅ Backfill terminé — ${totalUpdated} match(es) synchronisé(s).`);
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
