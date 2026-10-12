import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { FirestoreCompetition } from "@/types";
import { estSuperadmin } from "@/lib/admin-api-auth";

// ============================================
// Shared authorization for the competition API routes
//
// Every staff route needs the same three steps, and getting one of them wrong
// would hand a stranger the live console, so they live in one place.
// ============================================

export type OrganizerAuthResult =
  | { error: NextResponse }
  | { callerUid: string; competition: FirestoreCompetition };

/**
 * Verify the caller's Bearer id token, load the competition, and require the
 * caller to organize it (or be a superadmin). Authorization is checked against
 * the server-loaded document, the client's claim about its own role is never
 * trusted.
 */
export async function authorizeOrganizer(
  req: NextRequest,
  cid: string,
): Promise<OrganizerAuthResult> {
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
    isSuperadmin = callerDoc.exists && estSuperadmin(callerDoc.data());
  }
  if (!isOrganizer && !isSuperadmin) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { callerUid, competition };
}

/**
 * Staff of one competition team: an organizer of the competition, the manager
 * of that team, or a superadmin. These are the people who may decide who a
 * roster line belongs to — validate a claim, or undo a link.
 */
export async function isStaffOf(uid: string, cid: string, teamId: string): Promise<boolean> {
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
  return callerDoc.exists && estSuperadmin(callerDoc.data());
}
