import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
const app = initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") }) });
const db = getFirestore(app);
async function main() {
  const comps = await db.collection("competitions").where("slug", "==", "miabe-can-2026").get();
  const cref = comps.docs[0].ref;
  const teams = await cref.collection("comp_teams").get();
  const togo = teams.docs.find(t => t.data().name === "Togo")!;
  console.log("Togo id:", togo.id, "logo:", togo.data().logo_url ? "SET" : "null");
  const home = await cref.collection("comp_matches").where("home_team_id", "==", togo.id).get();
  const away = await cref.collection("comp_matches").where("away_team_id", "==", togo.id).get();
  console.log("Togo matches:", home.size + away.size);
  home.docs.forEach(m => console.log("  H", m.data().home_team_name, "logo=", m.data().home_team_logo ? "SET" : "null"));
  away.docs.forEach(m => console.log("  A", m.data().away_team_name, "logo=", m.data().away_team_logo ? "SET" : "null"));
  process.exit(0);
}
main().catch(e => { console.error("ERR", e.message); process.exit(1); });
