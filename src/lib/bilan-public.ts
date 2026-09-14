import { adminDb } from "@/lib/firebase-admin";
import { toCompMatch } from "@/lib/competition-mappers";
import { matchDuration } from "@/lib/competition-format";
import {
  computePlayerStats,
  totalStats,
  DUREE_MATCH_DEFAUT,
  EMPTY_STATS,
  type PlayerStats,
  type MatchJoue,
} from "@/lib/player-stats";
import type {
  FirestoreCompMatch,
  FirestoreCompetition,
  LinkedCompPlayer,
} from "@/types";

// ============================================
// LE BILAN D'UN JOUEUR, TEL QU'UN VISITEUR LE LIT.
//
// LE BUG QUE CE FICHIER CORRIGE. La fiche publique affichait « Matchs / Buts
// / Passes déc. » en lisant trois compteurs du document `users`. Or ces
// compteurs ne sont écrits que par trois routes — /api/matches/complete,
// /record et /credit-stats — et toutes les trois travaillent sur la
// collection `matches`, c'est-à-dire sur les AMICAUX. Aucune ne connaît
// `competitions/{id}/comp_matches`.
//
// Conséquence : un joueur qui ne joue qu'en compétition — le cas de la
// plupart des joueurs du produit — affichait 0 - 0 - 0 sur sa fiche, pour
// toujours, quels que soient ses buts. Ce n'était pas un cache à vider, ni
// une donnée en retard : elle n'a jamais été écrite.
//
// COMPTEURS POUR LES AMICAUX, CALCUL POUR LES COMPÉTITIONS. Les deux moitiés
// ne se recouvrent pas, donc on les additionne sans jamais compter deux fois.
//
//   ⚠ SI UN JOUR UNE ROUTE DE COMPÉTITION SE MET À INCRÉMENTER
//   `users.matches_played`, CE FICHIER COMPTERA DOUBLE. La règle à tenir est
//   simple : les compteurs du document `users` appartiennent aux amicaux, et
//   à eux seuls. Tout ce qui vient d'une compétition se calcule.
//
// POURQUOI CALCULER PLUTÔT QUE COMPLÉTER LES COMPTEURS. Un compteur demande
// un rollup, une migration pour l'historique, et la garantie de ne jamais
// incrémenter deux fois — trois problèmes pour une information qu'on a déjà
// sous la main, écrite sur les feuilles de match. C'est le raisonnement que
// lib/player-stats tient déjà pour le nombre de titres d'homme du match.
//
// CE QUE ÇA COÛTE. Deux lectures par compétition où le joueur est inscrit :
// son calendrier, et la compétition elle-même — celle-ci pour son FORMAT, une
// mi-temps de 25 minutes faisant un match de 50, et un temps de jeu calculé
// sur 90 serait faux de moitié. Un joueur en a une ou deux. La route publique
// qui appelle ceci revalide toutes les cinq minutes, donc ces lectures ne se
// paient pas à chaque visiteur.
// ============================================

/** Les compteurs du document `users` : les amicaux, et rien d'autre. */
export interface CompteursAmicaux {
  matches_played?: number;
  goals?: number;
  assists?: number;
}

/**
 * Additionne les amicaux (compteurs) et les compétitions (calcul).
 *
 * Ne jette jamais : une compétition illisible retire sa part du total plutôt
 * que de vider la fiche entière. Mieux vaut un bilan incomplet qu'une page en
 * erreur — et le journal dit laquelle a manqué.
 */
export async function bilanPublicDuJoueur(
  compteurs: CompteursAmicaux,
  liens: LinkedCompPlayer[],
): Promise<{ matchesPlayed: number; goals: number; assists: number }> {
  const parCompetition = new Map<string, LinkedCompPlayer[]>();
  for (const lien of liens) {
    const seau = parCompetition.get(lien.competition_id);
    if (seau) seau.push(lien);
    else parCompetition.set(lien.competition_id, [lien]);
  }

  const parts = await Promise.all(
    [...parCompetition.entries()].map(([cid, liensDeLaCompet]) =>
      bilanDUneCompetition(cid, liensDeLaCompet),
    ),
  );

  const competitions = totalStats(parts.map((p) => p.stats));
  const passes = parts.reduce((n, p) => n + p.passes, 0);

  return {
    matchesPlayed: (compteurs.matches_played ?? 0) + competitions.matchesPlayed,
    goals: (compteurs.goals ?? 0) + competitions.goals,
    assists: (compteurs.assists ?? 0) + passes,
  };
}

/**
 * Les passes décisives, comptées à part.
 *
 * `computePlayerStats` ne les rend pas, et ce n'est pas un oubli : la console
 * note la passe SUR L'ÉVÉNEMENT DU BUT, dans `assistPlayerId`. Sa boucle
 * commence par `if (event.playerId !== playerId) continue` — elle ne regarde
 * que les événements DU joueur, et la passe est sur un événement du BUTEUR.
 * Elle passe donc à travers.
 *
 * Compté ici plutôt qu'en changeant `PlayerStats` : cette structure est lue
 * par la page « Mon bilan » et par le barème de l'homme du match, et lui
 * ajouter un champ demande de vérifier les deux. Le jour où les passes y
 * entrent pour de bon, cette fonction disparaît.
 *
 * Même règle que pour les buts : une réalisation annulée par la VAR sort du
 * tableau d'affichage, la passe qui l'a servie sort du compte.
 */
function passesDecisives(matchs: MatchJoue[], playerId: string): number {
  let n = 0;
  for (const match of matchs) {
    if (match.status !== "completed") continue;
    for (const event of match.liveState?.events ?? []) {
      if (event.type !== "goal") continue;
      if (event.varStatus === "cancelled") continue;
      if (event.assistPlayerId === playerId) n += 1;
    }
  }
  return n;
}

async function bilanDUneCompetition(
  cid: string,
  liens: LinkedCompPlayer[],
): Promise<{ stats: PlayerStats; passes: number }> {
  try {
    const [calendrier, competition] = await Promise.all([
      adminDb.collection("competitions").doc(cid).collection("comp_matches").get(),
      adminDb.collection("competitions").doc(cid).get(),
    ]);

    const matchs: MatchJoue[] = calendrier.docs.map((d) =>
      toCompMatch(d.id, d.data() as FirestoreCompMatch),
    );

    const format = competition.exists
      ? (competition.data() as FirestoreCompetition).format
      : null;
    const duree = format ? matchDuration(format) : DUREE_MATCH_DEFAUT;

    // Une LIGNE D'EFFECTIF par inscription, et un joueur peut en avoir deux
    // dans la même compétition — un transfert en cours de tournoi lui en
    // ouvre une seconde. Les deux comptent, et leurs matchs sont disjoints.
    const stats = totalStats(
      liens.map((l) => computePlayerStats(matchs, l.team_id, l.player_id, duree)),
    );

    // Les passes se comptent sur l'IDENTIFIANT DE LIGNE, une fois par ligne
    // distincte : deux lignes portent deux identifiants, et la même passe ne
    // peut pas répondre aux deux.
    const identifiants = [...new Set(liens.map((l) => l.player_id))];
    const passes = identifiants.reduce((n, id) => n + passesDecisives(matchs, id), 0);

    return { stats, passes };
  } catch (err) {
    console.error("bilan-public: compétition illisible", cid, err);
    return { stats: EMPTY_STATS, passes: 0 };
  }
}
