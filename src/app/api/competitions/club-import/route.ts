import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { importClubRoster } from "@/lib/club-import-server";
import type { FirestoreCompetition } from "@/types";
import { estSuperadmin } from "@/lib/admin-api-auth";

/**
 * Import a manager's club squad into their competition team.
 *
 * The copy itself lives in lib/club-import-server so that accepting a
 * registration lands a squad in exactly the same state. This route only
 * carries the authorization: the caller must run BOTH sides, their own club
 * into their own competition team, unless they are an organizer of that
 * competition or a superadmin acting on a manager's behalf.
 *
 * POST { cid, teamId, clubId }
 */
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

    const [teamSnap, clubSnap] = await Promise.all([
      adminDb.collection("competitions").doc(cid).collection("comp_teams").doc(teamId).get(),
      adminDb.collection("teams").doc(clubId).get(),
    ]);
    if (!teamSnap.exists) {
      return NextResponse.json({ error: "Équipe de compétition introuvable" }, { status: 404 });
    }
    if (!clubSnap.exists) {
      return NextResponse.json({ error: "Club introuvable" }, { status: 404 });
    }

    const isTeamManager = teamSnap.data()?.claimed_by_manager_id === callerUid;
    const isClubManager = clubSnap.data()?.manager_id === callerUid;
    const isOrganizer = (competition.organizer_ids ?? []).includes(callerUid);
    let isSuperadmin = false;
    if (!isOrganizer) {
      const callerDoc = await adminDb.collection("users").doc(callerUid).get();
      isSuperadmin = callerDoc.exists && estSuperadmin(callerDoc.data());
    }
    if (!((isTeamManager && isClubManager) || isOrganizer || isSuperadmin)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const result = await importClubRoster({ cid, teamId, clubId, competition });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "TEAM_NOT_FOUND" || message === "CLUB_NOT_FOUND") {
      return NextResponse.json({ error: "Équipe ou club introuvable" }, { status: 404 });
    }
    console.error("[club-import POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
