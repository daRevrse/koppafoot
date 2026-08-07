import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CompPlayer, FirestoreCompetition, LinkedCompPlayer } from "@/types";

/**
 * Import a manager's club squad into their competition team.
 *
 * Runs server-side because it writes BOTH sides of the link:
 *  - `user_id` on each competition roster line, and
 *  - a `linked_comp_players` row on each player's own user doc.
 *
 * That second write is the whole point and it cannot happen from the client:
 * the rules only ever let a user write their own document. Without it the
 * roster lines carried a user_id that nothing read, and /stats stayed empty
 * for every player a manager had imported.
 *
 * Members keep their account link, so their statistics start filling with no
 * claim and no validation — the manager vouching for their own squad IS the
 * check. Ghost players come over as plain names.
 *
 * POST { cid, teamId, clubId }
 */

const BATCH_LIMIT = 450;

export async function POST(req: NextRequest) {
  try {
    const { cid, teamId, clubId } = (await req.json()) as {
      cid?: string; teamId?: string; clubId?: string;
    };
    if (!cid || !teamId || !clubId) {
      return NextResponse.json({ error: "cid, teamId et clubId requis" }, { status: 400 });
    }

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

    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;

    const teamRef = adminDb
      .collection("competitions").doc(cid)
      .collection("comp_teams").doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Équipe de compétition introuvable" }, { status: 404 });
    }
    const compTeam = teamSnap.data()!;

    const clubRef = adminDb.collection("teams").doc(clubId);
    const clubSnap = await clubRef.get();
    if (!clubSnap.exists) {
      return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
    }
    const club = clubSnap.data()!;

    // The caller must run BOTH sides: their own club into their own team.
    // Organizers and superadmins may do it on a manager's behalf.
    const isTeamManager = compTeam.claimed_by_manager_id === callerUid;
    const isClubManager = club.manager_id === callerUid;
    const isOrganizer = (competition.organizer_ids ?? []).includes(callerUid);
    let isSuperadmin = false;
    if (!isOrganizer) {
      const callerDoc = await adminDb.collection("users").doc(callerUid).get();
      isSuperadmin = callerDoc.exists && callerDoc.data()?.user_type === "superadmin";
    }
    if (!((isTeamManager && isClubManager) || isOrganizer || isSuperadmin)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // ── Build the additions ──────────────────────────────────
    const existing = (compTeam.players ?? []) as CompPlayer[];
    const linkedUsers = new Set(existing.map((p) => p.user_id).filter(Boolean));
    const existingIds = new Set(existing.map((p) => p.id));

    const memberIds = (club.member_ids ?? []) as string[];
    const squadNumbers = (club.squad_numbers ?? {}) as Record<string, string>;

    // A club roster is small, so plain gets beat an `in` query here: no
    // 30-id chunking, no documentId() quirks.
    const memberDocs = await Promise.all(
      memberIds.map((id) => adminDb.collection("users").doc(id).get()),
    );

    const ghostSnap = await clubRef.collection("ghost_players").get().catch(() => null);

    const added: CompPlayer[] = [];
    const linkedUids: string[] = [];

    for (const doc of memberDocs) {
      if (!doc.exists || linkedUsers.has(doc.id)) continue;
      const u = doc.data()!;
      added.push({
        id: `u_${doc.id}`,
        name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Joueur",
        number: squadNumbers[doc.id] ?? "",
        ...(u.position ? { position: u.position as string } : {}),
        user_id: doc.id,
      });
      linkedUids.push(doc.id);
    }

    for (const doc of ghostSnap?.docs ?? []) {
      const id = `ghost_${doc.id}`;
      if (existingIds.has(id)) continue;
      const g = doc.data();
      added.push({
        id,
        name: `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() || "Joueur",
        number: (g.squad_number as string) ?? "",
        ...(g.position ? { position: g.position as string } : {}),
        user_id: null,
      });
    }

    await teamRef.update({
      players: [...existing, ...added],
      claimed_by_team_id: clubId,
      updated_at: FieldValue.serverTimestamp(),
    });

    // ── The other half of the link ───────────────────────────
    const link = (uid: string): LinkedCompPlayer => ({
      competition_id: cid,
      competition_name: competition.name,
      competition_slug: competition.slug,
      team_id: teamId,
      team_name: (compTeam.name as string) ?? "",
      player_id: `u_${uid}`,
      player_name:
        added.find((p) => p.user_id === uid)?.name ?? "",
    });

    for (let i = 0; i < linkedUids.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      for (const uid of linkedUids.slice(i, i + BATCH_LIMIT)) {
        batch.update(adminDb.collection("users").doc(uid), {
          linked_comp_players: FieldValue.arrayUnion(link(uid)),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return NextResponse.json({ ok: true, added: added.length, linked: linkedUids.length });
  } catch (err) {
    console.error("[club-import POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
