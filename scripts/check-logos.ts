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
  console.log("competitions:", comps.size);
  for (const c of comps.docs) {
    const teams = await c.ref.collection("comp_teams").get();
    const withLogo = teams.docs.filter((t) => t.data().logo_url);
    console.log(`${c.data().slug} | teams: ${teams.size} | with logo: ${withLogo.length}`);
    withLogo.slice(0, 3).forEach((t) =>
      console.log("   ", t.data().name, "->", String(t.data().logo_url).slice(0, 70)),
    );
    // sample a match's denormalized logos
    const matches = await c.ref.collection("comp_matches").limit(1).get();
    if (!matches.empty) {
      const m = matches.docs[0].data();
      console.log(`   sample match: ${m.home_team_name} logo=${m.home_team_logo ? "SET" : "null"} / ${m.away_team_name} logo=${m.away_team_logo ? "SET" : "null"}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
