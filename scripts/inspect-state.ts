/**
 * KOPPAFOOT — Read-only snapshot of competitions and clubs.
 * Used to pick the actors for an end-to-end registration test.
 *
 * Usage: npx tsx scripts/inspect-state.ts
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
  console.log("=== COMPÉTITIONS ===");
  for (const d of comps.docs) {
    const c = d.data();
    if (c.is_sandbox) continue;
    const teams = await d.ref.collection("comp_teams").get();
    console.log(
      `  ${d.id} | ${c.name} | statut=${c.status} | type=${c.competition_type ?? "?"} | équipes=${teams.size} | orga=${(c.organizer_ids ?? []).join(",")}`,
    );
  }

  console.log("\n=== CLUBS ===");
  const clubs = await db.collection("teams").get();
  for (const d of clubs.docs) {
    const t = d.data();
    const ghosts = await d.ref.collection("ghost_players").get();
    console.log(
      `  ${d.id} | ${t.name} | manager=${t.manager_id} | membres=${(t.member_ids ?? []).length} | fantômes=${ghosts.size}`,
    );
  }

  console.log("\n=== INSCRIPTIONS ===");
  const regs = await db.collection("competition_registrations").get();
  if (regs.empty) console.log("  (aucune)");
  for (const d of regs.docs) {
    const r = d.data();
    console.log(`  ${d.id} | ${r.club_name} → ${r.competition_name} | ${r.status}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL", e);
    process.exit(1);
  });
