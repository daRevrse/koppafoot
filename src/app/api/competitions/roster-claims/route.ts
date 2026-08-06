import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CompPlayer, FirestoreCompetition, LinkedCompPlayer } from "@/types";

/**
 * Roster claims — a player says "this line of the roster is me", and the
 * competition's organizer (or the team's manager) validates it. Once accepted
 * the link is written both ways: `user_id` on the roster entry, and a
 * denormalized `linked_comp_players` row on the user so /stats resolves in a
 * single read instead of a collection-group scan.
 *
 * The `roster_claims` collection is admin-SDK only: clients always go through
 * this route, so no Firestore rules are needed.
 *
 * POST   { cid, teamId, playerId }     — a player claims a roster line.
 * GET    ?cid=...                      — pending claims to validate (staff).
 * GET    ?mine=1                       — the caller's own claims.
 * PATCH  { id, action: accept|reject } — staff decision.
 * DELETE { id }                        — the claimant cancels their request.
 */

async function callerUidOf(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** Staff = organizer of the competition, manager of that team, or superadmin. */
async function isStaffOf(uid: string, cid: string, teamId: string): Promise<boolean> {
  const compSnap = await adminDb.collection("competitions").doc(cid).get();
  if (!compSnap.exists) return false;
  const competition = compSnap.data() as FirestoreCompetition;
  if ((competition.organizer_ids ?? []).includes(uid)) return true;

  const teamSnap = await adminDb
    .collection("competitions").doc(cid)
    .collection("comp_teams").doc(teamId)
    .get();
  if (teamSnap.exists && teamSnap.data()?.claimed_by_manager_id === uid) return true;

  const callerDoc = await adminDb.collection("users").doc(uid).get();
  return callerDoc.exists && callerDoc.data()?.user_type === "superadmin";
}

function toClaimJson(id: string, x: FirebaseFirestore.DocumentData) {
  return {
    id,
    competitionId: x.competition_id,
    competitionName: x.competition_name ?? "",
    teamId: x.team_id,
    teamName: x.team_name ?? "",
    playerId: x.player_id,
    playerName: x.player_name ?? "",
    userId: x.user_id,
    userName: x.user_name ?? "",
    status: x.status ?? "pending",
    createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { cid, teamId, playerId } = (await req.json()) as {
      cid?: string; teamId?: string; playerId?: string;
    };
    if (!cid || !teamId || !playerId) {
      return NextResponse.json({ error: "cid, teamId et playerId requis" }, { status: 400 });
    }

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;

    const teamSnap = await adminDb
      .collection("competitions").doc(cid)
      .collection("comp_teams").doc(teamId)
      .get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Équipe introuvable" }, { status: 404 });
    }
    const team = teamSnap.data()!;
    const players = (team.players ?? []) as CompPlayer[];

    const player = players.find((p) => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });
    }
    if (player.user_id) {
      return NextResponse.json(
        { error: "Cette ligne est déjà rattachée à un compte." },
        { status: 409 },
      );
    }
    // One account per roster: claiming a second line of the same team would
    // double-count the player's stats.
    if (players.some((p) => p.user_id === callerUid)) {
      return NextResponse.json(
        { error: "Tu es déjà rattaché à un joueur de cette équipe." },
        { status: 409 },
      );
    }

    const existing = await adminDb
      .collection("roster_claims")
      .where("team_id", "==", teamId)
      .where("player_id", "==", playerId)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!existing.empty) {
      const claim = existing.docs[0].data();
      return NextResponse.json(
        {
          error:
            claim.user_id === callerUid
              ? "Ta demande est déjà en attente de validation."
              : "Un autre joueur a déjà demandé cette ligne.",
        },
        { status: 409 },
      );
    }

    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    const c = callerSnap.data();
    const userName = `${c?.first_name ?? ""} ${c?.last_name ?? ""}`.trim() || "Un joueur";

    const ref = await adminDb.collection("roster_claims").add({
      competition_id: cid,
      competition_name: competition.name,
      competition_slug: competition.slug,
      team_id: teamId,
      team_name: team.name,
      player_id: playerId,
      player_name: player.name,
      user_id: callerUid,
      user_name: userName,
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });

    // Notify whoever can validate: the team's manager if there is one, the
    // organizers otherwise.
    const validators: string[] = team.claimed_by_manager_id
      ? [team.claimed_by_manager_id]
      : (competition.organizer_ids ?? []);
    await Promise.all(
      validators.map((uid) =>
        adminDb.collection("notifications").add({
          user_id: uid,
          type: "participation_request",
          title: "Demande de rattachement",
          body: `${userName} déclare être « ${player.name} » (${team.name})`,
          link: `/organizer/competitions/${cid}/teams/${teamId}`,
          read: false,
          created_at: FieldValue.serverTimestamp(),
        }),
      ),
    );

    return NextResponse.json({ ok: true, id: ref.id });
  } catch (err) {
    console.error("[roster-claims POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    if (req.nextUrl.searchParams.get("mine")) {
      const snap = await adminDb
        .collection("roster_claims")
        .where("user_id", "==", callerUid)
        .get();
      return NextResponse.json({ claims: snap.docs.map((d) => toClaimJson(d.id, d.data())) });
    }

    const cid = req.nextUrl.searchParams.get("cid");
    if (!cid) return NextResponse.json({ error: "cid ou mine requis" }, { status: 400 });

    const snap = await adminDb
      .collection("roster_claims")
      .where("competition_id", "==", cid)
      .where("status", "==", "pending")
      .get();

    // Filter to the teams this caller may actually validate — a manager only
    // sees their own team's claims, an organizer sees them all.
    const claims = [];
    for (const d of snap.docs) {
      const data = d.data();
      if (await isStaffOf(callerUid, cid, data.team_id)) {
        claims.push(toClaimJson(d.id, data));
      }
    }
    return NextResponse.json({ claims });
  } catch (err) {
    console.error("[roster-claims GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action } = (await req.json()) as { id?: string; action?: string };
    if (!id || (action !== "accept" && action !== "reject")) {
      return NextResponse.json({ error: "id et action (accept|reject) requis" }, { status: 400 });
    }

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const claimRef = adminDb.collection("roster_claims").doc(id);
    const claimSnap = await claimRef.get();
    if (!claimSnap.exists) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    const claim = claimSnap.data()!;
    if (claim.status !== "pending") {
      return NextResponse.json({ error: "Demande déjà traitée" }, { status: 409 });
    }

    if (!(await isStaffOf(callerUid, claim.competition_id, claim.team_id))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (action === "reject") {
      await claimRef.update({ status: "rejected", decided_by: callerUid });
      await adminDb.collection("notifications").add({
        user_id: claim.user_id,
        type: "participation_request",
        title: "Demande refusée",
        body: `Ta demande de rattachement à « ${claim.player_name} » (${claim.team_name}) a été refusée.`,
        link: `/c/${claim.competition_slug}/teams/${claim.team_id}`,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    const teamRef = adminDb
      .collection("competitions").doc(claim.competition_id)
      .collection("comp_teams").doc(claim.team_id);

    // The roster is a single array field, so read-modify-write in a
    // transaction — two validators accepting at once must not clobber
    // each other's link.
    await adminDb.runTransaction(async (tx) => {
      const teamSnap = await tx.get(teamRef);
      if (!teamSnap.exists) throw new Error("TEAM_NOT_FOUND");
      const players = (teamSnap.data()?.players ?? []) as CompPlayer[];
      const idx = players.findIndex((p) => p.id === claim.player_id);
      if (idx === -1) throw new Error("PLAYER_NOT_FOUND");
      if (players[idx].user_id) throw new Error("ALREADY_LINKED");

      const next = [...players];
      next[idx] = { ...next[idx], user_id: claim.user_id };
      tx.update(teamRef, { players: next, updated_at: FieldValue.serverTimestamp() });

      const link: LinkedCompPlayer = {
        competition_id: claim.competition_id,
        competition_name: claim.competition_name ?? "",
        competition_slug: claim.competition_slug ?? "",
        team_id: claim.team_id,
        team_name: claim.team_name ?? "",
        player_id: claim.player_id,
        player_name: claim.player_name ?? "",
      };
      tx.update(adminDb.collection("users").doc(claim.user_id), {
        linked_comp_players: FieldValue.arrayUnion(link),
        updated_at: FieldValue.serverTimestamp(),
      });

      tx.update(claimRef, { status: "accepted", decided_by: callerUid });
    });

    // Any other pending request on the same line is now moot.
    const others = await adminDb
      .collection("roster_claims")
      .where("player_id", "==", claim.player_id)
      .where("team_id", "==", claim.team_id)
      .where("status", "==", "pending")
      .get();
    await Promise.all(others.docs.map((d) => d.ref.update({ status: "rejected" })));

    await adminDb.collection("notifications").add({
      user_id: claim.user_id,
      type: "participation_request",
      title: "Rattachement validé",
      body: `Tu es maintenant « ${claim.player_name} » de ${claim.team_name}. Tes stats sont en ligne.`,
      link: "/stats",
      read: false,
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "ALREADY_LINKED") {
      return NextResponse.json({ error: "Cette ligne vient d'être rattachée." }, { status: 409 });
    }
    if (message === "PLAYER_NOT_FOUND" || message === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "Joueur ou équipe introuvable" }, { status: 404 });
    }
    console.error("[roster-claims PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const callerUid = await callerUidOf(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const claimRef = adminDb.collection("roster_claims").doc(id);
    const claimSnap = await claimRef.get();
    if (!claimSnap.exists) {
      return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
    }
    const claim = claimSnap.data()!;
    if (claim.user_id !== callerUid) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (claim.status !== "pending") {
      return NextResponse.json({ error: "Demande déjà traitée" }, { status: 409 });
    }

    await claimRef.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[roster-claims DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
