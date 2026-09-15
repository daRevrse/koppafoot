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
  /**
   * Le plafond de rayon de ce sens d'attaque, a passer a `rayonPastille`.
   *
   * Il vient d'ici parce qu'il DEPEND du sens : debout, c'est l'ecart des
   * rangs qui borne la pastille ; couche, ce sont les rangs qui sont au large
   * et le travers qui serre. Un appelant qui choisirait lui-meme ne saurait
   * pas lequel des deux il regarde.
   */
  rayonMax: number;
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
 * Exporte : l'editeur de feuille de match s'en sert pour annoncer au manager
 * la forme attendue de son NvN — un 5v5 n'est pas un 11v11 avec des trous —
 * et le terrain pour placer les maillots. Une seule table pour les deux.
 *
 * Au-dela de la table, on repartit a la louche : deux cinquiemes derriere, le
 * reste partage entre le milieu et l'attaque. Un effectif de quatorze sur le
 * terrain n'existe pas au football, mais une feuille mal saisie, si.
 */
export function dispositif(taille: number): [number, number, number] {
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
const LIGNES: readonly { poste: Poste | null; etiquette: string }[] = [
  { poste: "forward", etiquette: "A" },
  { poste: null, etiquette: "?" },
  { poste: "midfielder", etiquette: "M" },
  { poste: "defender", etiquette: "D" },
  { poste: "goalkeeper", etiquette: "G" },
];

/**
 * VERS OU CETTE EQUIPE JOUE.
 *
 * `haut` est le terrain d'origine, celui de la fiche publique et de la console
 * debout : une seule equipe, son but en bas, son attaque en haut.
 *
 * `droite` et `gauche` sont nes de la console couchee, qui montre les DEUX
 * camps a la fois. Chacun defend son bord et attaque vers le milieu de
 * l'ecran, comme sur une affiche de match — c'est la seule disposition ou le
 * scoreur n'a pas a se demander de quel camp il parle : le joueur est du cote
 * ou il joue.
 *
 * Ce n'est PAS une rotation du terrain debout. Coucher le dessin echangerait
 * aussi les deux etalements, et ils ne sont pas interchangeables : les rangs
 * se suivent dans le sens du jeu, les joueurs d'un meme rang s'etalent en
 * travers, et le NOM se pose sous la pastille dans les deux cas. C'est donc
 * l'etalement EN TRAVERS qui doit loger les noms, et il change de dimension
 * selon le sens. D'ou deux jeux de constantes, et non une transposition.
 */
export type SensDAttaque = "haut" | "droite" | "gauche";

export interface Cadre {
  /** Le `viewBox` : `x y l h`. */
  x: number;
  y: number;
  l: number;
  h: number;
  /**
   * Les bornes ou ancrer un NOM.
   *
   * Une pastille d'aile est proche du bord ; un nom centre dessus sortirait du
   * cadre et se ferait couper. On ramene l'ancre vers l'interieur — ce qui
   * decale legerement le nom par rapport a sa pastille, et vaut mieux qu'un
   * nom tronque.
   */
  nomMin: number;
  nomMax: number;
  /**
   * De combien le dessin est plus grand que le terrain debout.
   *
   * Le SVG s'ajuste a sa boite, donc une unite du cadre couche vaut a l'ecran
   * la moitie d'une unite du cadre debout. Tout ce qui est donne en unites et
   * doit garder sa taille APPARENTE — le corps du texte, la vignette du
   * carton — se multiplie par ce nombre.
   */
  echelle: number;
}

/** Le cadre a donner au `viewBox`, par sens d'attaque. */
export const CADRE: Record<SensDAttaque, Cadre> = {
  // Recadre sur la moitie utile : au-dessus des attaquants il n'y a personne
  // a toucher. Voir TerrainConsole.
  haut: { x: 0, y: 15, l: 100, h: 89, nomMin: 13, nomMax: 87, echelle: 1 },
  droite: { x: 0, y: 0, l: 200, h: 116, nomMin: 18, nomMax: 182, echelle: 2 },
  gauche: { x: 0, y: 0, l: 200, h: 116, nomMin: 18, nomMax: 182, echelle: 2 },
};

/** L'interligne entre une pastille et le nom qu'elle porte. */
export const INTERLIGNE = 4.5;

/** Le rayon au-dela duquel un rang mordrait sur le nom du rang precedent. */
export const RAYON_MAX_RANGS = (ECART_RANGS - INTERLIGNE) / 2;

/**
 * La geometrie d'un sens d'attaque.
 *
 * DEUX AXES, ET ILS NE JOUENT PAS LE MEME ROLE. `rang` avance DANS LE SENS DU
 * JEU — l'attaque devant, le gardien derriere ; `travers` etale les joueurs
 * d'un meme rang perpendiculairement.
 *
 * Le nom se pose sous la pastille, toujours, quel que soit le sens. C'est
 * donc l'axe VERTICAL qui doit loger les noms — et selon le sens d'attaque,
 * cet axe est celui des rangs (terrain debout) ou celui du travers (terrain
 * couche). Le rayon maximal ne se plafonne donc pas au meme endroit, et c'est
 * toute la raison pour laquelle coucher le terrain n'est pas une rotation.
 */
interface Geometrie {
  /** La coordonnee du rang d'index i, 0 = attaque, 4 = gardien. */
  rang: (i: number) => number;
  /** Les bornes en travers : au-dela, le nom deborde du cadre. */
  traversMin: number;
  traversMax: number;
  /**
   * L'axe VERTICAL est-il celui du travers ?
   *
   * Le nom se pose sous la pastille, donc il faut `2r + INTERLIGNE` de haut
   * par joueur. Reste a savoir QUI fournit cette hauteur : debout ce sont les
   * rangs, qui sont a un ecart fixe ; couche c'est le travers, dont l'ecart
   * depend du nombre de joueurs dans le rang le plus charge — et donc de la
   * feuille de match. Le plafond ne peut pas etre une constante dans ce cas.
   */
  nomsSurLeTravers: boolean;
  /**
   * Le plafond au-dela duquel la pastille est simplement trop grosse.
   *
   * Il ne vient pas d'une contrainte de collision mais du dessin : une defense
   * a deux laisse quarante unites entre deux pastilles, et rien n'empeche
   * geometriquement d'en faire des soucoupes.
   */
  plafond: number;
  /** Assemble les deux coordonnees dans le repere du cadre. */
  place: (rang: number, travers: number) => { x: number; y: number };
}

/** L'ecart entre deux rangs, terrain couche. Le cadre y est deux fois plus large. */
const ECART_RANGS_COUCHE = 40;

const GEOMETRIES: Record<SensDAttaque, Geometrie> = {
  haut: {
    rang: (i) => 26 + i * ECART_RANGS,
    traversMin: 14,
    traversMax: 86,
    // Debout, les rangs se suivent VERTICALEMENT : c'est leur ecart qui borne
    // la pastille, sans quoi le gardien recouvre le nom des defenseurs.
    nomsSurLeTravers: false,
    plafond: RAYON_MAX_RANGS,
    place: (rang, travers) => ({ x: travers, y: rang }),
  },
  // Le but au bord GAUCHE, l'attaque vers le milieu de l'ecran.
  droite: {
    rang: (i) => 180 - i * ECART_RANGS_COUCHE,
    traversMin: 20,
    // 92 ET NON 96, pour que l'ETALEMENT TOMBE JUSTE. Le dessin tient a
    // l'unite pres : le nom d'un joueur a sa ligne de base exactement sur le
    // bord de la pastille du dessous, et c'est correct — les lettres montent
    // au-dessus de cette ligne. Mais sur 76 unites, un rang de quatre donne
    // des ecarts de 25,333… et l'egalite se joue alors sur la derniere
    // decimale d'un flottant : le dessin mord, ou ne mord pas, selon
    // l'arrondi. Sur 72, trois et quatre joueurs tombent sur des entiers
    // (24 et 18), et la question ne se pose plus.
    traversMax: 92,
    // Couche, les rangs sont largement espaces (quarante unites) et ne se
    // genent plus. C'est le TRAVERS qui devient vertical, donc lui qui porte
    // les noms.
    nomsSurLeTravers: true,
    plafond: 11,
    place: (rang, travers) => ({ x: rang, y: travers }),
  },
  // Le miroir : le but au bord DROIT.
  gauche: {
    rang: (i) => 20 + i * ECART_RANGS_COUCHE,
    traversMin: 20,
    // 92 ET NON 96, pour que l'ETALEMENT TOMBE JUSTE. Le dessin tient a
    // l'unite pres : le nom d'un joueur a sa ligne de base exactement sur le
    // bord de la pastille du dessous, et c'est correct — les lettres montent
    // au-dessus de cette ligne. Mais sur 76 unites, un rang de quatre donne
    // des ecarts de 25,333… et l'egalite se joue alors sur la derniere
    // decimale d'un flottant : le dessin mord, ou ne mord pas, selon
    // l'arrondi. Sur 72, trois et quatre joueurs tombent sur des entiers
    // (24 et 18), et la question ne se pose plus.
    traversMax: 92,
    nomsSurLeTravers: true,
    plafond: 11,
    place: (rang, travers) => ({ x: rang, y: travers }),
  },
};

/**
 * Repartit k joueurs sur la largeur, CENTRES.
 *
 * `reference` est l'effectif d'une sous-ligne pleine : c'est lui qui donne
 * l'ecart entre deux pastilles, et non k. Sans ca, une sous-ligne de deux
 * joueurs s'etirait d'une ligne de touche a l'autre — deux ailiers isoles
 * pour ce qui est, en realite, la fin d'un rang.
 */
function abscisses(k: number, reference: number, g: Geometrie): number[] {
  if (k <= 0) return [];
  const pas = reference > 1 ? (g.traversMax - g.traversMin) / (reference - 1) : 0;
  const milieu = (g.traversMin + g.traversMax) / 2;
  return Array.from({ length: k }, (_, i) => milieu + (i - (k - 1) / 2) * pas);
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
): { ligne: (typeof LIGNES)[number]; index: number; joueurs: (LineupEntry | null)[] }[] {
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
    .map((ligne, index) => ({ ligne, index }))
    .filter(({ ligne }) => ligne.poste !== null && (parPoste[ligne.poste] ?? []).length > 0)
    .map(({ ligne, index }) => ({ ligne, index, joueurs: parPoste[ligne.poste as string] }));
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
  /** Vers ou cette equipe joue. Voir SensDAttaque. */
  sens: SensDAttaque = "haut",
): Disposition {
  const g = GEOMETRIES[sens];
  const connus = titulaires.filter((e) => normaliserPoste(e.position) !== null);

  // Personne n'a de poste declare : on repartit par ordre de feuille sur le
  // dispositif de cette taille d'equipe. Meme geometrie que plus bas — les
  // deux chemins se distinguent par la SOURCE du rang, pas par le dessin.
  // L'INDEX du rang, et non sa coordonnee : c'est lui qui traverse les trois
  // sens d'attaque sans changer, la geometrie se chargeant de le poser.
  const rangs = connus.length === 0
    ? rangsParDefaut(titulaires, taille)
    : LIGNES.map((ligne, i) => ({
        ligne,
        index: i,
        joueurs: titulaires.filter((e) => normaliserPoste(e.position) === ligne.poste),
      })).filter((r) => r.joueurs.length > 0);

  const largeurTravers = g.traversMax - g.traversMin;
  const plusCharge = Math.max(...rangs.map((r) => r.joueurs.length));
  const ecart = plusCharge > 1 ? largeurTravers / (plusCharge - 1) : largeurTravers;

  const places: PlaceTerrain[] = [];
  for (const { ligne, index, joueurs } of rangs) {
    const traverses = abscisses(joueurs.length, plusCharge, g);
    joueurs.forEach((entry, i) => {
      places.push({
        ...g.place(g.rang(index), traverses[i]),
        entry: entry ?? null,
        etiquette: ligne.etiquette,
      });
    });
  }

  // UNE SEULE REGLE POUR LES TROIS SENS : le nom tient sous la pastille, donc
  // l'axe vertical doit loger `2r + INTERLIGNE`. Seule change la source de
  // cette hauteur — l'ecart des rangs debout, celui du travers couche.
  const pasVertical = g.nomsSurLeTravers ? ecart : ECART_RANGS;
  const rayonMax = Math.min(g.plafond, (pasVertical - INTERLIGNE) / 2);

  return { places, ecart, rayonMax };
}

/**
 * Le rayon d'une pastille : la moitie de l'ecart, moins de quoi respirer, et
 * jamais plus que ce que l'appelant juge lisible.
 */
export function rayonPastille(ecart: number, max: number): number {
  return Math.min(max, (ecart / 2) * 0.88);
}
