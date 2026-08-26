import { imageDeCompetition } from "@/lib/og-competition";
import { TAILLE_OG } from "@/lib/og";

// L'affiche de la compétition, pour /c/<slug> et les pages dessous qui n'en
// déclarent pas d'autre. Le dessin vit dans lib/og-competition, parce que la
// page d'inscription doit rendre le même et a besoin de son propre fichier.

export const size = TAILLE_OG;
export const contentType = "image/png";
export const alt = "L'affiche de la compétition sur KoppaFoot";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return imageDeCompetition(slug);
}
