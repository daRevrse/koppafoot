/**
 * Les seuls hôtes d'où le serveur accepte d'aller chercher une image.
 *
 * MÊME RAISON QUE LE JOKER RETIRÉ DE next.config.ts. Une bannière, un logo de
 * compétition, un écusson sont des champs de document, et le serveur va les
 * CHERCHER : Satori, qui télécharge le `<img src>` d'une affiche, et la route
 * qui sert l'image à partager. Une adresse arbitraire dans ce champ ferait donc
 * émettre à notre serveur une requête vers où l'on veut — un service interne,
 * une adresse de métadonnées d'instance — et nous rendrait le corps de la
 * réponse. Les deux hôtes ci-dessous sont ceux du Storage du projet, les
 * seuls que le produit puisse produire en téléversant.
 *
 * Module à part, sans dépendance : l'aperçu de l'accueil s'en sert sans avoir
 * à charger le SDK admin que lib/match-public embarque.
 */
const HOTES_IMAGE = new Set([
  "firebasestorage.googleapis.com",
  "koppafoot.firebasestorage.app",
]);

/** L'adresse telle quelle si le serveur peut aller la chercher, `null` sinon. */
export function imageSure(valeur: unknown): string | null {
  if (typeof valeur !== "string" || !valeur) return null;
  try {
    const u = new URL(valeur);
    return u.protocol === "https:" && HOTES_IMAGE.has(u.hostname) ? valeur : null;
  } catch {
    return null;
  }
}
