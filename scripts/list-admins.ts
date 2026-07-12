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

async function main() {
  const snap = await db.collection("users").where("user_type", "==", "superadmin").get();
  console.log(`SUPERADMINS: ${snap.size}`);
  for (const d of snap.docs) {
    const x = d.data();
    console.log(
      [
        d.id,
        `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim() || "(sans nom)",
        x.email ?? x.phone ?? "—",
        x.is_active === false ? "INACTIF" : "actif",
        x.location_city ?? "",
      ].join(" | "),
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("Erreur:", e.message);
  process.exit(1);
});
