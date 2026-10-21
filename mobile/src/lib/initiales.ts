/**
 * « AS Douane Lomé » → « AD » : la première lettre des deux premiers mots,
 * pour un écusson ou un avatar sans image.
 *
 * NFC d'abord : un « É » saisi en deux caractères (E + accent) donnerait « E ».
 */
export function initiales(nom: string): string {
  return nom
    .normalize("NFC")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0]?.toUpperCase() ?? "")
    .join("");
}
