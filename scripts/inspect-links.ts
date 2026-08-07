/**
 * KOPPAFOOT — Read-only: a competition team's roster and the link rows it
 * produced on each player's own document. Used to confirm that /stats has
 * something well-formed to read.
 *
 * Usage: npx tsx scripts/inspect-links.ts <competitionId> <compTeamId>
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

const [cid, teamId] = process.argv.slice(2);

async function main() {
  if (!cid || !teamId) {
    console.error("Usage: npx tsx scripts/inspect-links.ts <competitionId> <compTeamId>");
    process.exit(1);
  }

  const t = await db
    .collection("competitions").doc(cid)
    .collection("comp_teams").doc(teamId)
    .get();
  if (!t.exists) throw new Error("Équipe introuvable");

  const players = (t.data()?.players ?? []) as {
    id: string; name: string; number: string; position?: string; user_id?: string | null;
  }[];

  console.log(`\n=== EFFECTIF « ${t.data()?.name} » ===`);
  for (const p of players) {
    console.log(
      `  ${p.id.padEnd(28)} ${p.name.padEnd(22)} n°${(p.number || "-").padEnd(4)} ${p.position ?? "-"}  compte=${p.user_id ?? "aucun"}`,
    );
  }

  for (const p of players.filter((x) => x.user_id)) {
    const u = await db.collection("users").doc(p.user_id!).get();
    const d = u.data();
    console.log(`\n=== LIGNES CHEZ ${d?.first_name ?? ""} ${d?.last_name ?? ""} ===`);
    for (const l of (d?.linked_comp_players ?? []) as Record<string, string>[]) {
      console.log(`  compétition : ${l.competition_name} (slug=${l.competition_slug})`);
      console.log(`  équipe      : ${l.team_name} (${l.team_id})`);
      console.log(`  joueur      : ${l.player_name} (${l.player_id})`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL", e.message);
    process.exit(1);
  });
