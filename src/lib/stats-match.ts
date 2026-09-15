// ============================================
// Les compteurs d'un match, calcules une seule fois pour tout le monde.
//
// Ils vivaient en dur dans la fiche publique d'un match de competition —
// quatre lignes, buts et cartons — et nulle part ailleurs. La fiche d'un
// amical n'en avait aucun, et la console n'en montrait pas au scoreur.
//
// TROIS ENDROITS QUI DOIVENT COMPTER PAREIL. Le scoreur saisit un tir cadre,
// et il doit le voir apparaitre au meme endroit et sous le meme nom que celui
// qui suit le match depuis son telephone : c'est la seule facon pour lui de
// verifier qu'il saisit ce qu'il croit. Une seconde implementation aurait
// diverge des la premiere ligne ajoutee — c'est exactement ce qui etait arrive
// aux quatre copies de la liste des evenements, voir lib/evenements.
// ============================================

import type { TypeEvenement } from "@/lib/evenements";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { partPossession, SEUIL_PUBLIC_MS, type Possession } from "@/lib/possession";

/** L'evenement tel que les deux fiches et la console le tiennent. */
export interface FaitCompte {
  type: TypeEvenement;
  teamId: string;
  /** `csc` sur un but contre son camp. Voir OWN_GOAL_DETAIL. */
  detail?: string | null;
  /** Le verdict de la VAR, sur un but. Absent sur un but non revu. */
  varStatus?: "checking" | "confirmed" | "cancelled" | null;
}

export interface LigneStat {
  cle: string;
  label: string;
  home: number;
  away: number;
  /**
   * La ligne se lit en pour cent plutot qu'en nombre.
   *
   * Seule la possession, pour l'instant. Elle change l'affichage : « 62 % »
   * et non « 62 », et la barre est deja la repartition — on ne la recalcule
   * pas depuis les deux nombres.
   */
  pourcent?: boolean;
}

/**
 * Les compteurs, dans l'ordre ou on les lit.
 *
 * L'ORDRE N'EST PAS ALPHABETIQUE ET NE DOIT PAS L'ETRE. Il va du plus
 * decisif au plus anecdotique : ce qui a change le score, puis ce qui a
 * failli le changer, puis ce qui raconte le rythme, puis les sanctions.
 * Quelqu'un qui arrete de lire a la troisieme ligne a lu les trois qui
 * comptent.
 *
 * LES LIGNES VIDES SONT RETIREES. Un match ou personne n'a saisi de corner
 * afficherait « Corners 0 – 0 », ce qui se lit comme « il n'y a pas eu de
 * corner » alors que cela veut dire « personne ne les a comptes ». Les deux
 * ne sont pas la meme information, et la seconde ne merite pas une ligne.
 */
export function lignesStats(
  faits: FaitCompte[],
  homeTeamId: string | null,
  awayTeamId: string | null,
  score: { home: number; away: number },
  possession: Possession | null,
  chronoTourne: boolean,
  /**
   * Le temps de mesure a partir duquel la possession s'affiche.
   *
   * LA CONSOLE PASSE ZERO, et c'est la meme raison qu'a la pastille du ballon :
   * le scoreur verifie ici ce qu'il vient de saisir. Depuis que le seuil public
   * vaut cinq minutes, le laisser s'appliquer a la console aurait ouvert un
   * ecart de cinq minutes entre deux affichages de la MEME mesure, a trente
   * centimetres l'un de l'autre sur son ecran — la pastille a 62 %, et juste
   * en dessous un panneau qui n'a pas de ligne « Possession ». Il en aurait
   * conclu, a raison, que quelque chose ne marche pas.
   */
  seuilMs: number = SEUIL_PUBLIC_MS,
): LigneStat[] {
  const compte = (type: TypeEvenement, teamId: string | null) =>
    faits.filter((e) => e.type === type && e.teamId === teamId).length;

  const paire = (cle: string, label: string, ...types: TypeEvenement[]): LigneStat => ({
    cle,
    label,
    home: types.reduce((n, t) => n + compte(t, homeTeamId), 0),
    away: types.reduce((n, t) => n + compte(t, awayTeamId), 0),
  });

  /**
   * LES TIRS CADRES NE SE SAISISSENT PAS TOUS.
   *
   * Un but EST un tir cadre, et un arret aussi — l'un est entre, l'autre a ete
   * detourne, mais dans les deux cas le ballon allait au but. Le scoreur ne le
   * saisit pourtant jamais deux fois : il pose « but » sur le buteur, ou
   * « arret » sur le gardien, et passe a la suite. Le match continue, et
   * demander une seconde saisie pour la meme frappe, c'est la perdre.
   *
   * Les compteurs se chargeaient donc de dire « 3 buts, 0 tir cadre », ce qui
   * n'arrive dans aucun match de l'histoire du football.
   *
   * L'ARRET CHANGE DE CAMP, et c'est le piege. Il est saisi sur le GARDIEN,
   * donc porte par l'equipe qui defend — mais la frappe qu'il arrete vient de
   * l'autre. Le seul compteur de ce fichier qui traverse la ligne mediane.
   *
   * DEUX BUTS NE COMPTENT PAS. Celui que la VAR annule n'a pas eu lieu, et
   * celui qu'un joueur met contre son camp n'est un tir cadre pour personne :
   * ni pour lui, qui ne visait pas ce but-la, ni pour l'adversaire, qui n'a
   * pas frappe.
   */
  const butsCadres = (teamId: string | null) =>
    faits.filter(
      (e) =>
        e.type === "goal" &&
        e.teamId === teamId &&
        e.varStatus !== "cancelled" &&
        e.detail !== OWN_GOAL_DETAIL,
    ).length;

  const cadres = (teamId: string | null, adverse: string | null) =>
    compte("shot_on_target", teamId) + butsCadres(teamId) + compte("save", adverse);

  const cadresHome = cadres(homeTeamId, awayTeamId);
  const cadresAway = cadres(awayTeamId, homeTeamId);

  const parts = possession
    ? partPossession(possession, chronoTourne, Date.now(), seuilMs)
    : null;

  const lignes: LigneStat[] = [
    // Le score vient du tableau d'affichage, JAMAIS de la somme des buts d'une
    // equipe : un but contre son camp est porte par celle qui le concede.
    { cle: "buts", label: "Buts", home: score.home, away: score.away },
    ...(parts ? [{ cle: "possession", label: "Possession", home: parts.home, away: parts.away, pourcent: true }] : []),
    // Le tir cadre compte deux fois : il EST un tir. La console ne demande
    // jamais les deux pour la meme frappe, donc « Tirs » les additionne.
    {
      cle: "tirs",
      label: "Tirs",
      home: compte("shot", homeTeamId) + cadresHome,
      away: compte("shot", awayTeamId) + cadresAway,
    },
    { cle: "cadres", label: "Tirs cadrés", home: cadresHome, away: cadresAway },
    paire("arrets", "Arrêts", "save"),
    paire("corners", "Corners", "corner"),
    paire("penaltys", "Penaltys obtenus", "penalty"),
    paire("coups_francs", "Coups francs", "free_kick"),
    paire("touches", "Touches", "throw_in"),
    paire("fautes", "Fautes", "foul"),
    paire("hors_jeu", "Hors-jeu", "offside"),
    paire("jaunes", "Cartons jaunes", "yellow_card"),
    paire("rouges", "Cartons rouges", "red_card"),
    paire("changements", "Changements", "substitution"),
  ];

  // Les buts restent meme a 0–0 : un match nul et vierge est un resultat, pas
  // une absence de saisie.
  return lignes.filter((l) => l.cle === "buts" || l.home > 0 || l.away > 0);
}

/**
 * Y a-t-il de quoi montrer un onglet Stats ?
 *
 * Le score seul ne suffit pas : « Buts 0 – 0 » est un onglet vide deguise.
 * Il faut au moins un fait saisi, ou une possession mesuree.
 */
export function aDesStats(
  faits: FaitCompte[],
  possession: Possession | null,
  chronoTourne: boolean,
): boolean {
  if (possession && partPossession(possession, chronoTourne)) return true;
  return faits.some((e) => e.type !== "period_start" && e.type !== "period_end");
}
