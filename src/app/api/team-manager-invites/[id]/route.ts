import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Invitee side of the team-manager invitation.
 *
 * GET  — public: what the accept page needs to render (team/competition
 *        names, inviter, status). The doc id is the unguessable token;
 *        the invited email is only returned masked.
 * POST — accept (Bearer token). The caller's verified email must match
 *        the invited email; the team must still be unclaimed. On success
 *        the caller becomes owner+manager of the team and their account
 *        flips to the manager role.
 */

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const snap = await adminDb.collection("team_manager_invites").doc(id).get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    const x = snap.data()!;
    return NextResponse.json({
      invite: {
        id: snap.id,
        teamName: x.team_name ?? "",
        competitionName: x.competition_name ?? "",
        invitedByName: x.invited_by_name ?? "",
        emailMasked: maskEmail(x.email ?? ""),
        status: x.status ?? "pending",
      },
    });
  } catch (err) {
    console.error("[team-manager-invites/[id] GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    let callerUid: string;
    let callerEmail: string | null;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      callerUid = decoded.uid;
      callerEmail = decoded.email?.toLowerCase() ?? null;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { id } = await params;
    const inviteRef = adminDb.collection("team_manager_invites").doc(id);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    const invite = inviteSnap.data()!;

    if (invite.status !== "pending") {
      return NextResponse.json(
        { error: invite.status === "accepted" ? "Invitation déjà acceptée" : "Invitation annulée" },
        { status: 409 },
      );
    }
    if (!callerEmail || callerEmail !== invite.email) {
      return NextResponse.json(
        { error: `Cette invitation est réservée à ${maskEmail(invite.email)} — connecte-toi avec cette adresse.` },
        { status: 403 },
      );
    }

    const teamRef = adminDb
      .collection("competitions").doc(invite.competition_id)
      .collection("comp_teams").doc(invite.team_id);

    // Claim atomically so two accepts (or a parallel organizer edit) can't
    // hand the same team to two managers.
    await adminDb.runTransaction(async (tx) => {
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) throw new Error("TEAM_GONE");
      if (teamSnap.data()?.claimed_by_manager_id) throw new Error("ALREADY_CLAIMED");
      tx.update(teamRef, {
        claimed_by_manager_id: callerUid,
        updated_at: FieldValue.serverTimestamp(),
      });
      tx.update(inviteRef, {
        status: "accepted",
        accepted_by: callerUid,
        accepted_at: FieldValue.serverTimestamp(),
      });
    });

    // Flip the account to the manager role (organizer/superadmin keep theirs).
    const userRef = adminDb.collection("users").doc(callerUid);
    const userSnap = await userRef.get();
    if (userSnap.exists) {
      const u = userSnap.data()!;
      const patch: Record<string, unknown> = {
        evolution_role: "manager",
        team_name: invite.team_name,
        updated_at: FieldValue.serverTimestamp(),
      };
      if (u.user_type !== "organizer" && u.user_type !== "superadmin") {
        patch.user_type = "manager";
      }
      await userRef.update(patch);
    }

    // Tell the organizer — best-effort.
    const managerName = userSnap.exists
      ? `${userSnap.data()?.first_name ?? ""} ${userSnap.data()?.last_name ?? ""}`.trim()
      : callerEmail;
    adminDb.collection("notifications").add({
      user_id: invite.invited_by,
      type: "admin_message",
      title: "Invitation acceptée",
      body: `${managerName || callerEmail} gère désormais « ${invite.team_name} » (${invite.competition_name})`,
      link: `/organizer/competitions/${invite.competition_id}/teams`,
      read: false,
      created_at: FieldValue.serverTimestamp(),
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "ALREADY_CLAIMED") {
      return NextResponse.json({ error: "Cette équipe a déjà un manager." }, { status: 409 });
    }
    if (err instanceof Error && err.message === "TEAM_GONE") {
      return NextResponse.json({ error: "Cette équipe n'existe plus." }, { status: 404 });
    }
    console.error("[team-manager-invites/[id] POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
