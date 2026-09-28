import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { sendPushToUser } from "@/lib/fcm-server";

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
    const { action, motif: motifBrut } = (await req.json()) as { action?: "approve" | "reject"; motif?: unknown };
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
    // Un refus dit pourquoi, comme pour un terrain ou un organisateur.
    const motif = action === "reject" && typeof motifBrut === "string" ? motifBrut.trim().slice(0, 500) : "";

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
      rejection_reason: motif || null,
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

    // ON PRÉVIENT LE CANDIDAT. La décision tombait en silence : un scoreur
    // accepté ne savait pas qu'il pouvait couvrir un match, un refusé
    // attendait une réponse qui ne viendrait pas. Au mieux, et attendu : une
    // instance sans serveur gèle dès la réponse rendue.
    const lien = approuve ? "/live-ops" : "/scoreurs/candidature";
    await Promise.allSettled([
      adminDb.collection("notifications").add({
        user_id: candidature.uid,
        type: "admin_message",
        title: approuve ? "Tu es scoreur" : "Candidature scoreur",
        body: approuve
          ? "Tu peux maintenant tenir le score en direct des amicaux."
          : `Ta candidature n'a pas été retenue.${motif ? ` Motif : ${motif}` : ""}`,
        link: lien,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      }),
      sendPushToUser(candidature.uid, {
        title: approuve ? "Tu es scoreur" : "Candidature scoreur",
        body: approuve
          ? "Tu peux maintenant tenir le score en direct des amicaux."
          : motif ? `Ta candidature n'a pas été retenue : ${motif}` : "Ta candidature n'a pas été retenue pour le moment.",
        link: lien,
        category: "perso",
      }),
    ]);

    return NextResponse.json({ ok: true, status: approuve ? "approved" : "rejected" });
  } catch (err) {
    console.error("[scorer-applications PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
