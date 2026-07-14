import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotificationEmail, teamManagerInviteHtml } from "@/lib/email";
import type { FirestoreCompetition } from "@/types";

const APP_URL = "https://koppafoot.com";

/**
 * Team-manager invitations — an organizer hands the management of one of
 * their competition teams to someone by email. Accepting (see
 * /api/team-manager-invites/[id]) makes the invitee owner+manager of the
 * team (comp_teams.claimed_by_manager_id) and flips their account to the
 * manager role.
 *
 * The `team_manager_invites` collection is admin-SDK only: clients always
 * go through these routes, so no Firestore rules are needed.
 *
 * POST   { cid, teamId, email }  — create + send the invite email.
 * GET    ?cid=...                — list pending invites of a competition.
 * DELETE { id }                  — revoke a pending invite.
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
  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
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

function toInviteJson(id: string, x: FirebaseFirestore.DocumentData) {
  return {
    id,
    competitionId: x.competition_id,
    teamId: x.team_id,
    teamName: x.team_name ?? "",
    competitionName: x.competition_name ?? "",
    email: x.email ?? "",
    invitedByName: x.invited_by_name ?? "",
    status: x.status ?? "pending",
    createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { cid, teamId, email } = (await req.json()) as {
      cid?: string; teamId?: string; email?: string;
    };
    if (!cid || !teamId || !email?.trim()) {
      return NextResponse.json({ error: "cid, teamId et email requis" }, { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }

    const authResult = await authorize(req, cid);
    if ("error" in authResult) return authResult.error;
    const { callerUid, competition } = authResult;

    const teamSnap = await adminDb
      .collection("competitions").doc(cid)
      .collection("comp_teams").doc(teamId)
      .get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    }
    const team = teamSnap.data()!;
    if (team.claimed_by_manager_id) {
      return NextResponse.json(
        { error: "Cette équipe a déjà un manager." },
        { status: 409 },
      );
    }

    // One pending invite per team at a time.
    const pending = await adminDb
      .collection("team_manager_invites")
      .where("team_id", "==", teamId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pending.empty) {
      return NextResponse.json(
        { error: "Une invitation est déjà en attente pour cette équipe." },
        { status: 409 },
      );
    }

    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    const c = callerSnap.data();
    const inviterName =
      `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "L'organisateur";

    const ref = await adminDb.collection("team_manager_invites").add({
      competition_id: cid,
      competition_name: competition.name,
      team_id: teamId,
      team_name: team.name,
      email: normalizedEmail,
      invited_by: callerUid,
      invited_by_name: inviterName,
      status: "pending",
      accepted_by: null,
      accepted_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    const acceptLink = `${APP_URL}/invitations/equipe/${ref.id}`;

    // Invite email — best-effort, the invite itself is already stored.
    sendNotificationEmail(
      normalizedEmail,
      `${inviterName} te confie l'équipe ${team.name} — KoppaFoot`,
      teamManagerInviteHtml(inviterName, team.name, competition.name, acceptLink),
    ).catch((e) => console.warn("[team-manager-invites] email failed:", e?.message));

    // If the invitee already has an account, drop an in-app notification too.
    adminAuth
      .getUserByEmail(normalizedEmail)
      .then((invitee) =>
        adminDb.collection("notifications").add({
          user_id: invitee.uid,
          type: "admin_message",
          title: "On te confie une équipe",
          body: `${inviterName} t'invite à gérer « ${team.name} » (${competition.name})`,
          link: `/invitations/equipe/${ref.id}`,
          read: false,
          created_at: FieldValue.serverTimestamp(),
        }),
      )
      .catch(() => {}); // no account yet — the email carries the invite

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("[team-manager-invites POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const cid = req.nextUrl.searchParams.get("cid");
    if (!cid) return NextResponse.json({ error: "cid requis" }, { status: 400 });

    const authResult = await authorize(req, cid);
    if ("error" in authResult) return authResult.error;

    const snap = await adminDb
      .collection("team_manager_invites")
      .where("competition_id", "==", cid)
      .where("status", "==", "pending")
      .get();

    return NextResponse.json({
      invites: snap.docs.map((d) => toInviteJson(d.id, d.data())),
    });
  } catch (err) {
    console.error("[team-manager-invites GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const inviteRef = adminDb.collection("team_manager_invites").doc(id);
    const inviteSnap = await inviteRef.get();
    if (!inviteSnap.exists) {
      return NextResponse.json({ error: "Invitation introuvable" }, { status: 404 });
    }
    const invite = inviteSnap.data()!;

    const authResult = await authorize(req, invite.competition_id);
    if ("error" in authResult) return authResult.error;

    if (invite.status !== "pending") {
      return NextResponse.json({ error: "Invitation déjà traitée" }, { status: 409 });
    }

    await inviteRef.update({ status: "revoked" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[team-manager-invites DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
