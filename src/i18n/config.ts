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

/** La langue d'une requête, à partir de la valeur brute du cookie. */
export function langueDepuisCookie(valeur: string | undefined): Langue {
  return valeur === "en" ? "en" : "fr";
}
