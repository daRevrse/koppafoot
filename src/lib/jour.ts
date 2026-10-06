/**
 * La journée en cours à Lomé, « 2026-10-05 ».
 *
 * Lomé vit à l'heure GMT toute l'année (pas d'heure d'été) : la date UTC est
 * donc la bonne, sur le serveur comme dans le navigateur, où qu'il soit.
 * C'est elle qui dit si un partenaire est à l'affiche ou un droit encore
 * valable, deux dates écrites en « AAAA-MM-JJ » et comparées comme du texte.
 */
export function jourDeLome(maintenant: Date = new Date()): string {
  return maintenant.toISOString().slice(0, 10);
}
