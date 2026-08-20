import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { FirestoreMatch, FirestoreParticipation } from "@/types";

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

  const matchRef = adminDb.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }
  const match = matchSnap.data() as FirestoreMatch;

  // Authorization, against the stored document.
  const isManager = match.manager_id === callerUid || match.away_manager_id === callerUid;
  const isReferee = match.referee_id === callerUid && match.referee_status === "confirmed";
  let isSuperadmin = false;
  if (!isManager && !isReferee) {
    const caller = await adminDb.collection("users").doc(callerUid).get();
    isSuperadmin = caller.exists && caller.data()?.user_type === "superadmin";
  }
  if (!isManager && !isReferee && !isSuperadmin) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // The rollup increments counters, so running it twice silently inflates every
  // stat it touches. The client had no guard at all, a double-tap or a retry
  // counted the match twice.
  if (match.status === "completed") {
    return NextResponse.json({ error: "Match déjà terminé" }, { status: 409 });
  }

  const scoreHome = match.score_home ?? 0;
  const scoreAway = match.score_away ?? 0;
  const homeResult = scoreHome > scoreAway ? "win" : scoreHome < scoreAway ? "loss" : "draw";
  const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw";

  // Off-platform opponent: no manager on the other side to counter-sign, so the
  // result stands for club history but stays out of player counters.
  const isGhostMatch = !match.away_manager_id;

  const batch = adminDb.batch();

  const teamUpdate = (result: "win" | "loss" | "draw") => ({
    matches_played: FieldValue.increment(1),
    wins: FieldValue.increment(result === "win" ? 1 : 0),
    losses: FieldValue.increment(result === "loss" ? 1 : 0),
    draws: FieldValue.increment(result === "draw" ? 1 : 0),
    last_match_id: matchId,
    updated_at: FieldValue.serverTimestamp(),
  });

  if (match.home_team_id) {
    batch.update(adminDb.collection("teams").doc(match.home_team_id), teamUpdate(homeResult));
  }
  if (match.away_team_id) {
    batch.update(adminDb.collection("teams").doc(match.away_team_id), teamUpdate(awayResult));
  }

  // Goals come from the live timeline, assists from each player's own sheet.
  const goalsPerPlayer: Record<string, number> = {};
  for (const event of match.live_state?.events ?? []) {
    if (event.type === "goal" && event.player_id) {
      goalsPerPlayer[event.player_id] = (goalsPerPlayer[event.player_id] ?? 0) + 1;
    }
  }

  const partsSnap = await adminDb
    .collection("participations")
    .where("match_id", "==", matchId)
    .get();

  for (const partDoc of partsSnap.docs) {
    const part = partDoc.data() as FirestoreParticipation;
    if (part.status !== "confirmed" || !part.player_id) continue;

    const playerGoals = goalsPerPlayer[part.player_id] ?? 0;

    // The match sheet stays accurate either way; it is the profile-wide counter
    // that a ghost match must not touch.
    batch.update(partDoc.ref, {
      goals: playerGoals,
      updated_at: FieldValue.serverTimestamp(),
    });

    if (isGhostMatch) continue;

    batch.update(adminDb.collection("users").doc(part.player_id), {
      matches_played: FieldValue.increment(1),
      goals: FieldValue.increment(playerGoals),
      assists: FieldValue.increment(part.assists || 0),
      last_match_id: matchId,
      updated_at: FieldValue.serverTimestamp(),
    });
  }

  batch.update(matchRef, {
    status: "completed",
    result: homeResult,
    validation_status: isGhostMatch ? "unverified" : "pending",
    completed_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error("match rollup failed:", err);
    return NextResponse.json({ error: "Le rollup a échoué" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: homeResult });
}
