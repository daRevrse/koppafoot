import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { FirestoreCompetition } from "@/types";

/**
 * Shared auth + authorization for both handlers.
 *
 * 1. Verify the caller's Bearer id token (mirrors the promote route).
 * 2. Load the target competition.
 * 3. Authorize: the caller must be an organizer of THAT competition, OR be a
 *    superadmin. This is checked against the server-loaded competition doc, never
 *    trusting the client. (Moderator changes mutate the competition doc, which
 *    Firestore rules restrict to organizers — so the caller is acting as one.)
 *
 * Returns either an early `NextResponse` (the error to return) or the resolved
 * `{ callerUid, competition }` on success.
 */
async function authorize(
  req: NextRequest,
  cid: string,
): Promise<
  | { error: NextResponse }
  | { callerUid: string; competition: FirestoreCompetition }
> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  }

  const token = authHeader.split("Bearer ")[1];
  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    callerUid = decoded.uid;
  } catch {
    return { error: NextResponse.json({ error: "Token invalide" }, { status: 401 }) };
  }

  const compSnap = await adminDb.collection("competitions").doc(cid).get();
  if (!compSnap.exists) {
    return { error: NextResponse.json({ error: "Compétition introuvable" }, { status: 404 }) };
  }
  const competition = compSnap.data() as FirestoreCompetition;

  const isOrganizer = (competition.organizer_ids ?? []).includes(callerUid);
  let isSuperadmin = false;
  if (!isOrganizer) {
    const callerDoc = await adminDb.collection("users").doc(callerUid).get();
    isSuperadmin = callerDoc.exists && callerDoc.data()?.user_type === "superadmin";
  }
  if (!isOrganizer && !isSuperadmin) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { callerUid, competition };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, email } = body;
    if (!cid || !email) {
      return NextResponse.json({ error: "cid et email requis" }, { status: 400 });
    }

    const authResult = await authorize(req, cid);
    if ("error" in authResult) return authResult.error;
    const { competition } = authResult;

    // Resolve the invitee by email.
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      return NextResponse.json(
        { error: `Aucun compte trouvé pour "${email}"` },
        { status: 404 },
      );
    }
    const uid = userRecord.uid;

    // Require a Firestore profile (so the staff list can resolve a name).
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Cet utilisateur n'a pas de profil Firestore" },
        { status: 404 },
      );
    }
    const userData = userDoc.data();

    // An organizer is already strictly more privileged than a moderator.
    if ((competition.organizer_ids ?? []).includes(uid)) {
      return NextResponse.json({ error: "Déjà organisateur" }, { status: 400 });
    }

    await adminDb.collection("competitions").doc(cid).update({
      moderator_ids: FieldValue.arrayUnion(uid),
      updated_at: FieldValue.serverTimestamp(),
    });

    // Best-effort notification: never let its failure fail the invite.
    try {
      await adminDb.collection("notifications").add({
        user_id: uid,
        type: "admin_message",
        title: "Tu es modérateur",
        body: `Tu peux gérer les matchs en direct de « ${competition.name} »`,
        link: "/live-ops",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    } catch (notifErr) {
      console.error("Moderator notification failed:", notifErr);
    }

    return NextResponse.json({
      uid,
      firstName: userData?.first_name ?? "",
      lastName: userData?.last_name ?? "",
      email: userData?.email ?? userRecord.email ?? email,
    });
  } catch (err) {
    console.error("Moderator add error:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { cid, uid } = body;
    if (!cid || !uid) {
      return NextResponse.json({ error: "cid et uid requis" }, { status: 400 });
    }

    const authResult = await authorize(req, cid);
    if ("error" in authResult) return authResult.error;

    await adminDb.collection("competitions").doc(cid).update({
      moderator_ids: FieldValue.arrayRemove(uid),
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Moderator remove error:", err);
    const message = err instanceof Error ? err.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
