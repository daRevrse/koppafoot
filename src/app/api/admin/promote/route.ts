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
    const { uid, email, action, role = "superadmin" } = body;

    // uid is what the admin UI has on hand; email stays supported for the
    // CLI script and for phone-less lookups by address.
    if ((!uid && !email) || !action) {
      return NextResponse.json({ error: "uid ou email, et action requis" }, { status: 400 });
    }

    if (!["promote", "revoke"].includes(action)) {
      return NextResponse.json({ error: "Action invalide (promote|revoke)" }, { status: 400 });
    }

    if (!["superadmin", "organizer"].includes(role)) {
      return NextResponse.json({ error: "Rôle invalide (superadmin|organizer)" }, { status: 400 });
    }

    // Find the target account, by uid when the caller has it, else by email
    let userRecord;
    try {
      userRecord = uid
        ? await adminAuth.getUser(uid)
        : await adminAuth.getUserByEmail(email);
    } catch {
      return NextResponse.json(
        { error: `Aucun compte trouvé pour "${uid ?? email}"` },
        { status: 404 }
      );
    }

    const label = userRecord.email ?? userRecord.phoneNumber ?? userRecord.uid;

    // Check Firestore profile
    const userDoc = await adminDb.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Cet utilisateur n'a pas de profil Firestore" },
        { status: 404 }
      );
    }

    // LA PROMOTION POSE UN DRAPEAU, PLUS UN TYPE.
    //
    // Elle écrivait `user_type: "organizer"`, donc dans le champ du RÔLE :
    // promouvoir un joueur effaçait qu'il jouait. Et la révocation le
    // reposait en « player » — y compris quelqu'un qui n'avait jamais joué,
    // faute d'une valeur neutre. Les deux symptômes disparaissent avec le
    // drapeau : le rôle n'est jamais touché, ni dans un sens ni dans l'autre.
    const DRAPEAU: Record<string, "is_superadmin" | "is_organizer"> = {
      superadmin: "is_superadmin",
      organizer: "is_organizer",
    };
    const donnees = userDoc.data() ?? {};
    const drapeau = DRAPEAU[role as string];
    const dejaPose = donnees[drapeau] === true;

    if (action === "promote") {
      if (dejaPose) {
        return NextResponse.json({ message: `Déjà ${role}`, hat: drapeau });
      }
      await adminDb.collection("users").doc(userRecord.uid).update({
        [drapeau]: true,
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ message: `${label} promu ${role}`, hat: drapeau });
    }

    if (action === "revoke") {
      // On ne se retire pas ses propres droits.
      if (userRecord.uid === callerUid) {
        return NextResponse.json(
          { error: "Impossible de révoquer vos propres droits" },
          { status: 400 }
        );
      }
      if (!dejaPose) {
        return NextResponse.json({ message: "Aucun droit à révoquer", hat: drapeau });
      }
      // Le drapeau tombe, le RÔLE ne bouge pas : un organisateur qui jouait
      // reste joueur, un organisateur qui ne jouait pas reste « user ».
      await adminDb.collection("users").doc(userRecord.uid).update({
        [drapeau]: false,
        updated_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ message: `${label} rétrogradé`, hat: drapeau });
    }
  } catch (err) {
    console.error("Admin promote error:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
