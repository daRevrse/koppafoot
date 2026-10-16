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
 * Organisateurs et modérateurs : ceux qui configurent la compétition, et donc
 * ceux qu'on prévient quand elle demande une décision (une inscription, une
 * revendication de ligne d'effectif).
 */
export function staffDeLaCompetition(competition: FirestoreCompetition): string[] {
  return [...new Set([...(competition.organizer_ids ?? []), ...(competition.moderator_ids ?? [])])];
}

/**
 * Configure CETTE compétition : un organisateur, un modérateur, ou un
 * superadmin. Tout ce qui la prépare passe par ici ; ce qui reste au
 * propriétaire — supprimer, gérer les modérateurs, transférer, l'argent —
 * vérifie `organizer_ids` seul.
 */
export async function peutConfigurer(uid: string, competition: FirestoreCompetition): Promise<boolean> {
  if (staffDeLaCompetition(competition).includes(uid)) return true;
  const callerDoc = await adminDb.collection("users").doc(uid).get();
  return callerDoc.exists && estSuperadmin(callerDoc.data());
}

/**
 * Le propriétaire de CETTE compétition, ou un superadmin : le seul à la
 * supprimer, à gérer ses modérateurs, à la transférer et à toucher à l'argent.
 */
export async function estProprietaire(uid: string, competition: FirestoreCompetition): Promise<boolean> {
  if ((competition.organizer_ids ?? []).includes(uid)) return true;
  const callerDoc = await adminDb.collection("users").doc(uid).get();
  return callerDoc.exists && estSuperadmin(callerDoc.data());
}

/**
 * Verify the caller's Bearer id token, load the competition, and require the
 * caller to organize it (or be a superadmin). Authorization is checked against
 * the server-loaded document, the client's claim about its own role is never
 * trusted.
 *
 * `moderateurs: true` ouvre aussi la route aux modérateurs, pour ce qui
 * configure la compétition (voir `peutConfigurer`). Sans l'option, c'est le
 * niveau propriétaire.
 */
export async function authorizeOrganizer(
  req: NextRequest,
  cid: string,
  { moderateurs = false }: { moderateurs?: boolean } = {},
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

  const autorise = moderateurs
    ? await peutConfigurer(callerUid, competition)
    : await estProprietaire(callerUid, competition);
  if (!autorise) {
    return { error: NextResponse.json({ error: "Accès refusé" }, { status: 403 }) };
  }

  return { callerUid, competition };
}

/**
 * Staff of one competition team: an organizer or a moderator of the
 * competition, the manager of that team, or a superadmin. These are the
 * people who may decide who a roster line belongs to — validate a claim, or
 * undo a link.
 */
export async function isStaffOf(uid: string, cid: string, teamId: string): Promise<boolean> {
  const compSnap = await adminDb.collection("competitions").doc(cid).get();
  if (!compSnap.exists) return false;
  const competition = compSnap.data() as FirestoreCompetition;
  if (staffDeLaCompetition(competition).includes(uid)) return true;

  const teamSnap = await adminDb
    .collection("competitions").doc(cid)
    .collection("comp_teams").doc(teamId)
    .get();
  if (teamSnap.exists && teamSnap.data()?.claimed_by_manager_id === uid) return true;

  const callerDoc = await adminDb.collection("users").doc(uid).get();
  return callerDoc.exists && estSuperadmin(callerDoc.data());
}
