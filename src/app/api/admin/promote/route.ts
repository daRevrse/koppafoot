import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    // Le contrôle commun, qui lit le drapeau. Cette route comparait
    // `user_type` à « superadmin » : l'administrateur d'aujourd'hui porte un
    // drapeau et un rôle ordinaire, elle lui répondait donc « Accès refusé »
    // — y compris pour donner une casquette, la seule chose qu'elle fait.
    const appelant = await exigerSuperadmin(req);
    if (appelant instanceof NextResponse) return appelant;
    const callerUid = appelant.uid;

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

    if (!["superadmin", "organizer", "scorer"].includes(role)) {
      return NextResponse.json({ error: "Casquette invalide (superadmin|organizer|scorer)" }, { status: 400 });
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
    //
    // Le scoreur s'accorde d'ici aussi : sa candidature a sa page, mais un
    // scoreur qu'on connaît, ou dont il faut retirer la casquette après un
    // abus, n'avait aucun autre chemin que la console Firebase.
    const DRAPEAU: Record<string, "is_superadmin" | "is_organizer" | "is_scorer"> = {
      superadmin: "is_superadmin",
      organizer: "is_organizer",
      scorer: "is_scorer",
    };
    const donnees = userDoc.data() ?? {};
    const drapeau = DRAPEAU[role as string];
    // Un administrateur d'avant la bascule ne porte que l'ancien type : il
    // l'est tout autant, et le retirer doit aussi effacer cette trace-là.
    const heritage = drapeau === "is_superadmin" && donnees.user_type === "superadmin";
    const dejaPose = donnees[drapeau] === true || heritage;

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
        ...(heritage ? { user_type: "user" } : {}),
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
