import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";

/**
 * PATCH /api/scorer-applications/[id], approuver ou refuser.
 *
 * Le superadmin, et lui seul. Voir la route jumelle des organisateurs pour le
 * raisonnement : le contrôle passe par `exigerSuperadmin`, qui lit le PROFIL et
 * pas seulement le jeton — un jeton dit qui appelle, jamais ce qu'il a le droit
 * de faire.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  try {
    const { action } = (await req.json()) as { action?: "approve" | "reject" };
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }

    const { id } = await params;
    const ref = adminDb.collection("scorer_applications").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    }
    const candidature = snap.data()!;
    if (candidature.status !== "pending") {
      return NextResponse.json({ error: "Candidature déjà traitée" }, { status: 409 });
    }

    const approuve = action === "approve";
    await ref.update({
      status: approuve ? "approved" : "rejected",
      reviewed_by: appelant.uid,
      reviewed_at: FieldValue.serverTimestamp(),
    });

    if (approuve) {
      // `is_scorer` et NON `user_type` : couvrir des matchs est une casquette
      // qui s'ajoute, pas une identité qui remplace. Écraser le type de compte
      // ferait sortir un joueur de la recherche joueurs et lui coûterait sa
      // fiche — c'est l'erreur qu'avait faite l'approbation d'organisateur, et
      // qui a été corrigée pour cette raison exacte.
      await adminDb.collection("users").doc(candidature.uid).update({
        is_scorer: true,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[scorer-applications PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
