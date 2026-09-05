import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import type { FirestoreMatch, FirestoreParticipation } from "@/types";
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
  // counted the match twice.
  if (match.status === "completed") {
    return NextResponse.json({ error: "Match déjà terminé" }, { status: 409 });
  }

  const scoreHome = match.score_home ?? 0;
  const scoreAway = match.score_away ?? 0;
  const homeResult = scoreHome > scoreAway ? "win" : scoreHome < scoreAway ? "loss" : "draw";
  const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw";

  // Adversaire hors plateforme : personne en face pour contresigner.
  const isGhostMatch = !match.away_manager_id;

  // L'ÉQUIPE FANTÔME NE CUMULE RIEN, ni bilan de club ni statistiques de
  // joueurs : c'est l'adversaire du jeu vidéo. Elle existe pour qu'on puisse
  // jouer contre quelqu'un, pas pour tenir un palmarès que son seul adversaire
  // aurait saisi. `is_home` dit si le CRÉATEUR joue à domicile, donc l'équipe
  // fantôme est celle de l'autre côté.
  const ghostTeamId = isGhostMatch
    ? (match.is_home ? match.away_team_id : match.home_team_id)
    : null;

  // LE DIRECT VAUT CONSTAT. Un match couvert en live a vu ses buts saisis
  // minute par minute, à chaud, par quelqu'un qui le regardait : les
  // statistiques des joueurs de la vraie équipe peuvent partir seules. Sans
  // couverture live, il n'y a rien d'autre qu'une feuille remplie après coup —
  // celle-là s'attribue à la main, en connaissance de cause, voir
  // /api/matches/credit-stats.
  const couvertEnDirect =
    !!match.live_state &&
    ((match.live_state.events?.length ?? 0) > 0 ||
     (match.live_state.current_period ?? 0) > 0);

  const crediterLesJoueurs = !isGhostMatch || couvertEnDirect;

  const batch = adminDb.batch();

  const teamUpdate = (result: "win" | "loss" | "draw") => ({
    matches_played: FieldValue.increment(1),
    wins: FieldValue.increment(result === "win" ? 1 : 0),
    losses: FieldValue.increment(result === "loss" ? 1 : 0),
    draws: FieldValue.increment(result === "draw" ? 1 : 0),
    last_match_id: matchId,
    updated_at: FieldValue.serverTimestamp(),
  });

  if (match.home_team_id && match.home_team_id !== ghostTeamId) {
    batch.update(adminDb.collection("teams").doc(match.home_team_id), teamUpdate(homeResult));
  }
  if (match.away_team_id && match.away_team_id !== ghostTeamId) {
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

    // La feuille de match reste juste dans tous les cas : c'est le compteur de
    // carrière, sur le profil, qui attend une couverture live ou la décision
    // du manager.
    batch.update(partDoc.ref, {
      goals: playerGoals,
      updated_at: FieldValue.serverTimestamp(),
    });

    if (!crediterLesJoueurs) continue;

    batch.update(adminDb.collection("users").doc(part.player_id), {
      matches_played: FieldValue.increment(1),
      goals: FieldValue.increment(playerGoals),
      assists: FieldValue.increment(part.assists || 0),
      last_match_id: matchId,
      updated_at: FieldValue.serverTimestamp(),
    });
  }

  // ------------------------------------------------------------------
  // Les joueurs SANS COMPTE de la vraie équipe.
  //
  // Ils n'ont pas de document `participations` — c'est leur définition — donc
  // la boucle ci-dessus ne les voit pas. Leur feuille de match est
  // dénormalisée sur le match (`home_ghost_lineup` / `away_ghost_lineup`) et
  // leur carrière vit sur `teams/{id}/ghost_players`.
  //
  // MÊMES CONDITIONS QUE LES COMPTES : `crediterLesJoueurs`, donc le direct
  // vaut constat et un match non couvert attend la décision du manager. Un
  // joueur sans smartphone n'a pas à être moins bien traité, ni mieux.
  //
  // L'ÉQUIPE FANTÔME EST EXCLUE : ses « Joueur 1 » à « Joueur 11 » ne tiennent
  // aucune carrière, pour la même raison que le club lui-même n'en tient pas.
  if (crediterLesJoueurs) {
    const camps: { teamId: string | undefined; entries: unknown }[] = [
      { teamId: match.home_team_id, entries: match.home_ghost_lineup },
      { teamId: match.away_team_id, entries: match.away_ghost_lineup },
    ];
    for (const camp of camps) {
      if (!camp.teamId || camp.teamId === ghostTeamId) continue;
      const lignes = Array.isArray(camp.entries) ? camp.entries : [];
      for (const ligne of lignes as { player_id?: string; role?: string }[]) {
        if (!ligne.player_id) continue;
        const buts = goalsPerPlayer[ligne.player_id] ?? 0;
        batch.update(
          adminDb.collection("teams").doc(camp.teamId).collection("ghost_players").doc(ligne.player_id),
          {
            matches_played: FieldValue.increment(1),
            goals: FieldValue.increment(buts),
            updated_at: FieldValue.serverTimestamp(),
          },
        );
      }
    }
  }

  batch.update(matchRef, {
    status: "completed",
    result: homeResult,
    validation_status: isGhostMatch ? "unverified" : "pending",
    completed_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
    // Le verrou anti-double-comptage se pose ici aussi : un amical crédité par
    // le direct ne doit plus pouvoir l'être une seconde fois à la main.
    ...(isGhostMatch && couvertEnDirect
      ? { stats_credited_at: FieldValue.serverTimestamp(), stats_credited_by: callerUid }
      : {}),
  });

  try {
    await batch.commit();
  } catch (err) {
    console.error("match rollup failed:", err);
    return NextResponse.json({ error: "Le rollup a échoué" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: homeResult });
}
