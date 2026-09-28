// ============================================
// Mesurer un texte en Anton, sans navigateur.
//
// Satori ne dit pas combien un texte mesure : un titre trop large passe à la
// ligne au lieu de rétrécir — « SCORE » d'un côté, « FINAL » de l'autre —, ou
// laisse un mot seul sur la seconde ligne. Les images partagées (lib/og-da)
// calculent donc leur taille elles-mêmes, sur ces largeurs.
//
// LUES DANS LA POLICE, pas estimées : l'avance de chaque glyphe
// d'assets/fonts/Anton-Regular.ttf, dans ses propres unités. Arrondies en em
// glyphe par glyphe, elles perdaient un millième sur un mot de huit lettres.
// Les capitales seulement : ces
// titres sont toujours en capitales. Un caractère absent de la table compte
// pour un demi-em, un peu plus que la moyenne, pour qu'un texte imprévu
// déborde plutôt en trop petit qu'en trop grand.
// ============================================

/** Unités par em d'Anton-Regular.ttf. */
const UNITES = 2048;

/** L'avance de chaque glyphe, en unités de la police (lues avec fontTools). */
const LARGEURS: Record<string, number> = {
  A: 994, B: 980, C: 971, D: 1010, E: 843, F: 817, G: 993, H: 1022, I: 464, J: 955, K: 967,
  L: 814, M: 1528, N: 1020, O: 996, P: 967, Q: 1011, R: 976, S: 945, T: 810, U: 970, V: 961,
  W: 1458, X: 991, Y: 914, Z: 840,
  "0": 1012, "1": 677, "2": 1012, "3": 1012, "4": 1012, "5": 1012, "6": 1012, "7": 1012,
  "8": 1012, "9": 1012,
  " ": 480, "'": 438, "’": 475, "-": 637, "–": 637, "—": 1153, "·": 480, ".": 468, ",": 484,
  ":": 495, ";": 502, "&": 1065, "(": 596, ")": 596, "/": 830, "!": 469, "?": 1008, "\"": 878,
  "«": 1184, "»": 1184, "+": 728, "#": 1119,
  À: 994, Â: 994, Ä: 994, Ç: 971, É: 843, È: 843, Ê: 843, Ë: 843, Î: 464, Ï: 464, Ô: 996,
  Ö: 996, Ù: 970, Û: 970, Ü: 970, Ÿ: 914, Œ: 1330, Æ: 1311,
};

/** La largeur d'un texte en capitales d'Anton, en em. */
export function chasseAnton(texte: string): number {
  let total = 0;
  for (const c of texte.toLocaleUpperCase("fr-FR")) total += LARGEURS[c] ?? UNITES / 2;
  return Math.round((total / UNITES) * 1000) / 1000;
}

/**
 * Un titre en capitales, à la plus grande taille qui tient dans `largeur`.
 *
 * Sur UNE ligne tant qu'elle reste assez grosse (`seuil`) ; sinon sur DEUX,
 * coupées à l'espace qui équilibre le mieux les deux lignes — jamais un mot
 * seul qui traîne sous les autres. Jamais sous `min` : un nom d'un seul mot
 * interminable passe alors à la ligne de lui-même, mais reste lisible.
 */
export function titreAnton(
  texte: string,
  { largeur, max, min, seuil }: { largeur: number; max: number; min: number; seuil: number },
): { lignes: string[]; taille: number } {
  const propre = texte.trim().replace(/\s+/g, " ");
  const enUne = Math.min(max, Math.floor(largeur / Math.max(chasseAnton(propre), 0.001)));
  const mots = propre.split(" ");
  if (enUne >= seuil || mots.length < 2) return { lignes: [propre], taille: Math.max(min, enUne) };

  let meilleure: [string, string] = [propre, ""];
  let plusLarge = Infinity;
  for (let i = 1; i < mots.length; i++) {
    const a = mots.slice(0, i).join(" ");
    const b = mots.slice(i).join(" ");
    const w = Math.max(chasseAnton(a), chasseAnton(b));
    if (w < plusLarge) {
      plusLarge = w;
      meilleure = [a, b];
    }
  }
  const enDeux = Math.min(max, Math.floor(largeur / plusLarge));
  // Deux lignes à peine plus grosses qu'une seule ne valent pas la coupure.
  if (enDeux < enUne * 1.15) return { lignes: [propre], taille: Math.max(min, enUne) };
  return { lignes: meilleure, taille: Math.max(min, enDeux) };
}
