/**
 * KOPPAFOOT — Inspect a user's role by uid or email (dev/ops helper).
 * Usage: npx tsx scripts/check-user.ts <uid-or-email>
 */
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const target = process.argv[2];
if (!target) {
  console.error("Usage: npx tsx scripts/check-user.ts <uid-or-email>");
  process.exit(1);
}

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
  const db = getFirestore(app);

  let uid = target;
  if (target.includes("@")) {
    uid = (await getAuth(app).getUserByEmail(target)).uid;
  }
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    console.log(`Aucun profil Firestore pour ${uid}`);
    process.exit(1);
  }
  const x = snap.data()!;
  console.log(
    [
      uid,
      `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim(),
      x.email ?? x.phone ?? "—",
      `user_type: ${x.user_type}`,
      x.is_active === false ? "INACTIF" : "actif",
    ].join(" | "),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
