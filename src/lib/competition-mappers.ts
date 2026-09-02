// ============================================
// Competition converters (SDK-agnostic, pure)
//
// These map Firestore snake_case docs -> camelCase domain objects. They are
// intentionally free of any Firebase SDK import (no web SDK, no admin SDK) so
// both the client lib (competition-firestore.ts, web SDK) and the server lib
// (competition-admin.ts, firebase-admin) can share them. Output is always a
// plain serializable object (ISO string dates), safe to pass server->client.
// ============================================

import { normaliserPoste } from "@/lib/postes";
import type {
  Competition, FirestoreCompetition,
  CompTeam, FirestoreCompTeam,
  CompMatch, FirestoreCompMatch,
} from "@/types";

// Moved to lib/dates.ts, every read path needs it, not just competitions.
// Re-exported so existing importers keep working.
import { formatDate } from "./dates";
export { formatDate };

export function toCompetition(id: string, d: FirestoreCompetition): Competition {
  return {
    id,
    name: d.name,
    slug: d.slug,
    description: d.description,
    logoUrl: d.logo_url,
    bannerUrl: d.banner_url,
    organizerIds: d.organizer_ids ?? [],
    moderatorIds: d.moderator_ids ?? [],
    createdBy: d.created_by,
    status: d.status,
    isValidated: d.is_validated ?? true,
    // Pre-dates competition types: every existing competition is a group
    // stage feeding a bracket.
    competitionType: d.competition_type ?? "groups_knockout",
    isSandbox: d.is_sandbox ?? false,
    // Absent des compétitions créées avant le champ, rien ne s'affiche alors.
    organizerName: d.organizer_name ?? null,
    format: d.format,
    startDate: d.start_date,
    endDate: d.end_date,
    venueCity: d.venue_city,
    // Entry file, absent on every competition created before it existed,
    // which is exactly the "asks for nothing" default.
    rulesText: d.rules_text ?? null,
    rulesUrl: d.rules_url ?? null,
    requireRulesAcceptance: d.require_rules_acceptance ?? false,
    entryFee: d.entry_fee ?? null,
    entryFeeCurrency: d.entry_fee_currency ?? "FCFA",
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export function toCompTeam(id: string, competitionId: string, d: FirestoreCompTeam): CompTeam {
  return {
    id,
    competitionId,
    name: d.name,
    shortName: d.short_name,
    logoUrl: d.logo_url,
    color: d.color,
    group: d.group,
    players: d.players ?? [],
    claimedByManagerId: d.claimed_by_manager_id ?? null,
    claimedByTeamId: d.claimed_by_team_id ?? null,
    disqualified: d.disqualified ?? false,
    disqualifiedAt: d.disqualified_at ?? null,
    disqualifiedReason: d.disqualified_reason ?? null,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}

export function toCompMatch(id: string, d: FirestoreCompMatch): CompMatch {
  return {
    id,
    competitionId: d.competition_id,
    stage: d.stage,
    group: d.group,
    round: d.round,
    bracketSlot: d.bracket_slot,
    homeSource: d.home_source ?? null,
    awaySource: d.away_source ?? null,
    homeTeamId: d.home_team_id,
    awayTeamId: d.away_team_id,
    homeTeamName: d.home_team_name,
    awayTeamName: d.away_team_name,
    homeTeamLogo: d.home_team_logo,
    awayTeamLogo: d.away_team_logo,
    bannerUrl: d.banner_url ?? null,
    date: d.date,
    time: d.time,
    venueName: d.venue_name,
    venueCity: d.venue_city,
    status: d.status,
    scoreHome: d.score_home,
    scoreAway: d.score_away,
    penaltyHome: d.penalty_home,
    penaltyAway: d.penalty_away,
    winnerTeamId: d.winner_team_id,
    forfeitByTeamId: d.forfeit_by_team_id ?? null,
    feedsIntoMatchId: d.feeds_into_match_id,
    feedsIntoSlot: d.feeds_into_slot,
    homeLineup: (d.home_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      // Normalise a la lecture : les lignes d'effectif portent le poste
      // en trois orthographes (voir lib/postes), les feuilles aussi.
      position: normaliserPoste(e.position),
    })),
    awayLineup: (d.away_lineup ?? []).map((e) => ({
      playerId: e.player_id, name: e.name, number: e.number, role: e.role,
      // Normalise a la lecture : les lignes d'effectif portent le poste
      // en trois orthographes (voir lib/postes), les feuilles aussi.
      position: normaliserPoste(e.position),
    })),
    homeLineupReady: d.home_lineup_ready ?? false,
    awayLineupReady: d.away_lineup_ready ?? false,
    homeOnPitch: d.home_on_pitch ?? [],
    awayOnPitch: d.away_on_pitch ?? [],
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
        assistPlayerId: e.assist_player_id ?? null,
        assistPlayerName: e.assist_player_name ?? null,
        victimPlayerId: e.victim_player_id ?? null,
        victimPlayerName: e.victim_player_name ?? null,
        contestedByManagerId: e.contested_by_manager_id,
        contestationReason: e.contestation_reason,
        varStatus: e.var_status ?? null,
        createdAt: e.created_at,
      })),
    } : null,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}
