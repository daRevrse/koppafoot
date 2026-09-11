// ============================================
// L'homme du match : qui la console propose, et dans quel ordre.
//
// ELLE PROPOSE, ELLE NE DÉCIDE PAS. Le scoreur tranche au coup de sifflet, et
// c'est tout l'intérêt du dispositif : aucun barème n'a à être juste, il n'a
// qu'à faire remonter les bons noms en haut d'une liste de trois. On peut donc
// changer ces poids sans rien recalculer et sans devoir les défendre.
//
// Ce qui NE SE MESURE PAS reste hors du calcul : l'impact d'un joueur sur une
// rencontre ne se déduit ni des buts ni des arrêts, et c'est précisément
// pourquoi un humain garde la main. Un but se compte, un match se juge.
//
// Pur et sans SDK, comme player-stats, pour que la console et n'importe quel
// écran s'en servent sans dupliquer la règle.
// ============================================

import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { computeMinutesPlayed, computePlayerStats, type MatchJoue } from "@/lib/player-stats";

/** Un joueur proposé au scoreur, avec de quoi comprendre pourquoi. */
export interface CandidatMVP {
  /** La ligne de feuille : uid sur un amical, ligne d'effectif en compétition. */
  playerId: string;
  /** Le compte derrière, quand il y en a un. Voir `FirestoreMatch.mvp_user_id`. */
  userId: string | null;
  name: string;
  teamId: string;
  cote: "home" | "away";
  score: number;
  /** « 2 buts · 1 passe · a gagné », à afficher sous le nom. */
  motif: string;
  /** Expulsé : hors de la liste proposée, jamais hors du choix du scoreur. */
  exclu: boolean;
}

/**
 * Les poids. Grossiers À DESSEIN — voir l'en-tête : ils ordonnent un affichage,
 * ils ne décernent rien.
 *
 * La victoire ne pèse qu'un point : l'homme du match peut venir de l'équipe
 * battue, et c'est souvent le gardien qui a tout arrêté. Elle départage deux
 * joueurs à égalité, elle ne filtre pas.
 */
const POIDS = {
  but: 3,
  passe: 2,
  arret: 1,
  fauteSubie: 0.5,
  jaune: -0.5,
  victoire: 1,
  nul: 0.5,
} as const;

/** « 2 buts », « 1 passe » — le pluriel, sans y penser à chaque appel. */
function morceau(n: number, singulier: string, pluriel = `${singulier}s`): string | null {
  if (n <= 0) return null;
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/**
 * Les candidats d'un match, du plus proposé au moins proposé.
 *
 * `campsEligibles` vient du pilote : une compétition ouvre les deux feuilles,
 * un amical écarte le camp hors plateforme — ses « Joueur 1 » à « Joueur 11 »
 * ne sont personne, pour la même raison que ce club-là ne tient aucun bilan.
 *
 * Un joueur sans compte d'une VRAIE équipe reste candidat : c'est quelqu'un,
 * il est sur la feuille, il a pu marquer.
 */
export function classerCandidatsMVP(
  match: MatchJoue,
  campsEligibles: { home: boolean; away: boolean },
  dureeMatchMin?: number,
): CandidatMVP[] {
  const events = match.liveState?.events ?? [];
  const scoreHome = match.scoreHome ?? 0;
  const scoreAway = match.scoreAway ?? 0;

  const candidats: CandidatMVP[] = [];

  for (const cote of ["home", "away"] as const) {
    if (!campsEligibles[cote]) continue;
    const teamId = (cote === "home" ? match.homeTeamId : match.awayTeamId) ?? "";
    if (!teamId) continue;

    const lineup = cote === "home" ? match.homeLineup : match.awayLineup;
    const mien = cote === "home" ? scoreHome : scoreAway;
    const sien = cote === "home" ? scoreAway : scoreHome;

    for (const entry of lineup) {
      const siens = events.filter((e) => e.playerId === entry.playerId);

      // Un csc ne compte pas pour son auteur, et un but refusé par le VAR
      // n'est sur le tableau d'affichage de personne. Même règle que les
      // statistiques du joueur, pour que les deux écrans concordent.
      const buts = siens.filter(
        (e) => e.type === "goal" && e.detail !== OWN_GOAL_DETAIL && e.varStatus !== "cancelled",
      ).length;
      const passes = events.filter(
        (e) => e.type === "goal" && e.assistPlayerId === entry.playerId && e.varStatus !== "cancelled",
      ).length;
      const arrets = siens.filter((e) => e.type === "save").length;
      const fautesSubies = events.filter(
        (e) => e.type === "foul" && e.victimPlayerId === entry.playerId,
      ).length;
      const jaunes = siens.filter((e) => e.type === "yellow_card").length;
      const exclu = siens.some((e) => e.type === "red_card");

      const gagne = mien > sien;
      const nul = mien === sien;

      const score =
        buts * POIDS.but +
        passes * POIDS.passe +
        arrets * POIDS.arret +
        fautesSubies * POIDS.fauteSubie +
        jaunes * POIDS.jaune +
        (gagne ? POIDS.victoire : nul ? POIDS.nul : 0);

      const motif = [
        morceau(buts, "but"),
        morceau(passes, "passe"),
        morceau(arrets, "arrêt"),
        gagne ? "a gagné" : null,
      ].filter(Boolean).join(" · ");

      candidats.push({
        playerId: entry.playerId,
        userId: entry.userId ?? null,
        name: entry.name,
        teamId,
        cote,
        score,
        motif,
        exclu,
      });
    }
  }

  // Départage aux minutes jouées : à score égal, celui qui a tenu le match
  // entier a fait plus que celui entré à la 80ᵉ. Calculé seulement là, sur les
  // quelques ex æquo, et jamais sur toute la feuille.
  const minutes = new Map<string, number>();
  const minutesDe = (c: CandidatMVP) => {
    const cache = minutes.get(c.playerId);
    if (cache !== undefined) return cache;
    const m = computeMinutesPlayed(match, c.teamId, c.playerId, dureeMatchMin);
    minutes.set(c.playerId, m);
    return m;
  };

  return candidats.sort(
    (a, b) =>
      Number(a.exclu) - Number(b.exclu) ||
      b.score - a.score ||
      minutesDe(b) - minutesDe(a) ||
      a.name.localeCompare(b.name),
  );
}

// ---- À l'échelle de la compétition -----------------------------------------

/** Un prétendant au titre de meilleur joueur du tournoi. */
export interface CandidatMVPCompetition {
  /** La ligne à écrire sur la compétition — la dernière sous laquelle il a été couronné. */
  playerId: string;
  userId: string | null;
  name: string;
  teamId: string;
  hommeDuMatch: number;
  buts: number;
  minutes: number;
}

/**
 * Les prétendants au meilleur joueur d'une compétition, du plus au moins.
 *
 * Classés par NOMBRE D'HOMME DU MATCH d'abord — c'est la seule distinction que
 * quelqu'un ait réellement décernée, match après match — puis aux buts, puis
 * aux minutes. Comme à l'échelle du match, l'organisateur tranche : cette liste
 * range des noms, elle ne sacre personne.
 *
 * L'AGRÉGATION SE FAIT SUR LE COMPTE quand il y en a un. Une ligne d'effectif
 * est propre à une équipe dans une compétition, et un joueur transféré en cours
 * de tournoi en porte deux : compter par ligne couperait ses trophées en deux
 * et ne lui en laisserait aucun. Ses buts et ses minutes sont additionnés sur
 * toutes ses lignes, pour la même raison.
 *
 * À cette échelle, le critère « équipe finaliste ou victorieuse » retrouve son
 * sens — on sait enfin qui est allé au bout — mais il appartient au jugement de
 * l'organisateur, pas à ce calcul.
 */
export function classerCandidatsMVPCompetition(
  matches: MatchJoue[],
  dureeMatchMin?: number,
): CandidatMVPCompetition[] {
  interface Cumul {
    playerId: string;
    userId: string | null;
    name: string;
    teamId: string;
    hommeDuMatch: number;
    /** Toutes les lignes sous lesquelles il a joué, pour additionner le reste. */
    lignes: { teamId: string; playerId: string }[];
  }
  const parJoueur = new Map<string, Cumul>();

  // Triés par date : le dernier couronnement donne le nom et l'équipe retenus,
  // ceux sous lesquels on l'a vu le plus récemment.
  const ordonnes = [...matches].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  for (const m of ordonnes) {
    const playerId = m.mvpPlayerId;
    if (!playerId) continue;
    const name = m.mvpPlayerName;
    const teamId = m.mvpTeamId;
    if (!name || !teamId) continue;

    const cle = m.mvpUserId ?? playerId;
    const deja = parJoueur.get(cle);
    if (deja) {
      deja.hommeDuMatch += 1;
      deja.playerId = playerId;
      deja.name = name;
      deja.teamId = teamId;
      if (!deja.lignes.some((l) => l.teamId === teamId && l.playerId === playerId)) {
        deja.lignes.push({ teamId, playerId });
      }
    } else {
      parJoueur.set(cle, {
        playerId, userId: m.mvpUserId ?? null, name, teamId,
        hommeDuMatch: 1, lignes: [{ teamId, playerId }],
      });
    }
  }

  const candidats: CandidatMVPCompetition[] = [...parJoueur.values()].map((c) => {
    let buts = 0;
    let minutes = 0;
    for (const ligne of c.lignes) {
      const stats = computePlayerStats(matches, ligne.teamId, ligne.playerId, dureeMatchMin);
      buts += stats.goals;
      minutes += stats.minutesPlayed;
    }
    return {
      playerId: c.playerId, userId: c.userId, name: c.name, teamId: c.teamId,
      hommeDuMatch: c.hommeDuMatch, buts, minutes,
    };
  });

  return candidats.sort(
    (a, b) =>
      b.hommeDuMatch - a.hommeDuMatch ||
      b.buts - a.buts ||
      b.minutes - a.minutes ||
      a.name.localeCompare(b.name),
  );
}
