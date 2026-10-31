import { retenirLeLien } from "~/lib/lien-entrant";
import { cheminDuSite } from "~/lib/lien-notification";

/**
 * Une adresse reçue d'Android, avant que le routeur ne la lise. Un lien du site
 * (WhatsApp, un e-mail : voir `intentFilters` dans app.json) n'est pas une route
 * de l'application, il finirait sur un écran introuvable. On le retient, et
 * _layout ouvre son écran comme celui d'une notification touchée.
 *
 * Au lancement, le routeur part du Direct : le retour y ramènera. L'application
 * déjà ouverte, il ne bouge pas : l'écran s'empile sur celui où l'on était.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string | null {
  const chemin = cheminDuSite(path);
  if (!chemin) return path;
  retenirLeLien(chemin);
  return initial ? "/" : null;
}
