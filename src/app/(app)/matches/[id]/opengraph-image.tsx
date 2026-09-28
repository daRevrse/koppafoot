import { getMatchPublic } from "@/lib/match-public";
import { imageDuMatch, TAILLE_OG } from "@/lib/og";

// ============================================
// L'affiche du match amical, dessinée pour l'aperçu du lien.
//
// C'est la moitié qui manque au partage : le titre dit quel match, l'image
// dit à quoi il ressemble. Dans un fil WhatsApp, une vignette avec les deux
// noms et le score se reconnaît sans être lue, là où une ligne de texte
// grise ressemble à n'importe quel autre lien.
//
// SURCHARGE l'image par défaut de la racine, pour ce segment seulement.
// ============================================

export const size = TAILLE_OG;
export const contentType = "image/png";
export const alt = "L'affiche du match sur KoppaFoot";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Introuvable (supprimé, ou une adresse qui traîne dans une vieille
  // conversation) : l'affiche de marque. Une bannière posée à la main passe
  // devant l'affiche dessinée. Voir lib/og.
  return imageDuMatch(await getMatchPublic(id));
}
