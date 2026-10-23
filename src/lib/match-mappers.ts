// ============================================
// Le match amical, de Firestore à l'application.
//
// Module PARTAGÉ : sans SDK (ni firebase, ni firebase-admin, ni next, ni
// React), il se lit du navigateur, du serveur et de l'application mobile
// (qui résout `@/` vers ce `src/`). lib/firestore le ré-exporte : rien ne
// change pour ses importeurs.
// ============================================

import { lireButeursRenseignes } from "@/lib/buteurs";
import { formatDate } from "@/lib/dates";
import { versPossession } from "@/lib/possession";
import { normaliserPoste } from "@/lib/postes";
import { lireEmplacement } from "@/lib/terrain";
import { reservationDuMatch } from "@/lib/terrains";
import type { EquipeArbitrale, FirestoreEquipeArbitrale, FirestoreMatch, Match, MatchStatus } from "@/types";

/** L'équipe de l'arbitre, en camelCase ; `null` quand il vient seul. */
export function equipeArbitraleLue(e: FirestoreEquipeArbitrale | null | undefined): EquipeArbitrale | null {
  if (!e?.corps_id) return null;
  return {
    corpsId: e.corps_id,
    corpsNom: e.corps_nom ?? "",
    assistants: e.assistants ?? [],
    scoreur: e.scoreur ?? null,
  };
}

export function toMatch(id: string, d: FirestoreMatch): Match {
  let effectiveStatus = d.status;

  // Dynamic status check for upcoming matches
  if (d.status === "upcoming" && d.date && d.time) {
    try {
      const matchDate = new Date(`${d.date}T${d.time}`);
      const now = new Date();
      if (now > matchDate) {
        effectiveStatus = "delayed";
      }
    } catch {
      console.warn("Invalid date format in match", d.date, d.time);
    }
  }

  return {
    id, homeTeamId: d.home_team_id, awayTeamId: d.away_team_id,
    homeTeamName: d.home_team_name, awayTeamName: d.away_team_name,
    homeTeamLogo: d.home_team_logo ?? null, awayTeamLogo: d.away_team_logo ?? null,
    managerId: d.manager_id, date: d.date, time: d.time,
    venueName: d.venue_name, venueCity: d.venue_city, status: d.status,
    venueId: d.venue_id ?? null,
    venueBooking: reservationDuMatch(d.venue_booking),
    effectiveStatus: effectiveStatus as MatchStatus,
    result: d.result, scoreHome: d.score_home, scoreAway: d.score_away,
    refereeId: d.referee_id, refereeName: d.referee_name,
    refereeStatus: d.referee_status ?? "none", format: d.format,
    isHome: d.is_home, playersConfirmed: d.players_confirmed ?? 0,
    playersTotal: d.players_total ?? 0,
    awayManagerId: d.away_manager_id ?? "",
    moderatorIds: d.moderator_ids ?? [],
    equipeArbitrale: equipeArbitraleLue(d.equipe_arbitrale),
    penaltyHome: d.penalty_home ?? null,
    penaltyAway: d.penalty_away ?? null,
    recordedAt: d.recorded_at ?? null,
    recordedScorers: lireButeursRenseignes(d.recorded_scorers),
    confirmedHome: d.confirmed_home ?? 0,
    confirmedAway: d.confirmed_away ?? 0,
    // La feuille de match, ou son heritage. Voir `FirestoreMatch.home_lineup` :
    // l'ecran de compo d'avant n'ecrivait que le camp hors plateforme, dans
    // `home_ghost_lineup`. Une feuille validee par la console prime.
    homeLineup: (d.home_lineup ?? d.home_ghost_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
      emplacement: lireEmplacement(e.emplacement),
    })),
    awayLineup: (d.away_lineup ?? d.away_ghost_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
      emplacement: lireEmplacement(e.emplacement),
    })),
    homeLineupReady: d.home_lineup_ready ?? false,
    homeFormation: d.home_formation ?? null,
    awayFormation: d.away_formation ?? null,
    awayLineupReady: d.away_lineup_ready ?? false,
    homeOnPitch: d.home_on_pitch ?? [],
    awayOnPitch: d.away_on_pitch ?? [],
    // Repli sur `ghost_lineup` pour les matchs créés avant les champs par
    // camp : ce champ-là ne concernait que l'adversaire hors plateforme, donc
    // le camp opposé à celui du créateur (`is_home`).
    homeGhostLineup: (d.home_ghost_lineup
      ?? (!d.away_manager_id && !d.is_home ? d.ghost_lineup ?? [] : [])
    ).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
      emplacement: lireEmplacement(e.emplacement),
    })),
    awayGhostLineup: (d.away_ghost_lineup
      ?? (!d.away_manager_id && d.is_home ? d.ghost_lineup ?? [] : [])
    ).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      userId: e.user_id ?? null,
      position: normaliserPoste(e.position),
      emplacement: lireEmplacement(e.emplacement),
    })),
    modificationRequest: d.modification_request ? {
      date: d.modification_request.date,
      time: d.modification_request.time,
      venueName: d.modification_request.venue_name,
      venueCity: d.modification_request.venue_city,
      venueId: d.modification_request.venue_id ?? null,
      reason: d.modification_request.reason,
      requestedBy: d.modification_request.requested_by,
    } : null,
    localRefereeName: d.local_referee_name ?? null,
    autoAcceptPlayers: d.auto_accept_players ?? false,
    // La validation n'est plus lue ici : elle vit dans `match_validations`,
    // que seuls les deux camps lisent. Voir onMatchValidation.
    statsCreditedAt: d.stats_credited_at ?? null,
    statsCreditedBy: d.stats_credited_by ?? null,
    completedAt: d.completed_at ?? null,
    liveState: d.live_state ? {
      currentPeriod: d.live_state.current_period,
      timerStartAt: d.live_state.timer_start_at,
      timerOffset: d.live_state.timer_offset,
      isTimerRunning: d.live_state.is_timer_running,
      events: (d.live_state.events || []).map(e => ({
        id: e.id,
        type: e.type,
        period: e.period,
        minute: e.minute,
        teamId: e.team_id,
        playerId: e.player_id,
        playerName: e.player_name,
        detail: e.detail,
        // LE PASSEUR, LA VICTIME ET LE VAR MANQUAIENT ICI. La console les
        // ecrit sur un amical comme sur un match de competition, et ce
        // convertisseur — le seul chemin de lecture d'un amical — les laissait
        // tomber : `setMatchGoalAssist` posait un passeur que rien ne pouvait
        // plus relire. Invisible tant que personne ne les lisait.
        //
        // DEUX TRAVAUX LES ONT RECLAMES EN MEME TEMPS, et chacun de son cote a
        // trouve le meme trou : la liste des candidats au MVP compte les passes
        // decisives, et la note calculee les relit aussi (une passe vaut 0,8,
        // une faute subie credite sa victime).
        assistPlayerId: e.assist_player_id ?? null,
        assistPlayerName: e.assist_player_name ?? null,
        victimPlayerId: e.victim_player_id ?? null,
        victimPlayerName: e.victim_player_name ?? null,
        outPlayerId: e.out_player_id ?? null,
        outPlayerName: e.out_player_name ?? null,
        varStatus: e.var_status ?? null,
        // Meme correction que dans competition-mappers : le type dit
        // `string`, la valeur brute est un `Timestamp`. Ce module ne sert que
        // le client, donc rien ne cassait ici — mais un type qui ment finit
        // toujours par etre cru.
        createdAt: formatDate(e.created_at),
      })),
      possession: d.live_state.possession ? versPossession(d.live_state.possession) : null,
      addedTime: d.live_state.added_time ?? null,
      jeu: d.live_state.jeu ?? null,
      tirsAuBut: d.live_state.tirs_au_but ?? null,
      sansGardien: d.live_state.sans_gardien ?? null,
    } : null,
    mvpPlayerId: d.mvp_player_id ?? null,
    mvpUserId: d.mvp_user_id ?? null,
    mvpPlayerName: d.mvp_player_name ?? null,
    mvpTeamId: d.mvp_team_id ?? null,
    mvpBy: d.mvp_by ?? null,
    mvpAt: d.mvp_at ?? null,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}
