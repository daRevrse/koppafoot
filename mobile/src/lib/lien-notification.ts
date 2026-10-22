// Où mène une notification touchée. Le serveur y range une adresse du site
// (`data.link`, voir lib/push-categories du site) ; celles qui ont un écran
// dans l'application l'ouvrent, le reste s'ouvre sur le site, dans le
// navigateur intégré. Les adresses portent le slug de la compétition, pas
// son identifiant : l'écran se trouve une fois le slug lu (voir cidDuSlug).

import type { Href } from "expo-router";

export type Destination =
  | { genre: "competition"; slug: string }
  | { genre: "match"; slug: string; mid: string }
  | { genre: "equipe"; slug: string; tid: string }
  | { genre: "amical"; id: string }
  | { genre: "site"; lien: string };

/** Un morceau d'adresse décodé ; `null` s'il est mal encodé (« %E9 » seul). */
function decoder(morceau: string): string | null {
  try {
    return decodeURIComponent(morceau);
  } catch {
    return null;
  }
}

export function destinationDuLien(lien: string): Destination {
  const chemin = lien.split(/[?#]/)[0].replace(/\/+$/, "");
  const morceaux = chemin.split("/").slice(1).map(decoder);
  if (morceaux.some((m) => m === null)) return { genre: "site", lien };
  const [a, b, c, d, ...reste] = morceaux;
  if (reste.length === 0) {
    if (a === "c" && b && c === undefined) return { genre: "competition", slug: b };
    if (a === "c" && b && c === "matches" && d) return { genre: "match", slug: b, mid: d };
    if (a === "c" && b && c === "teams" && d) return { genre: "equipe", slug: b, tid: d };
    if (a === "matches" && b && c === undefined) return { genre: "amical", id: b };
  }
  return { genre: "site", lien };
}

/**
 * L'écran natif d'une destination, une fois son slug lu (`cid`) ; `null`
 * quand elle n'en a pas — l'adresse s'ouvre alors sur le site.
 */
export function ecranDeLaDestination(d: Destination, cid: string | null): Href | null {
  switch (d.genre) {
    case "amical":
      return { pathname: "/amical/[id]", params: { id: d.id } };
    case "competition":
      return cid ? { pathname: "/competition/[cid]", params: { cid } } : null;
    case "match":
      return cid ? { pathname: "/match/[cid]/[mid]", params: { cid, mid: d.mid } } : null;
    case "equipe":
      return cid ? { pathname: "/equipe/[cid]/[tid]", params: { cid, tid: d.tid } } : null;
    case "site":
      return null;
  }
}
