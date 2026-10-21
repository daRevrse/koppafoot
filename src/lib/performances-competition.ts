import { estLigneDossard } from "@/lib/dossards";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { estExhibition } from "@/lib/exhibition";
import type { CompMatch, CompTeam } from "@/types";

// Les performances d'une compétition : qui marque, qui fait marquer, quelles
// équipes tiennent la forme. Pures, sans SDK : la page du site
// (CompetitionRail, l'onglet Buteurs) et l'application les partagent. Le
// soulier d'or vient de lib/competition-firestore, le reste du rail du site.

export interface TopScorer {
  playerName: string;
  teamId: string;
  goals: number;
}

/**
 * Aggregate goal counts per (player, team) across all matches' live events.
 *
 * Dedup key prefers `playerId`: a goal with `playerId` keys on
 * `${teamId}::id:${playerId}`, falling back to `${teamId}::name:${lowercased
 * trimmed name}` for legacy events that only carry a free-text `playerName`.
 * This keeps name-only events working while new player-linked events dedupe
 * correctly per player (even across name spelling/casing). Goals with neither a
 * `playerId` nor a non-empty trimmed `playerName` are anonymous and not ranked,
 * and own goals (`detail === OWN_GOAL_DETAIL`) are excluded entirely.
 * The first-seen original casing of `playerName` is kept for display. Results
 * are ordered by goals desc, then name asc.
 */
export function computeTopScorers(matches: CompMatch[]): TopScorer[] {
  const byKey = new Map<string, TopScorer>();

  for (const match of matches) {
    // Un but de match d'exhibition ne fait pas un buteur du tournoi.
    if (estExhibition(match)) continue;
    const events = match.liveState?.events ?? [];
    for (const event of events) {
      if (event.type !== "goal") continue;
      // A goal the VAR took away never happened, for the scoreboard and for
      // the golden boot alike.
      if (event.varStatus === "cancelled") continue;
      // An own goal counts on the scoreboard for `teamId`, but the player who
      // scored it plays for the other side, crediting them here would rank
      // them under an opponent's colours. Not a scorer.
      if (event.detail === OWN_GOAL_DETAIL) continue;
      // Un dossard que personne n'a nommé n'est personne : « N°9 »
      // en tête du classement des buteurs ne nommerait aucun joueur (voir
      // lib/dossards). Ses buts y entrent dès qu'on le nomme.
      if (estLigneDossard(event.playerId)) continue;

      const name = (event.playerName ?? "").trim();
      let key: string;
      if (event.playerId) {
        key = `${event.teamId}::id:${event.playerId}`;
      } else if (name !== "") {
        key = `${event.teamId}::name:${name.toLowerCase()}`;
      } else {
        continue; // anonymous goal
      }

      const existing = byKey.get(key);
      if (existing) existing.goals += 1;
      else byKey.set(key, { playerName: name, teamId: event.teamId, goals: 1 });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName),
  );
}

export interface Assister {
  playerName: string;
  teamId: string;
  assists: number;
}

/**
 * Les passeurs, comptés sur les mêmes événements que les buteurs.
 *
 * Réserve honnête : la passe décisive est une donnée récente de la console.
 * Un but saisi avant qu'elle existe n'en porte pas, ce classement est donc
 * partiel par construction, et le restera pour les compétitions passées.
 */
export function computeTopAssisters(matches: CompMatch[]): Assister[] {
  const byKey = new Map<string, Assister>();

  for (const match of matches) {
    for (const event of match.liveState?.events ?? []) {
      if (event.type !== "goal") continue;
      // Un but annulé par la vidéo n'a jamais eu lieu, passe comprise.
      if (event.varStatus === "cancelled") continue;
      // Un dossard que personne n'a nommé n'est personne (lib/dossards) :
      // « N°10 » en tête des passeurs ne nommerait aucun joueur.
      if (estLigneDossard(event.assistPlayerId)) continue;
      const name = event.assistPlayerName?.trim();
      if (!name) continue;

      const key = `${name.toLowerCase()}::${event.teamId}`;
      const row = byKey.get(key);
      if (row) row.assists += 1;
      else byKey.set(key, { playerName: name, teamId: event.teamId, assists: 1 });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.assists - a.assists || a.playerName.localeCompare(b.playerName),
  );
}

export type ResultatDeForme = "W" | "D" | "L";

export interface FormeDEquipe {
  team: CompTeam;
  results: ResultatDeForme[];
}

/** Les cinq derniers résultats de chaque équipe, le plus récent à droite. */
export function computeForm(matches: CompMatch[], teams: CompTeam[]): FormeDEquipe[] {
  const played = matches
    .filter((m) => m.status === "completed" && m.scoreHome !== null && m.scoreAway !== null)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const byTeam = new Map<string, ResultatDeForme[]>();
  for (const m of played) {
    const hs = m.scoreHome as number;
    const as = m.scoreAway as number;
    const push = (id: string | null, own: number, other: number) => {
      if (!id) return;
      const list = byTeam.get(id) ?? [];
      list.push(own > other ? "W" : own < other ? "L" : "D");
      byTeam.set(id, list);
    };
    push(m.homeTeamId, hs, as);
    push(m.awayTeamId, as, hs);
  }

  return teams
    .map((team) => ({ team, results: (byTeam.get(team.id) ?? []).slice(-5) }))
    .filter((f) => f.results.length > 0)
    // Le plus en forme d'abord : trois points la victoire, un le nul.
    .sort((a, b) => score(b.results) - score(a.results) || b.results.length - a.results.length);
}

const score = (rs: ResultatDeForme[]) => rs.reduce((n, r) => n + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);
