/**
 * KOPPAFOOT — Promote a user to superadmin by email.
 *
 * Usage:
 *   npx tsx scripts/promote-superadmin.ts <email>
 *
 * This script uses firebase-admin to find a user by email and gives them
 * the administrator hat: `is_superadmin: true`.
 *
 * LE DRAPEAU, PAS LE TYPE. Ce script écrivait `user_type: "superadmin"`,
 * c'est-à-dire dans le champ du RÔLE : il effaçait ce que la personne était
 * sur le terrain, et posait un signal que le modèle actuel n'écrit plus (voir
 * lib/hats et scripts/migrate-user-type.ts). Le rôle n'est plus touché.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });

const email = process.argv[2];
if (!email) {
  console.error("\n❌ Usage: npx tsx scripts/promote-superadmin.ts <email>\n");
  process.exit(1);
}

async function main() {
  // Init Firebase Admin
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`\n🔍 Recherche de l'utilisateur: ${email}...`);

  // 1. Find user in Firebase Auth
  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌ Aucun compte Firebase Auth trouvé pour "${email}".`);
    console.error(`   L'utilisateur doit d'abord créer un compte sur la plateforme.`);
    process.exit(1);
  }

  console.log(`✅ Utilisateur trouvé: ${userRecord.uid} (${userRecord.displayName ?? "sans nom"})`);

  // 2. Check Firestore profile
  const userDoc = await db.collection("users").doc(userRecord.uid).get();
  if (!userDoc.exists) {
    console.error(`❌ Aucun profil Firestore pour cet utilisateur.`);
    console.error(`   L'utilisateur doit d'abord compléter l'inscription (onboarding).`);
    process.exit(1);
  }

  const data = userDoc.data() ?? {};
  if (data.is_superadmin === true) {
    console.log(`ℹ️  L'utilisateur est déjà superadmin. Rien à faire.`);
    process.exit(0);
  }

  console.log(`📋 Rôle actuel: ${data.evolution_role ?? data.user_type ?? "aucun"} (inchangé)`);

  // 3. Promote to superadmin: the hat, the role stays what it is.
  await db.collection("users").doc(userRecord.uid).update({
    is_superadmin: true,
    updated_at: FieldValue.serverTimestamp(),
  });

  console.log(`\n🎉 Succès! ${email} a été promu superadmin.`);
  console.log(`   Il peut maintenant accéder à /admin après reconnexion.\n`);

  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Erreur:", err.message);
  process.exit(1);
});
