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
import { partPossession, type Possession } from "@/lib/possession";

/** L'evenement tel que les deux fiches et la console le tiennent. */
export interface FaitCompte {
  type: TypeEvenement;
  teamId: string;
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
): LigneStat[] {
  const compte = (type: TypeEvenement, teamId: string | null) =>
    faits.filter((e) => e.type === type && e.teamId === teamId).length;

  const paire = (cle: string, label: string, ...types: TypeEvenement[]): LigneStat => ({
    cle,
    label,
    home: types.reduce((n, t) => n + compte(t, homeTeamId), 0),
    away: types.reduce((n, t) => n + compte(t, awayTeamId), 0),
  });

  const parts = possession ? partPossession(possession, chronoTourne) : null;

  const lignes: LigneStat[] = [
    // Le score vient du tableau d'affichage, JAMAIS de la somme des buts d'une
    // equipe : un but contre son camp est porte par celle qui le concede.
    { cle: "buts", label: "Buts", home: score.home, away: score.away },
    ...(parts ? [{ cle: "possession", label: "Possession", home: parts.home, away: parts.away, pourcent: true }] : []),
    // Le tir cadre est saisi une fois et compte deux fois : il EST un tir.
    // Voir la console, qui ne demande jamais les deux pour la meme frappe.
    paire("tirs", "Tirs", "shot", "shot_on_target"),
    paire("cadres", "Tirs cadrés", "shot_on_target"),
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
