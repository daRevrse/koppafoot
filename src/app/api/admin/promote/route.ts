import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is a superadmin via session cookie or auth header
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let callerUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      callerUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Verify caller is superadmin
    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data()?.user_type !== "superadmin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await req.json();
    const { email, action } = body;

    if (!email || !action) {
      return NextResponse.json({ error: "Email et action requis" }, { status: 400 });
    }

    if (!["promote", "revoke"].includes(action)) {
      return NextResponse.json({ error: "Action invalide (promote|revoke)" }, { status: 400 });
    }

    // Find user by email
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      return NextResponse.json(
        { error: `Aucun compte trouvé pour "${email}"` },
        { status: 404 }
      );
    }

    // Check Firestore profile
    const userDoc = await adminDb.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Cet utilisateur n'a pas de profil Firestore" },
        { status: 404 }
      );
    }

    const currentType = userDoc.data()?.user_type;

    if (action === "promote") {
      if (currentType === "superadmin") {
        return NextResponse.json({ message: "Déjà superadmin", user_type: "superadmin" });
      }
      await adminDb.collection("users").doc(userRecord.uid).update({
        user_type: "superadmin",
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        message: `${email} promu superadmin`,
        user_type: "superadmin",
        previous_type: currentType,
      });
    }

    if (action === "revoke") {
      // Prevent self-revoke
      if (userRecord.uid === callerUid) {
        return NextResponse.json(
          { error: "Impossible de révoquer vos propres droits" },
          { status: 400 }
        );
      }
      if (currentType !== "superadmin") {
        return NextResponse.json({ message: "N'est pas superadmin", user_type: currentType });
      }
      await adminDb.collection("users").doc(userRecord.uid).update({
        user_type: "player", // Fallback to player
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({
        message: `${email} rétrogradé`,
        user_type: "player",
        previous_type: "superadmin",
      });
    }
  } catch (err: any) {
    console.error("Admin promote error:", err);
    return NextResponse.json({ error: err.message ?? "Erreur serveur" }, { status: 500 });
  }
}
