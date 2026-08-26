import { imageDeCompetition } from "@/lib/og-competition";
import { TAILLE_OG } from "@/lib/og";

// ============================================
// La même affiche que /c/[slug], mais déclarée ici.
//
// POURQUOI CE FICHIER EXISTE alors que le segment parent en a un. La page
// d'inscription déclare son propre objet `openGraph` dans son
// `generateMetadata`, et un objet déclaré REMPLACE celui du parent en entier,
// images comprises. Elle repartait donc sans aucune vignette — alors que
// c'est le lien qu'un organisateur envoie à un président de club, celui qui
// doit convaincre.
//
// Une bannière de compétition, quand il y en a une, reste prioritaire : la
// page la déclare explicitement dans ses `images`.
// ============================================

export const size = TAILLE_OG;
export const contentType = "image/png";
export const alt = "L'affiche de la compétition sur KoppaFoot";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return imageDeCompetition(slug);
}
