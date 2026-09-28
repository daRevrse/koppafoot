import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotificationEmail, organizerApplicationDecisionHtml } from "@/lib/email";
import { sendPushToUser } from "@/lib/fcm-server";

/**
 * PATCH /api/organizer-applications/[id], la décision du superadmin.
 * Corps : { action: "approve" | "reject", motif? }
 * Approuver pose la casquette `is_organizer` ; les deux branches préviennent
 * le candidat (cloche, e-mail, push, au mieux), avec le motif d'un refus.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Le contrôle commun, qui lit le drapeau : comparer `user_type` à
    // « superadmin » refusait l'administrateur d'aujourd'hui, qui ne pouvait
    // donc plus accepter ni refuser personne.
    const appelant = await exigerSuperadmin(req);
    if (appelant instanceof NextResponse) return appelant;
    const callerUid = appelant.uid;

    const { action, motif: motifBrut } = (await req.json()) as { action?: string; motif?: unknown };
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action doit être approve ou reject" }, { status: 400 });
    }
    // UN REFUS DIT POURQUOI, comme celui d'un terrain : le candidat le lit
    // sur sa page, dans la notification et dans l'e-mail, et sait quoi
    // préciser s'il redépose.
    const motif = action === "reject" && typeof motifBrut === "string" ? motifBrut.trim().slice(0, 500) : "";

    const { id } = await params;
    const appRef = adminDb.collection("organizer_applications").doc(id);
    const appSnap = await appRef.get();
    if (!appSnap.exists) {
      return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    }
    const application = appSnap.data()!;
    if (application.status !== "pending") {
      return NextResponse.json({ error: "Candidature déjà traitée" }, { status: 409 });
    }

    const approved = action === "approve";
    await appRef.update({
      status: approved ? "approved" : "rejected",
      rejection_reason: motif || null,
      reviewed_by: callerUid,
      reviewed_at: FieldValue.serverTimestamp(),
    });

    if (approved) {
      // Le nom d'organisateur passe de la candidature au profil : c'est lui
      // qui sera estampillé sur chaque compétition créée ensuite. Les
      // candidatures antérieures au champ n'en ont pas, le profil reste
      // alors vide et « Organisé par » ne s'affiche simplement pas.
      // `is_organizer` et NON `user_type: "organizer"`.
      //
      // Écraser le type de compte effaçait ce que la personne était par
      // ailleurs : un joueur approuvé organisateur sortait de la recherche
      // joueurs, perdait ses informations physiques sur sa fiche et ses
      // équipes. Organiser est une casquette qui s'ajoute, pas une identité
      // qui remplace.
      await adminDb.collection("users").doc(application.uid).update({
        is_organizer: true,
        ...(application.organizer_name
          ? { organizer_name: application.organizer_name }
          : {}),
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    // Awaited: serverless instances freeze once the response is returned, so
    // an un-awaited email or push is simply lost. `allSettled` keeps both
    // best-effort, the decision is already written.
    const firstName = (application.name as string)?.split(" ")[0] ?? "toi";
    await Promise.allSettled([
      // La cloche dans le produit, pour qui n'a ni push ni e-mail.
      adminDb.collection("notifications").add({
        user_id: application.uid,
        type: "admin_message",
        title: approved ? "Candidature organisateur acceptée" : "Candidature organisateur",
        body: approved
          ? "Ton espace organisateur est ouvert. Crée ta première compétition !"
          : `Ta candidature n'a pas été retenue.${motif ? ` Motif : ${motif}` : ""}`,
        link: approved ? "/organizer" : "/organisateurs/candidature",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      }),
      application.email
        ? sendNotificationEmail(
            application.email,
            approved
              ? "Candidature acceptée, bienvenue parmi les organisateurs !"
              : "Ta candidature organisateur, KoppaFoot",
            organizerApplicationDecisionHtml(firstName, approved, motif || null),
          ).catch((e) => {
            console.warn("[organizer-applications PATCH] email failed:", e?.message);
            throw e;
          })
        : Promise.resolve(),

      sendPushToUser(application.uid, {
        title: approved ? "🏆 Candidature acceptée !" : "Candidature organisateur",
        body: approved
          ? "Ton espace organisateur est ouvert. Crée ta première compétition !"
          : motif ? `Ta candidature n'a pas été retenue : ${motif}` : "Ta candidature n'a pas été retenue pour le moment.",
        link: approved ? "/organizer" : "/organisateurs/candidature",
        // Une réponse à MA candidature, pas une annonce : elle relève de ce
        // qui m'est adressé.
        category: "perso",
      }).catch((e) => {
        console.warn("[organizer-applications PATCH] push failed:", e?.message);
        throw e;
      }),
    ]);

    return NextResponse.json({ ok: true, status: approved ? "approved" : "rejected" });
  } catch (err) {
    console.error("[organizer-applications PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
