// Partage entre le serveur et le navigateur, aucun import du SDK serveur ici.
//
// Les competitions du football mondial entrent dans le tableau du Direct sous
// un identifiant prefixe. Le tableau s'en sert pour deux choses : router le
// lien vers /competitions/monde/[code], et ne pas les proposer en favori,
// on ne « suit » pas une competition qu'on ne fait que regarder passer.
export const WORLD_COMP_PREFIX = "__monde__";

/** Vrai si cet identifiant de competition vient du fournisseur externe. */
export function isWorldComp(id: string): boolean {
  return id.startsWith(WORLD_COMP_PREFIX);
}
