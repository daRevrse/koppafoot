import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import { cloturerAmical } from "@/lib/match-cloture";
import type { FirestoreMatch } from "@/types";
import { estSuperadmin } from "@/lib/admin-api-auth";

/**
 * End-of-match stats rollup.
 *
 * This used to run in the browser: the client batched increments onto the two
 * `teams` documents and every participating player's `users` document. Firestore
 * rules cannot express "you may increment these counters, but only as the result
 * of a match you actually played", so they settled for "any signed-in user may
 * write these fields on any document", which let anyone rewrite anyone's career
 * stats or any club's record. The rollup lives here instead, and those rule
 * branches are gone.
 *
 * POST { matchId }, complete the match and roll its stats up.
 *
 * Authorization: either manager, the confirmed referee, or a superadmin. The
 * match document is loaded server-side; the caller's claim about their own role
 * is never trusted.
 *
 * Le rollup lui-même est parti dans lib/match-cloture : cette route en est
 * l'entrée depuis la console, pas la seule. Ce qui reste ici, c'est ce qui
 * n'appartient qu'à une requête HTTP — le jeton, et le droit de siffler.
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

  const { matchId } = (await req.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId) {
    return NextResponse.json({ error: "matchId requis" }, { status: 400 });
  }

  const matchSnap = await adminDb.collection("matches").doc(matchId).get();
  if (!matchSnap.exists) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  const match = matchSnap.data() as FirestoreMatch;

  // Authorization, against the stored document.
  // Le staff délégué d'une des deux équipes termine un match comme son
  // manager : c'est le même geste, et il se fait au bord du terrain par qui
  // s'y trouve. Les deux lectures ne partent que si les deux comparaisons
  // directes ont échoué.
  const isManager =
    match.manager_id === callerUid ||
    match.away_manager_id === callerUid ||
    (await peutGererEquipeServeur(match.home_team_id, callerUid)) ||
    (await peutGererEquipeServeur(match.away_team_id, callerUid));
  const isReferee = match.referee_id === callerUid && match.referee_status === "confirmed";
  // Celui qui a couvert le match le siffle. Le coup de sifflet final fait
  // partie de la couverture : demander au manager de venir cliquer derrière
  // laisserait un match live ouvert jusqu'à ce qu'il y pense.
  const isModerateur = (match.moderator_ids ?? []).includes(callerUid);
  let isSuperadmin = false;
  if (!isManager && !isReferee && !isModerateur) {
    const caller = await adminDb.collection("users").doc(callerUid).get();
    isSuperadmin = caller.exists && estSuperadmin(caller.data());
  }
  if (!isManager && !isReferee && !isModerateur && !isSuperadmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // The rollup increments counters, so running it twice silently inflates every
  // stat it touches. The client had no guard at all, a double-tap or a retry
  // counted the match twice. Le verrou est dans `cloturerAmical`, qui rend
  // « deja-termine » sans rien écrire.
  let cloture;
  try {
    cloture = await cloturerAmical(matchId, match, callerUid);
  } catch (err) {
    console.error("match rollup failed:", err);
    return NextResponse.json({ error: "Le rollup a échoué" }, { status: 500 });
  }

  if (!cloture.ok) {
    return NextResponse.json({ error: "Match déjà terminé" }, { status: 409 });
  }

  return NextResponse.json({ ok: true, result: cloture.result });
}
