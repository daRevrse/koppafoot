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
//
// L'EMPLACEMENT CHOISI PAR LE MANAGER PASSE AVANT TOUT LE RESTE. Le poste
// dit sur quelle LIGNE un joueur joue, jamais a quelle place de la ligne : un
// arriere droit et un arriere gauche sont deux defenseurs. Le terrain rangeait
// donc chaque ligne dans l'ordre de la feuille, et le manager qui touchait la
// place d'arriere droit voyait son joueur partir tout a gauche. Une ligne de
// feuille peut maintenant porter son `emplacement` — ligne et colonne de la
// formation — et le terrain le respecte a la case pres. Les autres joueurs se
// rangent comme avant, dans les cases qui restent.
// ============================================

import { normaliserPoste, type Poste } from "@/lib/postes";
import { postePrefere, type Formation } from "@/lib/formations";
import type { LineupEntry } from "@/types";

/**
 * Une case de la formation.
 *
 * `ligne` 0 est le gardien, puis les lignes de champ dans l'ordre ou on ECRIT
 * la formation : la defense d'abord, l'attaque en dernier — « 4-3-3 » a ses
 * quatre defenseurs en ligne 1. `colonne` 0 est l'aile GAUCHE de l'equipe,
 * vue de son propre but vers l'attaque ; c'est la gauche du joueur, pas celle
 * de l'ecran (voir le sens « gauche », qui les oppose).
 *
 * Elle n'a de sens que pour la formation ou elle a ete choisie. Changer de
 * formation la rend caduque — les editeurs l'effacent alors, et le terrain
 * ignore de lui-meme une case qui n'existe pas.
 */
export interface Emplacement {
  ligne: number;
  colonne: number;
}

export interface PlaceTerrain {
  x: number;
  y: number;
  /** Null sur un emplacement que personne n'occupe (repli 4-3-3 seulement). */
  entry: LineupEntry | null;
  /** La lettre de l'emplacement : G, D, M, A, ou ? faute de poste declare. */
  etiquette: string;
  /**
   * La case de la formation. Null hors formation : les cinq rangs par poste
   * n'ont pas de cases, seulement un ordre.
   */
  emplacement: Emplacement | null;
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
  /**
   * La coordonnee du k-ieme rang d'une FORMATION, 0 = gardien, n = l'attaque.
   *
   * Les cinq rangs par poste sont a un ecart FIXE, et laissent un trou la ou
   * un rang est vide — c'est voulu, ce trou dit qu'il n'y a personne a ce
   * poste. Une formation, elle, annonce exactement ses lignes : il n'y a plus
   * de rang vide a signaler, et les lignes se repartissent donc sur toute la
   * profondeur, quel que soit leur nombre. Un 4-2-3-1 a cinq rangs la ou un
   * 4-4-2 en a quatre, et les deux occupent le meme terrain.
   */
  rangDeFormation: (k: number, n: number) => number;
  /** L'ecart entre deux rangs d'une formation de n lignes de champ. */
  pasDeFormation: (n: number) => number;
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
    // Du gardien (90) vers l'attaque (26).
    rangDeFormation: (k, n) => (n < 1 ? 90 : 90 - (90 - 26) * (k / n)),
    pasDeFormation: (n) => (n < 1 ? 64 : (90 - 26) / n),
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
    // Du gardien (20, au bord) vers l'attaque (180, vers le centre).
    rangDeFormation: (k, n) => (n < 1 ? 20 : 20 + (180 - 20) * (k / n)),
    pasDeFormation: (n) => (n < 1 ? 160 : (180 - 20) / n),
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
    rangDeFormation: (k, n) => (n < 1 ? 180 : 180 - (180 - 20) * (k / n)),
    pasDeFormation: (n) => (n < 1 ? 160 : (180 - 20) / n),
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
    // LE MIROIR EST AUSSI EN TRAVERS. Une equipe qui attaque vers la gauche
    // de l'ecran a son aile gauche EN BAS : c'est ce qu'on voit depuis la
    // tribune. Tant que l'ordre d'une ligne n'etait que celui de la feuille,
    // la question ne se posait pas ; maintenant que le manager place son
    // arriere gauche a gauche, il doit l'y retrouver dans la console.
    place: (rang, travers) => ({ x: rang, y: 20 + 92 - travers }),
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
 * LES LIGNES D'UNE FORMATION, GARNIES AVEC CETTE FEUILLE.
 *
 * TROIS PASSES, ET L'ORDRE COMPTE.
 *
 * La premiere pose ceux dont le manager a CHOISI la case (`emplacement`) :
 * c'est une decision, rien ne la deplace. Une case qui n'existe pas dans
 * cette formation, ou deja prise par une ligne precedente de la feuille, ne
 * vaut rien — le joueur se range alors comme les autres.
 *
 * La deuxieme ne donne a chaque ligne que des joueurs DE SON POSTE : sans
 * elle, la ligne de defense se remplirait du premier venu et le milieu
 * declare finirait devant. La troisieme comble ce qui reste, en servant
 * d'abord ceux QUI N'ONT PAS DE POSTE — ils n'expriment aucune preference,
 * autant qu'ils bouchent les trous avant qu'on deplace quelqu'un qui, lui, a
 * dit ou il joue. Ces deux passes remplissent les cases LIBRES, de gauche a
 * droite : elles ne touchent jamais a une case choisie.
 *
 * LA FORME CHOISIE L'EMPORTE SUR LES POSTES DECLARES, et c'est tout l'interet
 * de la choisir. Six defenseurs sur la feuille d'un 3-5-2 donnent trois
 * defenseurs et cinq milieux : les trois en trop jouent plus haut, parce que
 * c'est ce que veut dire annoncer un 3-5-2. Le terrain ne discute pas la
 * decision du manager, il la dessine.
 *
 * ON NE PERD PERSONNE POUR AUTANT. Une feuille plus courte que la formation
 * laisse des places VIDES, qui gardent leur lettre — il manque quelqu'un, et
 * le terrain doit le dire. Une feuille plus longue elargit le rang du poste
 * concerne plutot que de laisser quelqu'un dehors : un rang trop charge se
 * voit, un joueur absent du terrain ne se voit pas.
 *
 * Sans case choisie, l'ordre de la feuille est conserve a l'interieur d'une
 * ligne : c'est le seul indice qu'on ait alors sur qui joue a gauche.
 */
function rangsDeFormation(
  titulaires: LineupEntry[],
  formation: Formation,
): { etiquette: string; cellules: (LineupEntry | null)[] }[] {
  // La grille : le but, puis chaque ligne de champ a sa capacite.
  const grille: (LineupEntry | null)[][] = [1, ...formation].map((n) =>
    Array.from({ length: n }, () => null),
  );
  const restants = [...titulaires];
  const retirer = (e: LineupEntry) => {
    const i = restants.indexOf(e);
    if (i >= 0) restants.splice(i, 1);
  };

  // 1. Les cases choisies.
  for (const e of titulaires) {
    const emp = e.emplacement;
    if (!emp) continue;
    const ligne = grille[emp.ligne];
    if (!ligne || emp.colonne >= ligne.length || ligne[emp.colonne]) continue;
    ligne[emp.colonne] = e;
    retirer(e);
  }

  // Le gardien ensuite : il a sa ligne a lui, et c'est le seul poste dont la
  // formation ne parle pas — « 4-3-3 » compte dix joueurs de champ.
  //
  // PERSONNE N'A DECLARE DE POSTE : la premiere ligne de la feuille garde le
  // but. C'est ce que le repli par taille faisait deja, et c'est moins
  // mensonger que de laisser le but vide en placant onze joueurs de champ.
  // Mais si QUELQU'UN a un poste et que personne n'est gardien, le but reste
  // vide : la feuille a ete renseignee, et il y manque le gardien.
  if (!grille[0][0]) {
    const aucunPoste = restants.every((e) => normaliserPoste(e.position) === null);
    const gardien =
      restants.find((e) => normaliserPoste(e.position) === "goalkeeper")
      ?? (aucunPoste ? restants[0] ?? null : null);
    if (gardien) {
      grille[0][0] = gardien;
      retirer(gardien);
    }
  }

  const lignes = formation.map((_, i) => ({
    poste: postePrefere(formation, i),
    cellules: grille[i + 1],
  }));

  // 2. Chaque ligne, avec les joueurs de son poste.
  for (const l of lignes) {
    for (let c = 0; c < l.cellules.length; c++) {
      if (l.cellules[c]) continue;
      const e = restants.find((x) => normaliserPoste(x.position) === l.poste);
      if (!e) break;
      l.cellules[c] = e;
      retirer(e);
    }
  }

  // 3. Les cases qui restent : ceux sans poste d'abord.
  const sansPoste = restants.filter((e) => normaliserPoste(e.position) === null);
  const avecPoste = restants.filter((e) => normaliserPoste(e.position) !== null);
  const aCaser = [...sansPoste, ...avecPoste];
  for (const l of lignes) {
    for (let c = 0; c < l.cellules.length && aCaser.length > 0; c++) {
      if (l.cellules[c]) continue;
      const e = aCaser.shift()!;
      l.cellules[c] = e;
      retirer(e);
    }
  }

  // Ce qui deborde encore : la feuille aligne plus de monde que la formation.
  for (const e of aCaser) {
    const poste = normaliserPoste(e.position);
    const cible =
      lignes.find((l) => l.poste === poste) ?? lignes[Math.floor(lignes.length / 2)];
    if (cible) cible.cellules.push(e);
  }

  const ETIQUETTES: Record<Poste, string> = {
    goalkeeper: "G", defender: "D", midfielder: "M", forward: "A",
  };

  // Du gardien vers l'attaque : c'est l'ordre dans lequel la geometrie range
  // ses rangs, et celui des `ligne` d'un emplacement.
  return [
    { etiquette: "G", cellules: grille[0] },
    ...lignes.map((l) => ({ etiquette: ETIQUETTES[l.poste], cellules: l.cellules })),
  ];
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
  /**
   * La forme annoncee par le manager, quand il en a choisi une.
   *
   * ABSENTE, RIEN NE CHANGE : on place par poste sur les cinq rangs fixes,
   * exactement comme avant ce parametre. Les deux chemins coexistent parce
   * qu'une feuille validee avant l'arrivee des formations n'en porte pas, et
   * qu'elle doit continuer de se dessiner comme elle se dessinait.
   */
  formation: Formation | null = null,
): Disposition {
  const g = GEOMETRIES[sens];

  if (formation && formation.length > 0) {
    const rangs = rangsDeFormation(titulaires, formation);
    const largeur = g.traversMax - g.traversMin;
    const plusCharge = Math.max(...rangs.map((r) => r.cellules.length), 1);
    const ecart = plusCharge > 1 ? largeur / (plusCharge - 1) : largeur;

    const places: PlaceTerrain[] = [];
    rangs.forEach((rang, k) => {
      // La COLONNE donne la place en travers, que la case soit occupee ou
      // non : c'est ce qui laisse un arriere droit a droite quand ses trois
      // voisins ne sont pas encore choisis.
      const traverses = abscisses(rang.cellules.length, plusCharge, g);
      rang.cellules.forEach((entry, colonne) => {
        places.push({
          ...g.place(g.rangDeFormation(k, formation.length), traverses[colonne]),
          entry,
          etiquette: rang.etiquette,
          emplacement: { ligne: k, colonne },
        });
      });
    });

    // Meme regle qu'en bas : le nom tient sous la pastille, donc l'axe
    // vertical doit loger `2r + INTERLIGNE`. Seule la source de cette hauteur
    // change — ici l'ecart des lignes de la formation, qui depend de leur
    // NOMBRE et non plus d'une constante.
    const pasVertical = g.nomsSurLeTravers ? ecart : g.pasDeFormation(formation.length);
    return {
      places,
      ecart,
      rayonMax: Math.min(g.plafond, (pasVertical - INTERLIGNE) / 2),
    };
  }

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
        emplacement: null,
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

// ---- Placer a la main ----------------------------------------------------------

/** Le poste que DIT une ligne de cette formation : le but, puis defense → attaque. */
export function posteDeLigne(formation: Formation, ligne: number): Poste {
  return ligne === 0 ? "goalkeeper" : postePrefere(formation, ligne - 1);
}

export function memeEmplacement(a: Emplacement | null | undefined, b: Emplacement | null | undefined): boolean {
  return !!a && !!b && a.ligne === b.ligne && a.colonne === b.colonne;
}

/**
 * Lit un emplacement en base, sans lui faire confiance : deux entiers
 * positifs, ou rien. Une feuille ecrite avant ce champ n'en a pas, et c'est
 * le cas normal.
 */
export function lireEmplacement(brut: unknown): Emplacement | null {
  if (!brut || typeof brut !== "object") return null;
  const { ligne, colonne } = brut as Record<string, unknown>;
  const entier = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 30;
  return entier(ligne) && entier(colonne) ? { ligne, colonne } : null;
}

/** Ou est chaque titulaire, et quel poste sa case lui donne. */
export interface Placement {
  emplacement: Emplacement;
  poste: Poste;
}

/**
 * Mettre un joueur dans une case — qu'il vienne d'une autre case, du banc, ou
 * de nulle part.
 *
 * TOUT LE MONDE SE FIGE D'ABORD. Chaque titulaire recoit la case ou il est
 * DESSINE en ce moment, y compris ceux que le terrain avait ranges tout seul.
 * Sans ca, deplacer un joueur liberait sa case, et le rangement automatique
 * faisait glisser ses voisins pour la combler : on bougeait un joueur, trois
 * bougeaient. Ce qu'on voit ne change plus que la ou on l'a touche.
 *
 * LA CASE PRISE S'ECHANGE. L'occupant part la d'ou vient le joueur : dans son
 * ancienne case s'il en avait une, sinon il est `deloge` — l'editeur decide
 * alors de ce qu'il devient (le banc, en general).
 *
 * Le poste suit la case : un milieu pose en defense devient defenseur, sur ce
 * match. C'est ce que le terrain montre, et ce que la feuille doit dire.
 */
export function placerSurTerrain(
  places: PlaceTerrain[],
  formation: Formation,
  joueurId: string,
  vers: Emplacement,
): { placements: Record<string, Placement>; deloge: string | null } {
  const placements: Record<string, Placement> = {};
  const ou = (e: Emplacement): Placement => ({ emplacement: e, poste: posteDeLigne(formation, e.ligne) });

  for (const p of places) {
    if (p.entry && p.emplacement) placements[p.entry.playerId] = ou(p.emplacement);
  }

  const depart = placements[joueurId]?.emplacement ?? null;
  const occupant =
    places.find((p) => p.entry && memeEmplacement(p.emplacement, vers))?.entry?.playerId ?? null;
  if (occupant === joueurId) return { placements, deloge: null };

  placements[joueurId] = ou(vers);
  let deloge: string | null = null;
  if (occupant) {
    if (depart) {
      placements[occupant] = ou(depart);
    } else {
      delete placements[occupant];
      deloge = occupant;
    }
  }
  return { placements, deloge };
}
