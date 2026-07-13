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
  const target = comps.docs.find((c) => (c.data().name ?? "").toLowerCase().includes("coupe 2"));
  if (!target) {
    console.log("Compétitions trouvées:", comps.docs.map((c) => c.data().name).join(" | "));
    console.log("❌ Aucune compétition 'Coupe 2'");
    process.exit(1);
  }
  const cref = target.ref;
  console.log("Coupe 2 id:", cref.id, "| status:", target.data().status, "| format:", JSON.stringify(target.data().format));

  const teams = await cref.collection("comp_teams").get();
  console.log(`\nÉquipes (${teams.size}):`);
  const byGroup = new Map<string, string[]>();
  for (const t of teams.docs) {
    const d = t.data();
    const g = d.group ?? "—";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(`${d.name} [${(d.players ?? []).length}j]`);
  }
  for (const [g, list] of [...byGroup.entries()].sort()) {
    console.log(`  Poule ${g}: ${list.join(", ")}`);
  }

  const matches = await cref.collection("comp_matches").get();
  const group = matches.docs.filter((m) => m.data().stage === "group");
  const played = group.filter((m) => m.data().status === "completed");
  console.log(`\nMatchs: ${matches.size} total | ${group.length} de poule | ${played.length} déjà joués`);
  const perGroup = new Map<string, number>();
  for (const m of group) {
    const g = m.data().group ?? "—";
    perGroup.set(g, (perGroup.get(g) ?? 0) + 1);
  }
  console.log("  Par poule:", [...perGroup.entries()].sort().map(([g, n]) => `${g}:${n}`).join(" "));
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
