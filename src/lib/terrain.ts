// ============================================
// Placer une composition sur un terrain.
//
// Partage entre la fiche publique du match (MatchLineups) et la console live,
// qui dessinent le meme terrain pour deux usages : l'une le donne a lire,
// l'autre le donne a toucher. Une seule geometrie, donc, sans quoi le joueur
// n'est pas au meme endroit selon l'ecran d'ou on le regarde.
//
// LE POSTE EST DESORMAIS SUR LA FEUILLE DE MATCH. MatchLineups imposait un
// GK-4-3-3 a tout le monde en expliquant que « la plateforme ne stocke pas de
// poste, seulement un ordre et un role » : c'etait vrai, ca ne l'est plus
// (voir lib/postes, et `LineupEntry.position`). On place donc par poste
// quand il est connu.
//
// Et on ne ment pas quand il ne l'est pas. Deux tiers des lignes d'effectif
// n'ont pas de poste : les joueurs concernes vont sur une ligne a eux,
// marquee « ? », plutot que d'etre repartis d'office en 4-3-3 — ce qui
// afficherait quatre defenseurs que personne n'a declares. Si PERSONNE n'a de
// poste, en revanche, cette ligne unique serait un tas informe : on retombe
// alors sur le 4-3-3 par ordre de feuille, l'ancien comportement.
// ============================================

import { normaliserPoste, type Poste } from "@/lib/postes";
import type { LineupEntry } from "@/types";

export interface PlaceTerrain {
  x: number;
  y: number;
  /** Null sur un emplacement que personne n'occupe (repli 4-3-3 seulement). */
  entry: LineupEntry | null;
  /** La lettre de l'emplacement : G, D, M, A, ou ? faute de poste declare. */
  etiquette: string;
}

export interface Disposition {
  places: PlaceTerrain[];
  /**
   * L'ecart horizontal du rang le plus charge, dont l'appelant tire le rayon
   * de ses pastilles.
   *
   * UN RANG NE SE COUPE JAMAIS EN DEUX. C'etait la premiere idee, et elle ne
   * tient pas : les rangs sont a treize unites les uns des autres et une
   * pastille en fait douze, il n'y a donc aucune place pour un demi-rang — il
   * mordait sur le rang voisin quoi qu'on fasse. C'est la PASTILLE qui cede :
   * onze attaquants tiennent sur une seule ligne, plus serres et plus petits,
   * ce qui est laid mais lisible, la ou deux rangs superposes etaient
   * illisibles.
   */
  ecart: number;
}

/**
 * Le dispositif de repli, par taille d'equipe.
 *
 * IL N'Y A PAS QUE DU 11 CONTRE 11. Une competition se joue en NvN — quatre a
 * onze, voir TEAM_SIZE_OPTIONS —, et un amical se declare en 5v5, 7v7 ou
 * 11v11. Le terrain imposait un GK-4-3-3 a tout le monde : une feuille de cinq
 * joueurs y dessinait six emplacements vides en pointilles, c'est-a-dire six
 * joueurs manquants qui n'ont jamais manque.
 *
 * Les chiffres sont ceux qu'on voit sur les terrains reduits : la defense
 * d'abord, l'attaque en dernier. Ils ne pretendent pas dicter une tactique —
 * personne ne saisit la sienne — mais placer les maillots sans mentir sur leur
 * nombre.
 */
const DISPOSITIFS: Record<number, [number, number, number]> = {
  //        D  M  A
  1:  [0, 0, 0],
  2:  [1, 0, 0],
  3:  [1, 1, 0],
  4:  [1, 1, 1],
  5:  [2, 1, 1],
  6:  [2, 2, 1],
  7:  [3, 2, 1],
  8:  [3, 3, 1],
  9:  [3, 3, 2],
  10: [4, 3, 2],
  11: [4, 3, 3],
};

/**
 * Le dispositif d'une equipe de `taille`, gardien compris.
 *
 * Au-dela de la table, on repartit a la louche : deux cinquiemes derriere, le
 * reste partage entre le milieu et l'attaque. Un effectif de quatorze sur le
 * terrain n'existe pas au football, mais une feuille mal saisie, si.
 */
function dispositif(taille: number): [number, number, number] {
  if (taille <= 0) return [0, 0, 0];
  const connu = DISPOSITIFS[taille];
  if (connu) return connu;
  const champ = taille - 1;
  const d = Math.round(champ * 0.4);
  const m = Math.round((champ - d) * 0.55);
  return [d, m, champ - d - m];
}

/**
 * Les rangs du terrain, de l'attaque vers le but.
 *
 * SEIZE UNITES D'ECART, REGULIEREMENT. Le nom se pose sous la pastille, donc
 * un rang occupe le rayon plus l'interligne : a treize d'ecart, le gardien
 * recouvrait le nom des defenseurs. La contrainte se lit
 * `interligne <= ecart - 2 x rayon`, soit 6 de marge ici pour un rayon de 5 —
 * c'est elle qui plafonne le rayon des pastilles de la console.
 */
const ECART_RANGS = 16;
const LIGNES: readonly { poste: Poste | null; y: number; etiquette: string }[] = [
  { poste: "forward", y: 26, etiquette: "A" },
  { poste: null, y: 26 + ECART_RANGS, etiquette: "?" },
  { poste: "midfielder", y: 26 + ECART_RANGS * 2, etiquette: "M" },
  { poste: "defender", y: 26 + ECART_RANGS * 3, etiquette: "D" },
  { poste: "goalkeeper", y: 26 + ECART_RANGS * 4, etiquette: "G" },
];

/** L'interligne entre une pastille et le nom qu'elle porte. */
export const INTERLIGNE = 4.5;

/** Le rayon au-dela duquel un rang mordrait sur le nom du rang precedent. */
export const RAYON_MAX_RANGS = (ECART_RANGS - INTERLIGNE) / 2;

/** Les bornes horizontales : au-dela, le nom deborde du cadre. */
const X_MIN = 14;
const X_MAX = 86;

/**
 * Repartit k joueurs sur la largeur, CENTRES.
 *
 * `reference` est l'effectif d'une sous-ligne pleine : c'est lui qui donne
 * l'ecart entre deux pastilles, et non k. Sans ca, une sous-ligne de deux
 * joueurs s'etirait d'une ligne de touche a l'autre — deux ailiers isoles
 * pour ce qui est, en realite, la fin d'un rang.
 */
function abscisses(k: number, reference: number): number[] {
  if (k <= 0) return [];
  const pas = reference > 1 ? (X_MAX - X_MIN) / (reference - 1) : 0;
  return Array.from({ length: k }, (_, i) => 50 + (i - (k - 1) / 2) * pas);
}

/** Le gardien de cette feuille, s'il a ete declare. */
export function gardienDe(lineup: LineupEntry[]): LineupEntry | null {
  return lineup.find((e) => normaliserPoste(e.position) === "goalkeeper") ?? null;
}

/**
 * Les rangs d'une feuille sans aucun poste declare : le gardien devant le but,
 * puis le dispositif de la taille annoncee, dans l'ordre de la feuille.
 *
 * Les emplacements que personne n'occupe restent vides et gardent leur lettre :
 * quand l'appelant annonce une taille superieure a ce qu'il fournit, c'est
 * qu'il manque quelqu'un, et le terrain doit le dire.
 */
function rangsParDefaut(
  titulaires: LineupEntry[],
  taille: number,
): { ligne: (typeof LIGNES)[number]; joueurs: (LineupEntry | null)[] }[] {
  const [d, m, a] = dispositif(Math.max(taille, titulaires.length));
  const restants = [...titulaires];
  const prendre = (n: number) =>
    Array.from({ length: n }, () => restants.shift() ?? null);

  const parPoste: Record<string, (LineupEntry | null)[]> = {
    goalkeeper: prendre(Math.min(1, Math.max(taille, titulaires.length))),
    defender: prendre(d),
    midfielder: prendre(m),
    forward: prendre(a),
  };
  // Ce qui deborde du dispositif — une feuille plus longue que la taille
  // annoncee — rejoint le milieu plutot que de disparaitre.
  parPoste.midfielder.push(...restants);

  return LIGNES
    .filter((l) => l.poste !== null && (parPoste[l.poste] ?? []).length > 0)
    .map((ligne) => ({ ligne, joueurs: parPoste[ligne.poste as string] }));
}

/**
 * Les emplacements du terrain pour ces titulaires.
 *
 * L'ordre de la feuille est conserve a l'interieur d'une ligne : c'est celui
 * que le manager a saisi, et le seul indice qu'on ait sur qui joue a gauche.
 */
export function disposerSurTerrain(
  titulaires: LineupEntry[],
  /**
   * Combien de joueurs l'equipe aligne, gardien compris. Par defaut, ceux
   * qu'on a sous la main : la feuille EST la verite sur le nombre, et un
   * effectif reduit par une expulsion ne doit pas laisser un fantome sur le
   * terrain.
   */
  taille = titulaires.length,
): Disposition {
  const connus = titulaires.filter((e) => normaliserPoste(e.position) !== null);

  // Personne n'a de poste declare : on repartit par ordre de feuille sur le
  // dispositif de cette taille d'equipe. Meme geometrie que plus bas — les
  // deux chemins se distinguent par la SOURCE du rang, pas par le dessin.
  const rangs = connus.length === 0
    ? rangsParDefaut(titulaires, taille)
    : LIGNES.map((ligne) => ({
        ligne,
        joueurs: titulaires.filter((e) => normaliserPoste(e.position) === ligne.poste),
      })).filter((r) => r.joueurs.length > 0);

  const plusCharge = Math.max(...rangs.map((r) => r.joueurs.length));
  const ecart = plusCharge > 1 ? (X_MAX - X_MIN) / (plusCharge - 1) : X_MAX - X_MIN;

  const places: PlaceTerrain[] = [];
  for (const { ligne, joueurs } of rangs) {
    const xs = abscisses(joueurs.length, plusCharge);
    joueurs.forEach((entry, i) => {
      places.push({ x: xs[i], y: ligne.y, entry: entry ?? null, etiquette: ligne.etiquette });
    });
  }

  return { places, ecart };
}

/**
 * Le rayon d'une pastille : la moitie de l'ecart, moins de quoi respirer, et
 * jamais plus que ce que l'appelant juge lisible.
 */
export function rayonPastille(ecart: number, max: number): number {
  return Math.min(max, (ecart / 2) * 0.88);
}
