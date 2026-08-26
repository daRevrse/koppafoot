import { ImageResponse } from "next/og";
import { getMatchPublic } from "@/lib/match-public";
import { AfficheDeMarque, AfficheDeMatch, etatDuMatch, TAILLE_OG } from "@/lib/og";

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
  const match = await getMatchPublic(id);

  // Match introuvable — supprimé, ou une adresse qui traîne dans une vieille
  // conversation. On rend l'affiche de marque plutôt qu'une rencontre à un
  // seul camp, qui aurait l'air d'un défaut plutôt que d'un lien périmé.
  if (!match) return new ImageResponse(<AfficheDeMarque />, size);

  const { texte, couleur } = etatDuMatch(match.status, match.date, match.time);
  const joue = match.status === "live" || match.status === "completed";

  return new ImageResponse(
    <AfficheDeMatch
      surtitre={texte}
      couleurSurtitre={couleur}
      home={match.homeTeamName || "KoppaFoot"}
      away={match.awayTeamName}
      score={joue ? `${match.scoreHome ?? 0} - ${match.scoreAway ?? 0}` : null}
      lieu={[match.venueName, match.venueCity].filter(Boolean).join(", ")}
    />,
    size,
  );
}
