import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * PATCH /api/venue-applications/[id] — décision de l'administrateur.
 *
 * À l'approbation, deux écritures : la casquette sur le compte, et le terrain
 * lui-même, créé à partir de ce que la candidature portait déjà.
 *
 * La casquette est un DRAPEAU, jamais un `user_type`. Écraser le type de
 * compte effacerait ce que la personne est par ailleurs — c'est exactement ce
 * que faisait l'approbation d'organisateur, et ce qui rendait invisible un
 * organisateur qui joue.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    let callerUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      callerUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    if (!callerSnap.exists || callerSnap.data()?.user_type !== "superadmin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { action } = (await req.json()) as { action?: string };
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action doit être approve ou reject" }, { status: 400 });
    }

    const { id } = await params;
    const ref = adminDb.collection("venue_applications").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    }
    const application = snap.data()!;
    if (application.status !== "pending") {
      return NextResponse.json({ error: "Candidature déjà traitée" }, { status: 409 });
    }

    const approved = action === "approve";
    await ref.update({
      status: approved ? "approved" : "rejected",
      reviewed_by: callerUid,
      reviewed_at: FieldValue.serverTimestamp(),
    });

    if (approved) {
      const surface = application.field_surface ?? "synthetic";
      await Promise.all([
        adminDb.collection("users").doc(application.uid).update({
          is_venue_owner: true,
          updated_at: FieldValue.serverTimestamp(),
        }),
        // Le terrain naît avec la casquette : la candidature portait déjà sa
        // fiche, la redemander aurait fait saisir deux fois la même chose.
        adminDb.collection("venues").add({
          name: application.venue_name,
          address: application.address ?? "",
          city: application.city ?? "",
          owner_id: application.uid,
          field_type: surface === "indoor" ? "indoor" : "outdoor",
          field_surface: surface,
          field_size: application.field_size ?? "11v11",
          price_per_hour: 0,
          amenities: [],
          available: true,
          photo_url: null,
          rating: 0,
          review_count: 0,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        }),
      ]);
    }

    return NextResponse.json({ ok: true, status: approved ? "approved" : "rejected" });
  } catch (err) {
    console.error("PATCH venue application failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
