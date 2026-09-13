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
// TROIS CHOSES QUI NE SE TAPENT PAS entrent quand même dans le classement,
// parce que les ignorer revenait à classer la diligence du scoreur plutôt que
// le match : le temps passé sur le terrain (le socle), ce que le poste rend
// possible — un gardien n'a qu'une monnaie, et la cage inviolée se lit sur le
// tableau d'affichage sans qu'on ait rien saisi —, et les fautes commises, la
// seule prise du fair-play sur une liste de noms. Aucune des trois ne demande
// une saisie de plus à celui qui tient la console d'une main.
//
// Pur et sans SDK, comme player-stats, pour que la console et n'importe quel
// écran s'en servent sans dupliquer la règle.
// ============================================

import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import type { Poste } from "@/lib/postes";
import {
  DUREE_MATCH_DEFAUT, computeMinutesPlayed, computePlayerStats, type MatchJoue,
} from "@/lib/player-stats";

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
  /**
   * Minutes passées sur le terrain. Voir `computeMinutesPlayed`.
   *
   * Calculées pour tout le monde depuis qu'elles portent le socle — elles ne
   * servaient qu'à départager les ex æquo.
   */
  minutes: number;
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
 *
 * `matchEntier` EST LE SOCLE, et c'est le seul poids qui ne récompense aucun
 * geste. Sans lui on partait de zéro, et un défenseur qui tenait 90 minutes
 * propres sans jamais apparaître dans le fil marquait exactement autant qu'un
 * remplaçant resté sur le banc : le classement ne disait pas qui avait joué,
 * il disait qui avait été tapé sur la console. On ne sait pas mesurer un
 * défenseur, raison de plus pour ne pas le punir d'être immesurable. Il vaut
 * moins qu'un but, et il se proratise aux minutes.
 *
 * `fauteCommise` est le seul poids négatif ordinaire, et il vaut le quart d'un
 * carton : une faute est du football, un jaune est une faute que l'arbitre a
 * jugée bonne à punir. C'est la seule prise qu'ait le fair-play — le critère
 * que l'organisateur citait — sur ce classement, et la donnée était là depuis
 * le début, jamais lue : sur un événement `foul`, `player_id` est l'auteur et
 * `victim_player_id` celui qui la subit. On ne comptait que le second.
 */
const POIDS = {
  but: 3,
  passe: 2,
  fauteSubie: 0.5,
  fauteCommise: -0.25,
  jaune: -0.5,
  victoire: 1,
  nul: 0.5,
  matchEntier: 2,
} as const;

/**
 * Ce que le poste change, et rien d'autre.
 *
 * DEUX CHOSES SEULEMENT, celles qu'on peut défendre. L'arrêt, parce que le
 * gardien n'a qu'une monnaie là où l'attaquant en a quatre, et qu'à poids égal
 * il lui faut un match irréel pour remonter. Et la cage inviolée, parce que
 * c'est le seul travail défensif que la console constate sans qu'on ait rien à
 * taper : il se lit sur le tableau d'affichage.
 *
 * La cage se proratise aux minutes, comme le socle — un gardien entré à la 80ᵉ
 * n'a pas gardé la cage du match, il en a gardé dix minutes.
 */
const PAR_POSTE: Record<Poste, { arret: number; cageInviolee: number }> = {
  goalkeeper: { arret: 1.5, cageInviolee: 2 },
  defender:   { arret: 1,   cageInviolee: 1 },
  midfielder: { arret: 1,   cageInviolee: 0 },
  forward:    { arret: 1,   cageInviolee: 0 },
};

/**
 * Poste non saisi : le barème neutre, et on ne devine pas.
 *
 * Deux tiers des lignes d'effectif n'ont pas de poste (voir lib/postes), donc
 * un gardien anonyme perd son bonus de cage. C'est le bon sens de l'échec :
 * tout le reste du produit affiche un joueur sans étiquette plutôt que de lui
 * en inventer une, et un barème qui déduirait « c'est sûrement le gardien » se
 * tromperait sans que personne le voie.
 */
const POSTE_NEUTRE = { arret: 1, cageInviolee: 0 } as const;

/**
 * À partir de combien de fautes commises ça vaut la peine de l'écrire.
 *
 * Une faute ou deux, c'est un match ; trois, c'est une manière de jouer. En
 * dessous, la mention serait du bruit sur toutes les lignes.
 */
const FAUTES_VISIBLES = 3;

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
  const duree = dureeMatchMin ?? DUREE_MATCH_DEFAUT;

  const candidats: CandidatMVP[] = [];

  for (const cote of ["home", "away"] as const) {
    if (!campsEligibles[cote]) continue;
    const teamId = (cote === "home" ? match.homeTeamId : match.awayTeamId) ?? "";
    if (!teamId) continue;

    const lineup = cote === "home" ? match.homeLineup : match.awayLineup;
    const mien = cote === "home" ? scoreHome : scoreAway;
    const sien = cote === "home" ? scoreAway : scoreHome;

    for (const entry of lineup) {
      const bareme = entry.position ? PAR_POSTE[entry.position] : POSTE_NEUTRE;

      // Le socle et la cage se comptent en fraction de match jouée. Un temps
      // additionnel copieux peut dépasser la durée annoncée — `coupDeSifflet`
      // suit la timeline — d'où le plafond : un match entier vaut un match
      // entier, pas davantage.
      const minutes = computeMinutesPlayed(match, teamId, entry.playerId, dureeMatchMin);
      const part = duree > 0 ? Math.min(1, minutes / duree) : 0;

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
      // L'auteur de la faute, l'autre bout du même événement. Aucun risque de
      // double compte : personne ne se fait faute à soi-même.
      const fautesCommises = siens.filter((e) => e.type === "foul").length;
      const jaunes = siens.filter((e) => e.type === "yellow_card").length;
      const exclu = siens.some((e) => e.type === "red_card");

      const gagne = mien > sien;
      const nul = mien === sien;
      // La cage n'est inviolée que pour qui la garde : sans ce garde-fou,
      // chaque attaquant d'un 3-0 se verrait créditer le clean sheet.
      const cageInviolee = sien === 0 && bareme.cageInviolee > 0;

      const score =
        part * POIDS.matchEntier +
        buts * POIDS.but +
        passes * POIDS.passe +
        arrets * bareme.arret +
        fautesSubies * POIDS.fauteSubie +
        fautesCommises * POIDS.fauteCommise +
        jaunes * POIDS.jaune +
        (cageInviolee ? part * bareme.cageInviolee : 0) +
        (gagne ? POIDS.victoire : nul ? POIDS.nul : 0);

      const motif = [
        morceau(buts, "but"),
        morceau(passes, "passe"),
        morceau(arrets, "arrêt"),
        cageInviolee ? "cage inviolée" : null,
        fautesCommises >= FAUTES_VISIBLES ? morceau(fautesCommises, "faute") : null,
        gagne ? "a gagné" : null,
      ].filter(Boolean).join(" · ");

      candidats.push({
        playerId: entry.playerId,
        userId: entry.userId ?? null,
        name: entry.name,
        teamId,
        cote,
        score,
        minutes,
        motif,
        exclu,
      });
    }
  }

  // Départage aux minutes jouées : à score égal, celui qui a tenu le match
  // entier a fait plus que celui entré à la 80ᵉ. Elles sont déjà calculées —
  // le socle en dépend — là où elles ne l'étaient qu'à la demande, sur les
  // quelques ex æquo.
  return candidats.sort(
    (a, b) =>
      Number(a.exclu) - Number(b.exclu) ||
      b.score - a.score ||
      b.minutes - a.minutes ||
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
