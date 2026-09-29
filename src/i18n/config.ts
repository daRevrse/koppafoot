// ============================================
// Ce que le SERVEUR a le droit de lire.
//
// `src/i18n/index.tsx` porte « use client ». Un composant serveur qui importe
// une constante depuis un module client ne reçoit pas sa valeur mais une
// référence : le nom du cookie arrivait dans le layout sous la forme d'une
// fonction anonyme, la lecture échouait en silence et la langue restait le
// français quoi qu'on choisisse.
//
// Ce fichier n'a pas de directive, il est donc lisible des deux côtés. Tout
// ce dont le serveur a besoin vit ici.
// ============================================

export type Langue = "fr" | "en";

export const CLE_LANGUE = "koppafoot_langue";

/** Un an : la langue n'est pas une préférence qu'on redit chaque semaine. */
export const DUREE_COOKIE_LANGUE = 60 * 60 * 24 * 365;

/**
 * La locale des dates et des nombres, pour `toLocaleDateString` et `Intl`.
 *
 * L'ANGLAIS BRITANNIQUE, pas américain : « Sat 23 Aug », le jour avant le
 * mois et l'heure sur 24 h, comme au Ghana et au Nigeria, et comme sur toutes
 * les feuilles de match. « Aug 23, 7:00 PM » serait un dépaysement de plus.
 */
export const LOCALE: Record<Langue, string> = { fr: "fr-FR", en: "en-GB" };

/**
 * La langue d'une requête : le choix enregistré, sinon celle du navigateur.
 *
 * SANS CHOIX ENREGISTRÉ, L'ANGLAIS SEULEMENT POUR QUI NE LIT PAS LE FRANÇAIS.
 * Un joueur d'Accra qui ouvre le lien d'un match reçu sur WhatsApp ne trouvera
 * pas la bascule FR/EN, rangée dans les paramètres : c'est son navigateur
 * qui doit parler pour lui. Mais un navigateur qui liste le français, même en
 * second (« en-US,en;q=0.9,fr;q=0.8 »), appartient à quelqu'un qui le lit, et
 * le produit est entier en français, pas encore en anglais. Celui-là garde le
 * français, et la bascule reste à un geste.
 *
 * Sans en-tête du tout — robots d'indexation, aperçus de liens —, le français,
 * la langue d'origine du produit.
 */
export function langueDeLaRequete(cookie: string | undefined, accepte: string | null | undefined): Langue {
  if (cookie === "fr" || cookie === "en") return cookie;
  const lues = (accepte ?? "")
    .toLowerCase()
    .split(",")
    .map((morceau) => morceau.trim().split(";"))
    // « fr;q=0 » veut dire « surtout pas le français » : il ne compte pas.
    .filter(([, ...params]) => !params.some((p) => /^q=0(\.0*)?$/.test(p.trim())))
    .map(([etiquette]) => etiquette.split("-")[0]);
  if (lues.includes("fr")) return "fr";
  return lues.includes("en") ? "en" : "fr";
}
