import type { Metadata } from "next";
import { afficheDuMatch, getCompMatchPublic, phraseDuMatch } from "@/lib/match-public";

// ============================================
// Un layout qui ne dessine rien, et n'existe que pour le titre.
//
// La fiche du match est un composant client — score en direct, minuteur,
// composition — et un composant client ne peut pas exporter
// `generateMetadata`. Le lien le plus partagé du produit n'annonçait donc
// rien de plus que « KoppaFoot ».
//
// L'image d'aperçu vient du fichier voisin, opengraph-image.tsx.
// ============================================

export async function generateMetadata(
  { params }: PageProps<"/c/[slug]/matches/[mid]">,
): Promise<Metadata> {
  const { slug, mid } = await params;
  const match = await getCompMatchPublic(slug, mid);
  // Match inconnu, ou compétition en brouillon : on ne pose rien, la racine
  // fournit déjà un titre et une image corrects.
  if (!match) return {};

  const affiche = afficheDuMatch(match);
  const titre = match.competition ? `${affiche} · ${match.competition}` : affiche;
  const description = phraseDuMatch(match);

  return {
    title: titre,
    description,
    openGraph: { title: titre, description, type: "article" },
    twitter: { card: "summary_large_image", title: titre, description },
  };
}

export default function CompMatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
