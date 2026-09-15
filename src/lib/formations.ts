import type { Poste } from "@/lib/postes";

// ============================================
// LA FORME D'UNE ÉQUIPE, CHOISIE ET NON DEVINÉE.
//
// CE QUI EXISTAIT. Le terrain plaçait les joueurs par leur POSTE — gardien,
// défenseur, milieu, attaquant — sur quatre rangs fixes, et se repliait sur un
// dispositif par taille d'équipe quand personne n'avait de poste déclaré. La
// forme était donc une CONSÉQUENCE de la feuille, jamais une décision.
//
// Trois choses lui manquaient, et ce sont exactement les trois que le choix
// d'une formation apporte :
//
//   — LES SOUS-LIGNES. Un 4-2-3-1 et un 4-4-2 alignent tous deux quatre
//     défenseurs et cinq milieux ; ils ne se ressemblent pourtant pas, et la
//     différence tient entièrement à la façon dont le milieu se coupe en deux.
//     Avec un seul rang de milieu, un 4-2-3-1 se dessinait en 4-5-1.
//
//   — LE PLACEMENT QUAND LE POSTE MANQUE. Deux tiers des lignes d'effectif
//     n'en portent pas. Le terrain les mettait alors sur un rang « ? » à part,
//     ou repliait toute l'équipe sur un 4-3-3 par ordre de feuille. Une
//     formation choisie dit la forme même quand la feuille se tait.
//
//   — CE QUE LE MANAGER ANNONCE. La feuille lui disait combien de défenseurs
//     « tient » un match de cette taille. Elle ne lui demandait pas ce qu'il
//     comptait aligner.
//
// ON NE DIT PAS LA TACTIQUE, ON DIT LA FORME. Une formation, ici, c'est un
// nombre de lignes et un effectif par ligne. Rien sur le pressing, les
// couvertures ou les rôles — ce produit n'a pas à en savoir autant, et un
// manager de club amateur ne le saisirait pas.
//
// L'ORDRE EST CELUI QU'ON ÉCRIT SUR UN TABLEAU : de la défense vers
// l'attaque, gardien non compté. « 4-3-3 » se lit quatre derrière, trois au
// milieu, trois devant — et c'est le sens dans lequel tout le monde le dit.
// Le terrain, lui, dessine de l'attaque vers le but ; c'est lui qui retourne
// la liste, pas ce fichier.
// ============================================

/** Les lignes de champ, de la défense vers l'attaque. Le gardien n'y est pas. */
export type Formation = number[];

/**
 * Ce qu'on propose, par taille d'équipe (gardien compris).
 *
 * LA PREMIÈRE DE CHAQUE LISTE EST LA PLUS COURANTE, et c'est elle qu'on
 * propose par défaut. Les autres sont celles qu'on voit vraiment sur les
 * terrains de cette taille — un 5v5 ne se joue pas en 4-3-3 avec des trous,
 * il a ses propres formes.
 *
 * IL N'Y A PAS QUE DU 11 CONTRE 11 : une compétition se joue en NvN, quatre à
 * onze, et un amical se déclare en 5v5, 7v7 ou 11v11.
 */
const CATALOGUE: Record<number, readonly string[]> = {
  4: ["2-1", "1-2", "3"],
  5: ["2-1-1", "1-2-1", "2-2", "1-3"],
  6: ["2-2-1", "2-1-2", "3-1-1", "3-2"],
  7: ["2-3-1", "3-2-1", "2-1-2-1", "3-1-2"],
  8: ["3-3-1", "3-2-2", "2-3-2", "3-1-3"],
  9: ["3-3-2", "3-4-1", "4-3-1", "3-2-3"],
  10: ["4-3-2", "3-4-2", "4-4-1", "3-3-3"],
  11: ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-5-1", "3-4-3", "4-1-4-1"],
};

/** « 4-3-3 » → `[4, 3, 3]`. `null` si ce n'est pas une formation. */
export function versFormation(texte: string | null | undefined): Formation | null {
  if (!texte) return null;
  const lignes = String(texte).split("-").map((n) => Number.parseInt(n, 10));
  if (lignes.length < 1 || lignes.some((n) => !Number.isFinite(n) || n < 1)) return null;
  return lignes;
}

/** `[4, 3, 3]` → « 4-3-3 ». */
export function versTexte(f: Formation): string {
  return f.join("-");
}

/** Combien de joueurs cette formation aligne, gardien compris. */
export function tailleDe(f: Formation): number {
  return f.reduce((n, l) => n + l, 0) + 1;
}

/**
 * Les formations proposées pour une taille d'équipe.
 *
 * Hors catalogue — un effectif de douze, une feuille mal saisie — on n'invente
 * pas une liste : on rend celle que le dispositif de secours produit déjà,
 * pour que le menu ne soit jamais vide et que son unique choix soit exactement
 * ce que le terrain dessinait avant ce fichier.
 */
export function formationsPour(taille: number, repli: [number, number, number]): string[] {
  const connues = CATALOGUE[taille];
  if (connues) return [...connues];
  return [repli.filter((n) => n > 0).join("-") || "1"];
}

/** La formation proposée d'office pour cette taille. */
export function formationParDefaut(taille: number, repli: [number, number, number]): string {
  return formationsPour(taille, repli)[0];
}

/**
 * LE POSTE QUE CHAQUE LIGNE APPELLE.
 *
 * Une formation donne des lignes ; la feuille donne des postes. Il faut bien
 * les rapprocher, et la règle est celle que tout le monde lit sur un tableau :
 * la première ligne défend, la dernière attaque, tout ce qui est entre les
 * deux est le milieu.
 *
 * LE CAS À DEUX LIGNES EST LE PIÈGE, et il est fréquent sur petit terrain :
 * un « 2-2 » n'a pas de ligne de milieu du tout. Ses milieux déclarés ne
 * doivent pas disparaître pour autant — ils tomberont dans le remplissage,
 * sur la ligne qui a encore de la place. C'est pourquoi cette fonction dit ce
 * qu'une ligne PRÉFÈRE, et non ce qu'elle exige.
 */
export function postePrefere(f: Formation, index: number): Poste {
  if (index === 0) return "defender";
  if (index === f.length - 1) return "forward";
  return "midfielder";
}

/**
 * Combien de joueurs cette formation attend à chaque poste.
 *
 * Sert à la feuille de match, qui annonce au manager ce qu'il lui reste à
 * placer. Sur une formation à deux lignes, le milieu vaut zéro — ce qui est
 * la vérité de cette forme-là, et non un oubli.
 */
export function effectifParPoste(f: Formation): Record<Poste, number> {
  const compte: Record<Poste, number> = {
    goalkeeper: 1, defender: 0, midfielder: 0, forward: 0,
  };
  f.forEach((n, i) => {
    compte[postePrefere(f, i)] += n;
  });
  return compte;
}
