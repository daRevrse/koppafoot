// Server-only. La clôture d'un amical : le coup de sifflet final, et tout ce
// qu'il fait bouger derrière lui.
//
// Ce bloc vivait entier dans /api/matches/complete, sous ses contrôles
// d'autorisation. Il en sort parce que la console n'est pas le seul endroit
// d'où un match se termine : /matches ne propose que « Déplacer » et
// « Annuler » sur un amical upcoming ou live, donc un match joué sans console,
// ou dont personne n'a sifflé la fin, reste ouvert indéfiniment. Le rouvrir
// depuis un script d'exploitation demandait de recopier le rollup, et de le
// voir diverger au premier correctif — la même erreur que les deux consoles.
//
// L'AUTORISATION RESTE À L'APPELANT, et le match lui est déjà chargé : la
// route vérifie manager / arbitre / modérateur / superadmin contre le document
// stocké, un script répond de la main qui le lance. Ce qui est ici, c'est le
// geste, et le verrou anti-double-comptage qui va avec.

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { FirestoreMatch, FirestoreParticipation } from "@/types";

export type ResultatAmical = "win" | "loss" | "draw";

/**
 * `deja-termine` n'est pas une panne : c'est le verrou. Le rollup incrémente
 * des compteurs, donc le passer deux fois gonfle en silence tout ce qu'il
 * touche. L'appelant décide de ce qu'il en dit (409 pour la route, une ligne
 * de sortie pour un script).
 */
export type Cloture =
  | { ok: true; result: ResultatAmical }
  | { ok: false; raison: "deja-termine" };

/** Ce que le score et la couverture du match décident, avant toute écriture. */
export interface ApercuCloture {
  /** Le résultat vu de l'équipe à domicile. */
  result: ResultatAmical;
  /** Adversaire hors plateforme : personne en face pour contresigner. */
  horsPlateforme: boolean;
  /** Le camp qui ne cumule rien, quand il y en a un. */
  equipeFantomeId: string | null;
  couvertEnDirect: boolean;
  /** Les carrières bougent-elles, ou seulement les feuilles de match ? */
  crediterLesJoueurs: boolean;
}

/**
 * Lire ce que la clôture fera, sans la faire.
 *
 * `cloturerAmical` s'en sert pour écrire, un script d'exploitation pour
 * annoncer ce qu'il s'apprête à écrire : la décision ne se calcule qu'une
 * fois, donc l'aperçu ne peut pas mentir sur le geste.
 */
export function apercuCloture(match: FirestoreMatch): ApercuCloture {
  const scoreHome = match.score_home ?? 0;
  const scoreAway = match.score_away ?? 0;
  const result: ResultatAmical =
    scoreHome > scoreAway ? "win" : scoreHome < scoreAway ? "loss" : "draw";

  // Adversaire hors plateforme : personne en face pour contresigner.
  const horsPlateforme = !match.away_manager_id;

  // L'ÉQUIPE FANTÔME NE CUMULE RIEN, ni bilan de club ni statistiques de
  // joueurs : c'est l'adversaire du jeu vidéo. Elle existe pour qu'on puisse
  // jouer contre quelqu'un, pas pour tenir un palmarès que son seul adversaire
  // aurait saisi. `is_home` dit si le CRÉATEUR joue à domicile, donc l'équipe
  // fantôme est celle de l'autre côté.
  const equipeFantomeId = horsPlateforme
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

  return {
    result,
    horsPlateforme,
    equipeFantomeId,
    couvertEnDirect,
    crediterLesJoueurs: !horsPlateforme || couvertEnDirect,
  };
}

/**
 * Terminer un amical et cumuler ses statistiques.
 *
 * Le score n'est pas discuté : `score_home` / `score_away` du document font
 * foi, et le résultat W/N/D en découle. Lève si le batch échoue.
 */
export async function cloturerAmical(
  matchId: string,
  match: FirestoreMatch,
  parUid: string,
): Promise<Cloture> {
  if (match.status === "completed") {
    return { ok: false, raison: "deja-termine" };
  }

  const matchRef = adminDb.collection("matches").doc(matchId);

  const {
    result: homeResult, horsPlateforme: isGhostMatch,
    equipeFantomeId: ghostTeamId, couvertEnDirect, crediterLesJoueurs,
  } = apercuCloture(match);
  const awayResult = homeResult === "win" ? "loss" : homeResult === "loss" ? "win" : "draw";

  const batch = adminDb.batch();

  const teamUpdate = (result: ResultatAmical) => ({
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
      ? { stats_credited_at: FieldValue.serverTimestamp(), stats_credited_by: parUid }
      : {}),
  });

  await batch.commit();

  return { ok: true, result: homeResult };
}
