import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { notifyTeamActivity } from "@/lib/activity-notify-server";
import type { FirestoreInvitation } from "@/types";

/**
 * A player answers an invitation to join a team.
 *
 * Accepting adds the player to `teams/{id}.member_ids` — a document the player
 * does not own. The rule that allowed it could only check the shape of the write
 * (members preserved, manager and name untouched, caller present in the new
 * list), never *why* it was happening, so anyone signed in could add themselves
 * to any team on the platform without an invitation existing at all.
 *
 * Here the invitation is the authorization: it must exist, name the caller as
 * receiver, and still be pending.
 *
 * POST { invitationId, accepted }
 */

export async function POST(req: NextRequest) {
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

  const { invitationId, accepted } = (await req.json().catch(() => ({}))) as {
    invitationId?: string;
    accepted?: boolean;
  };
  if (!invitationId || typeof accepted !== "boolean") {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const invRef = adminDb.collection("invitations").doc(invitationId);
  // Renseigné dans la transaction, lu après : la diffusion ne doit pas partir
  // avant que l'adhésion ne soit effectivement écrite.
  let joinedTeamId: string | null = null;

  try {
    await adminDb.runTransaction(async (tx) => {
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists) throw new Error("NOT_FOUND");
      const invitation = invSnap.data() as FirestoreInvitation;

      if (invitation.receiver_id !== callerUid) throw new Error("FORBIDDEN");
      // Answering twice must not re-add the player, nor flip a declined
      // invitation into an acceptance later on.
      if (invitation.status !== "pending") throw new Error("ALREADY_ANSWERED");

      tx.update(invRef, {
        status: accepted ? "accepted" : "declined",
        updated_at: FieldValue.serverTimestamp(),
      });

      if (accepted && invitation.team_id) {
        tx.update(adminDb.collection("teams").doc(invitation.team_id), {
          member_ids: FieldValue.arrayUnion(callerUid),
          updated_at: FieldValue.serverTimestamp(),
        });
        joinedTeamId = invitation.team_id;
      }
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : "";
    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }
    if (code === "ALREADY_ANSWERED") {
      return NextResponse.json({ error: "Invitation déjà traitée" }, { status: 409 });
    }
    console.error("invitation response failed:", err);
    return NextResponse.json({ error: "Opération impossible" }, { status: 500 });
  }

  // L'effectif et les abonnés apprennent l'arrivée. Best-effort : le joueur
  // est déjà dans l'équipe, une diffusion ratée ne doit pas faire échouer sa
  // réponse à l'invitation.
  if (joinedTeamId) {
    const userSnap = await adminDb.collection("users").doc(callerUid).get();
    const u = userSnap.data();
    await notifyTeamActivity({
      teamId: joinedTeamId,
      event: "member_joined",
      actorId: callerUid,
      playerId: callerUid,
      playerName: `${u?.first_name ?? ""} ${u?.last_name ?? ""}`.trim() || "Un joueur",
    }).catch((e) => console.error("[invitation respond] notify failed", e));
  }

  return NextResponse.json({ ok: true });
}
