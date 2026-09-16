// ============================================
// LA COULEUR D'UN MAILLOT, TELLE QU'ON LA PEINT SUR UN TERRAIN.
//
// POURQUOI CE FICHIER EXISTE. La couleur d'une equipe etait deja saisie a deux
// endroits — le manager la choisit sur sa fiche d'equipe, l'organisateur sur
// celle d'une equipe de competition — et elle ne servait qu'a UNE chose :
// remplir le carre du logo quand il n'y a pas de logo. Personne ne la portait
// sur le terrain, ou onze pastilles restaient blanches des deux cotes.
//
// Elle y devient necessaire le jour ou la console couchee montre les DEUX
// camps a la fois : c'est alors la seule chose qui distingue une moitie
// d'ecran de l'autre d'un coup d'oeil, c'est-a-dire ce qu'on regarde avant de
// poser le doigt.
//
// DEUX VOCABULAIRES POUR LE MEME CHAMP, et c'est le piege. `Team.color` porte
// un NOM — « emerald », « blue » — que la fiche d'equipe traduit en classe
// Tailwind. `CompTeam.color` porte un HEXADECIMAL, que la page de
// l'organisateur pose directement en `backgroundColor`. Le meme nom de champ,
// deux formes, et un SVG qui ne sait peindre ni l'une ni l'autre sans qu'on
// tranche. Ce fichier accepte les deux et rend toujours du peignable.
//
// ON NE CHOISIT PAS LA COULEUR DU NUMERO, ON LA CALCULE. Un maillot jaune
// demande un numero noir, un maillot bleu nuit un numero blanc, et personne ne
// veut saisir les deux. Le contraste se mesure (voir `luminance`), et la
// mesure ne se trompe pas sur les cas limites ou l'oeil hesite.
// ============================================

/**
 * Ce qu'une equipe porte sur le terrain.
 *
 * Le gardien a les siennes : c'est le seul joueur qu'on cherche pour une
 * raison precise — l'arret — et le seul qui n'a pas le droit de porter la
 * couleur de ses dix coequipiers.
 */
export interface CouleursEquipe {
  maillot: string;
  texte: string;
  gardien: string;
  texteGardien: string;
}

/** Le blanc d'avant, quand une equipe n'a rien declare. */
export const COULEURS_PAR_DEFAUT: CouleursEquipe = {
  maillot: "#ffffff",
  texte: "#111827",
  gardien: "#fde68a",
  texteGardien: "#111827",
};

/**
 * Les noms que `Team.color` peut porter.
 *
 * Ce sont les six de la fiche d'equipe, au ton 500 de leur echelle — celui que
 * `bg-emerald-500` peint, pour que le terrain montre la couleur que le manager
 * a vue en la choisissant.
 */
const NOMS: Record<string, string> = {
  emerald: "#10b981",
  blue: "#3b82f6",
  red: "#ef4444",
  amber: "#f59e0b",
  purple: "#a855f7",
  orange: "#f97316",
};

/** Le maillot du gardien, quand celui de son equipe le laisse tranquille. */
const GARDIEN_CLAIR = "#fde68a";
/** Son repli, quand l'equipe joue deja dans ces tons. */
const GARDIEN_SOMBRE = "#1f2937";

/** « #abc » ou « #aabbcc » → `[r, g, b]`. `null` si ce n'en est pas un. */
function versRvb(hex: string): [number, number, number] | null {
  const t = hex.trim().replace(/^#/, "");
  const complet = t.length === 3 ? t.split("").map((c) => c + c).join("") : t;
  if (!/^[0-9a-fA-F]{6}$/.test(complet)) return null;
  return [
    Number.parseInt(complet.slice(0, 2), 16),
    Number.parseInt(complet.slice(2, 4), 16),
    Number.parseInt(complet.slice(4, 6), 16),
  ];
}

/**
 * La luminance relative, au sens de WCAG.
 *
 * PAS LA MOYENNE DES TROIS CANAUX, et c'est tout l'interet : l'oeil est
 * beaucoup plus sensible au vert qu'au bleu. Une moyenne naive juge un bleu
 * nuit et un vert vif aussi clairs l'un que l'autre, et met du texte noir sur
 * le bleu nuit.
 */
function luminance(hex: string): number {
  const rvb = versRvb(hex);
  if (!rvb) return 1;
  const [r, v, b] = rvb.map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * v + 0.0722 * b;
}

/** Le contraste entre deux couleurs, de 1 (identiques) a 21 (noir sur blanc). */
export function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Le numero se lit sur le maillot, ou il ne sert a rien.
 *
 * On compare les deux seuls candidats — un noir d'encre et un blanc — et on
 * garde celui qui contraste le plus. C'est une mesure, pas un seuil : elle ne
 * se trompe pas sur les tons moyens, ou un « clair ou sombre ? » a la main
 * hesite et choisit parfois mal.
 */
function encrePour(fond: string): string {
  return contraste(fond, "#111827") >= contraste(fond, "#ffffff") ? "#111827" : "#ffffff";
}

/**
 * La couleur telle qu'elle est peignable, quelle que soit sa forme en base.
 *
 * Rend `null` pour ce qu'on ne sait pas lire, plutot qu'une couleur inventee :
 * l'appelant retombe alors sur le blanc par defaut, qui est ce que le terrain
 * montrait avant.
 */
export function versHex(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const t = String(valeur).trim();
  if (NOMS[t.toLowerCase()]) return NOMS[t.toLowerCase()];
  const rvb = versRvb(t);
  return rvb ? `#${rvb.map((c) => c.toString(16).padStart(2, "0")).join("")}` : null;
}

/**
 * Le maillot complet d'une equipe, a partir de ce qu'elle a declare.
 *
 * LE GARDIEN NE DOIT PAS SE FONDRE DANS SON EQUIPE. Il porte un jaune pale,
 * qui se distingue de presque tout — sauf d'une equipe qui joue justement en
 * jaune ou en orange. Dans ce cas seulement il passe au sombre : c'est le
 * contraste avec SES COEQUIPIERS qui decide, et non un gout.
 */
export function couleursDuMaillot(valeur: string | null | undefined): CouleursEquipe {
  const maillot = versHex(valeur);
  if (!maillot) return COULEURS_PAR_DEFAUT;

  const gardien = contraste(maillot, GARDIEN_CLAIR) >= 1.6 ? GARDIEN_CLAIR : GARDIEN_SOMBRE;
  return {
    maillot,
    texte: encrePour(maillot),
    gardien,
    texteGardien: encrePour(gardien),
  };
}

/**
 * Une couleur dans l'espace CIE Lab.
 *
 * LE CONTRASTE NE SAIT PAS REPONDRE A LA QUESTION SUIVANTE, et c'est le piege
 * dans lequel ce fichier est tombe d'abord : il mesure la CLARTE, pas la
 * teinte. Le bleu `#3b82f6` et le rouge `#ef4444` ont presque la meme
 * luminance — leur rapport de contraste vaut 1,2, celui de deux couleurs
 * identiques — alors que l'oeil ne les confondra jamais. Juger une tenue de
 * match la-dessus aurait declare un derby bleu-rouge « indistinguable ».
 *
 * Lab, lui, est construit pour que la distance entre deux points ressemble a
 * l'ecart que l'oeil percoit. C'est la seule facon honnete de repondre.
 */
function versLab(hex: string): [number, number, number] {
  const rvb = versRvb(hex) ?? [255, 255, 255];
  const [r, v, b] = rvb.map((c) => {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  // Vers XYZ, illuminant D65.
  const X = (r * 0.4124 + v * 0.3576 + b * 0.1805) / 0.95047;
  const Y = r * 0.2126 + v * 0.7152 + b * 0.0722;
  const Z = (r * 0.0193 + v * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** L'ecart percu entre deux couleurs (CIE76). Zero = identiques. */
export function ecartPercu(a: string, b: string): number {
  const [l1, a1, b1] = versLab(a);
  const [l2, a2, b2] = versLab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * Les deux equipes se distinguent-elles ?
 *
 * Le produit ne connait qu'UN maillot par equipe : il n'a pas de tenue
 * exterieure, donc rien ne se substitue quand deux clubs jouent dans le meme
 * ton. Ce n'est pas un defaut d'affichage a rattraper en douce — recolorer une
 * equipe serait mentir sur ce qu'elle porte. On sait le DIRE, et l'appelant
 * decide s'il le montre.
 *
 * 25 : un ecart de 2,3 est le plus petit que l'oeil distingue en laboratoire ;
 * a la taille d'une pastille, ou la couleur n'occupe que quelques dizaines de
 * pixels et ou l'on regarde vite, il en faut dix fois plus pour que deux
 * equipes ne se melangent pas.
 */
export function maillotsTropProches(a: CouleursEquipe, b: CouleursEquipe): boolean {
  return ecartPercu(a.maillot, b.maillot) < 25;
}
