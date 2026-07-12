import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotificationEmail, organizerApplicationDecisionHtml } from "@/lib/email";
import { sendPushToUser } from "@/lib/fcm-server";

/**
 * PATCH /api/organizer-applications/[id] — superadmin decision.
 * Body: { action: "approve" | "reject" }
 * Approve promotes the applicant to user_type "organizer"; both branches
 * notify the applicant (email + push, best-effort).
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
      reviewed_by: callerUid,
      reviewed_at: FieldValue.serverTimestamp(),
    });

    if (approved) {
      await adminDb.collection("users").doc(application.uid).update({
        user_type: "organizer",
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    // Notify the applicant — best-effort.
    const firstName = (application.name as string)?.split(" ")[0] ?? "toi";
    if (application.email) {
      sendNotificationEmail(
        application.email,
        approved
          ? "Candidature acceptée — bienvenue parmi les organisateurs !"
          : "Ta candidature organisateur — KoppaFoot",
        organizerApplicationDecisionHtml(firstName, approved),
      ).catch((e) => console.warn("[organizer-applications PATCH] email failed:", e?.message));
    }
    sendPushToUser(application.uid, {
      title: approved ? "🏆 Candidature acceptée !" : "Candidature organisateur",
      body: approved
        ? "Ton espace organisateur est ouvert. Crée ta première compétition !"
        : "Ta candidature n'a pas été retenue pour le moment.",
      link: approved ? "/organizer" : "/",
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: approved ? "approved" : "rejected" });
  } catch (err) {
    console.error("[organizer-applications PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
