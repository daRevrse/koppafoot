// ============================================
// Player statistics, aggregated from what the live console actually
// records: lineups and match events. Pure and SDK-agnostic so the player's
// own page and the manager's squad view share one definition.
//
// AMICAUX COMPRIS. Ces fonctions ne lisaient que des `CompMatch`, et « Mes
// statistiques » ne comptait donc que les compétitions : un joueur qui venait
// de faire un amical voyait quatre zéros, sans rien pour lui dire pourquoi.
// Un match joué est un match joué. Les deux collections ne se ressemblent pas,
// mais la feuille et l'horloge, si — c'est tout ce qui est lu ici, d'où
// `MatchJoue` plus bas.
//
// CE QUI NE COMPTE TOUJOURS PAS, ET C'EST VOULU : un match RENSEIGNÉ après
// coup par son manager. Il n'a pas de feuille — `recorded_scorers` est sa
// seule trace de joueurs (voir /api/matches/record), et c'est une saisie, pas
// un constat. Rien ici ne la lit, et rien ne doit la lire. SEUL LE DIRECT
// COMPTE : exiger la feuille de match est la règle elle-même, pas un effet de
// bord de l'implémentation. Une participation confirmée ne la remplace pas
// davantage — dire qu'on vient n'est pas avoir joué.
//
// Note on what is NOT here: assists. The live console records goals, cards
// and substitutions only (`live_state.events.type`), so there is nothing to
// count. Adding them means adding an assist event to the console first.
// ============================================

import { DEFAULT_HALF_DURATION } from "@/lib/competition-format";
import type {
  CompMatch, CompMatchStatus, CompPlayer, LineupEntry, LinkedCompPlayer,
  Match, MatchStatus,
} from "@/types";

/** Le coup de sifflet final quand personne n'a dit mieux : deux mi-temps. */
export const DUREE_MATCH_DEFAUT = DEFAULT_HALF_DURATION * 2;

export interface PlayerStats {
  matchesPlayed: number;
  starts: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  /** Minutes passees sur le terrain. Voir `computeMinutesPlayed`. */
  minutesPlayed: number;
}

export interface PlayerCompetitionStats extends PlayerStats {
  link: LinkedCompPlayer;
}

export const EMPTY_STATS: PlayerStats = {
  matchesPlayed: 0,
  starts: 0,
  goals: 0,
  yellowCards: 0,
  redCards: 0,
  minutesPlayed: 0,
};

/**
 * Ce qu'il faut d'un match pour en tirer des statistiques : la feuille, le
 * tableau d'affichage, et ce que la console a noté.
 *
 * Un amical (`Match`) et une rencontre de compétition (`CompMatch`) portent
 * tous les deux ces champs — sous des types légèrement différents, d'où les
 * unions. Ils vivent dans deux collections qui n'ont rien en commun, et c'est
 * bien la seule chose qui les sépare ici : le joueur qui ouvre son bilan ne
 * fait pas la différence, son bilan ne doit pas la faire non plus.
 */
export interface MatchJoue {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  date: string | null;
  time: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  status: MatchStatus | CompMatchStatus;
  homeLineup: LineupEntry[];
  awayLineup: LineupEntry[];
  /**
   * Qui etait sur la pelouse au coup de sifflet final.
   *
   * La console l'ecrit a chaque changement et ne l'efface pas a la fin : sur
   * un match termine, c'est donc le onze qui a fini. `computeMinutesPlayed`
   * s'en sert pour ne pas crediter un match entier a quelqu'un dont la feuille
   * dit qu'il etait sorti.
   */
  homeOnPitch: string[];
  awayOnPitch: string[];
  liveState?: Match["liveState"];
}

/**
 * La ligne de feuille de ce joueur, quand il y en a une.
 *
 * `playerId` désigne une LIGNE D'EFFECTIF, propre à une équipe : c'est ce que
 * porte la feuille d'une compétition. Sur un amical, la feuille est bâtie
 * depuis les participations, et la ligne est directement le compte du joueur —
 * les deux identifiants s'y confondent. Tester `userId` en plus rattrape le
 * second cas sans rien changer au premier : un identifiant de compte n'est
 * jamais l'identifiant d'une ligne d'effectif.
 */
function ligneDe(lineup: LineupEntry[], playerId: string): LineupEntry | undefined {
  return lineup.find((e) => e.playerId === playerId || e.userId === playerId);
}

/**
 * Stats of one player across a list of matches — those of a competition, or
 * the friendlies they turned out for.
 *
 * A match counts as played when it is completed and the player appears in
 * their team's submitted lineup, a squad member who never made the sheet
 * shouldn't inflate the count. Events are matched on `playerId`, so a goal
 * typed as free text (no player picked in the console) is not attributed.
 */
export function computePlayerStats(
  matches: MatchJoue[],
  teamId: string,
  playerId: string,
  dureeMatchMin: number = DUREE_MATCH_DEFAUT,
): PlayerStats {
  const stats: PlayerStats = { ...EMPTY_STATS };

  for (const match of matches) {
    const isHome = match.homeTeamId === teamId;
    const isAway = match.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const entry = ligneDe(isHome ? match.homeLineup : match.awayLineup, playerId);
    // LA FEUILLE VALIDE LE MATCH, POINT. Être dessus suffit : un remplaçant
    // qui n'est jamais entré a bien un match de plus, et zéro minute. Le
    // couple « 1 match, 0' » est donc juste, et ce n'est pas au temps de jeu
    // de décider ce qui compte comme un match.
    if (match.status === "completed" && entry) {
      stats.matchesPlayed += 1;
      if (entry.role === "starter") stats.starts += 1;
      // Seulement sur un match terminé : les minutes d'une rencontre en cours
      // bougeraient à chaque rafraîchissement, et un bilan de carrière n'est
      // pas un chronomètre.
      stats.minutesPlayed += computeMinutesPlayed(match, teamId, playerId, dureeMatchMin);
    }

    for (const event of match.liveState?.events ?? []) {
      if (event.playerId !== playerId) continue;
      // A goal disallowed by the VAR is off the scoreboard, it must not sit
      // in a player's tally either.
      if (event.type === "goal" && event.varStatus === "cancelled") continue;
      if (event.type === "goal") stats.goals += 1;
      else if (event.type === "yellow_card") stats.yellowCards += 1;
      else if (event.type === "red_card") stats.redCards += 1;
    }
  }

  return stats;
}

/**
 * Les minutes qu'un joueur a passées sur le terrain, sur un match.
 *
 * La feuille dit qui commence, la timeline dit qui entre et qui sort. Les
 * minutes des événements viennent d'une horloge CONTINUE sur tout le match —
 * la console les calcule sur le temps écoulé total, pas sur la mi-temps en
 * cours — donc une seule ligne de temps, de 0 au coup de sifflet.
 *
 * `dureeMatchMin` est le temps réglementaire : un 5v5 en mi-temps de 25
 * minutes ne dure pas 90. Les arrêts de jeu le dépassent, et un but à la 93ᵉ
 * dit que le match a duré 93 minutes : le coup de sifflet est donc le dernier
 * des deux, sans quoi une entrée en jeu après le temps réglementaire
 * produirait un intervalle négatif.
 *
 * UN EXCLU S'ARRÊTE LÀ. Un carton rouge met fin à son match, et il ne rentre
 * pas, même sur un amical où les allers-retours sont permis.
 */
export function computeMinutesPlayed(
  match: MatchJoue,
  teamId: string,
  playerId: string,
  dureeMatchMin: number = DUREE_MATCH_DEFAUT,
): number {
  const isHome = match.homeTeamId === teamId;
  const isAway = match.awayTeamId === teamId;
  if (!isHome && !isAway) return 0;

  const entry = ligneDe(isHome ? match.homeLineup : match.awayLineup, playerId);
  if (!entry) return 0;

  const events = (match.liveState?.events ?? [])
    .filter((e) => typeof e.minute === "number")
    .slice()
    .sort((a, b) => a.minute - b.minute);

  const coupDeSifflet = Math.max(dureeMatchMin, ...events.map((e) => e.minute), 0);
  const borne = (m: number) => Math.min(Math.max(m, 0), coupDeSifflet);

  // `null` : il est sur le banc. Sinon, la minute où il est entré.
  let depuis: number | null = entry.role === "starter" ? 0 : null;
  let total = 0;

  for (const e of events) {
    const minute = borne(e.minute);

    if (e.type === "substitution") {
      if (e.outPlayerId === playerId && depuis !== null) {
        total += minute - depuis;
        depuis = null;
      } else if (e.playerId === playerId && depuis === null) {
        depuis = minute;
      }
      continue;
    }

    if (e.type === "red_card" && e.playerId === playerId && depuis !== null) {
      return Math.max(0, minute - depuis + total);
    }
  }

  if (depuis === null) return Math.max(0, total);

  // Il est encore sur la pelouse à la fin de la timeline — sauf si la feuille
  // dit le contraire. UN REMPLACEMENT ÉCRIT AVANT `out_player_id` NE DATE PAS
  // SA SORTIE : on sait par `onPitch` qu'il n'y était plus au coup de sifflet,
  // pas quand il est parti. Lui créditer le match entier serait faux et
  // invisible ; on arrête sa montre au dernier changement de son équipe, le
  // dernier moment daté où il a pu sortir.
  const surLaPelouse = isHome ? match.homeOnPitch : match.awayOnPitch;
  if (surLaPelouse.length > 0 && !surLaPelouse.includes(playerId)) {
    const dernierChangement = events
      .filter((e) => e.type === "substitution" && e.teamId === teamId && borne(e.minute) >= depuis)
      .pop();
    return Math.max(0, total + (dernierChangement ? borne(dernierChangement.minute) - depuis : 0));
  }

  return Math.max(0, total + coupDeSifflet - depuis);
}

export interface PlayerAppearance {
  match: MatchJoue;
  role: "starter" | "substitute";
  goals: number;
  yellowCards: number;
  redCards: number;
  /** Minutes jouées sur CE match. Voir `computeMinutesPlayed`. */
  minutes: number;
}

/**
 * Match-by-match record for one roster line, most recent first.
 *
 * Totals answer "how good a season", this answers "what did I do last
 * Saturday", which is the question a player actually opens the app with.
 * Only completed matches the player was on the sheet for are returned.
 */
export function computeAppearances(
  matches: MatchJoue[],
  teamId: string,
  playerId: string,
  dureeMatchMin: number = DUREE_MATCH_DEFAUT,
): PlayerAppearance[] {
  const out: PlayerAppearance[] = [];

  for (const match of matches) {
    if (match.status !== "completed") continue;
    const isHome = match.homeTeamId === teamId;
    const isAway = match.awayTeamId === teamId;
    if (!isHome && !isAway) continue;

    const entry = ligneDe(isHome ? match.homeLineup : match.awayLineup, playerId);
    if (!entry) continue;

    const events = (match.liveState?.events ?? []).filter((e) => e.playerId === playerId);
    out.push({
      match,
      role: entry.role,
      goals: events.filter((e) => e.type === "goal" && e.varStatus !== "cancelled").length,
      yellowCards: events.filter((e) => e.type === "yellow_card").length,
      redCards: events.filter((e) => e.type === "red_card").length,
      minutes: computeMinutesPlayed(match, teamId, playerId, dureeMatchMin),
    });
  }

  return out.sort((a, b) =>
    `${b.match.date ?? ""}T${b.match.time ?? ""}`.localeCompare(
      `${a.match.date ?? ""}T${a.match.time ?? ""}`,
    ),
  );
}

/** Same, for every linked roster line of a team at once. */
export function computeSquadStats(
  matches: CompMatch[],
  teamId: string,
  players: CompPlayer[],
  dureeMatchMin: number = DUREE_MATCH_DEFAUT,
): { player: CompPlayer; stats: PlayerStats }[] {
  return players
    .map((player) => ({ player, stats: computePlayerStats(matches, teamId, player.id, dureeMatchMin) }))
    .sort(
      (a, b) =>
        b.stats.goals - a.stats.goals ||
        b.stats.matchesPlayed - a.stats.matchesPlayed ||
        a.player.name.localeCompare(b.player.name),
    );
}

/** Adds up per-competition stats into a career total. */
export function totalStats(rows: PlayerStats[]): PlayerStats {
  return rows.reduce<PlayerStats>(
    (acc, r) => ({
      matchesPlayed: acc.matchesPlayed + r.matchesPlayed,
      starts: acc.starts + r.starts,
      goals: acc.goals + r.goals,
      yellowCards: acc.yellowCards + r.yellowCards,
      redCards: acc.redCards + r.redCards,
      minutesPlayed: acc.minutesPlayed + r.minutesPlayed,
    }),
    { ...EMPTY_STATS },
  );
}
