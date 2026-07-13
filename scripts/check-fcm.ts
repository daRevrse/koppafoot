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
  const users = await db.collection("users").get();
  let withTokens = 0;
  let totalTokens = 0;
  let followers = 0;
  for (const u of users.docs) {
    const d = u.data();
    const toks = d.fcm_tokens ?? [];
    if (toks.length > 0) { withTokens += 1; totalTokens += toks.length; }
    if ((d.followed_competition_ids ?? []).length > 0) followers += 1;
  }
  console.log(`Utilisateurs: ${users.size}`);
  console.log(`Avec token FCM: ${withTokens} (total ${totalTokens} tokens)`);
  console.log(`Suivent ≥1 compétition: ${followers}`);
  process.exit(0);
}

main().catch((e) => { console.error("ERR", e.message); process.exit(1); });
