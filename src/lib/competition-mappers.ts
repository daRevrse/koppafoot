// ============================================
// Competition converters (SDK-agnostic, pure)
//
// These map Firestore snake_case docs -> camelCase domain objects. They are
// intentionally free of any Firebase SDK import (no web SDK, no admin SDK) so
// both the client lib (competition-firestore.ts, web SDK) and the server lib
// (competition-admin.ts, firebase-admin) can share them. Output is always a
// plain serializable object (ISO string dates) — safe to pass server->client.
// ============================================

import type {
  Competition, FirestoreCompetition,
  CompTeam, FirestoreCompTeam,
  CompMatch, FirestoreCompMatch,
} from "@/types";

type FirestoreDate = string | { seconds?: number; toDate?: () => Date } | null | undefined;

/**
 * Convert Firestore dates (string or Timestamp, web or admin) to ISO string.
 */
export function formatDate(date: FirestoreDate): string {
  if (!date) return new Date().toISOString();
  if (typeof date === "string") return date;
  // Handle Firestore serverTimestamp placeholder (no toDate or seconds on first snapshot)
  if (!date.seconds && !date.toDate) return new Date().toISOString();
  if (typeof date.toDate === "function") return date.toDate().toISOString();
  if (date.seconds) return new Date(date.seconds * 1000).toISOString();
  return new Date().toISOString();
}

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
    format: d.format,
    startDate: d.start_date,
    endDate: d.end_date,
    venueCity: d.venue_city,
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
    feedsIntoMatchId: d.feeds_into_match_id,
    feedsIntoSlot: d.feeds_into_slot,
    homeLineup: (d.home_lineup ?? []).map((e) => ({ playerId: e.player_id, name: e.name, number: e.number, role: e.role })),
    awayLineup: (d.away_lineup ?? []).map((e) => ({ playerId: e.player_id, name: e.name, number: e.number, role: e.role })),
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
        contestedByManagerId: e.contested_by_manager_id,
        contestationReason: e.contestation_reason,
        createdAt: e.created_at,
      })),
    } : null,
    createdAt: formatDate(d.created_at),
    updatedAt: formatDate(d.updated_at),
  };
}
