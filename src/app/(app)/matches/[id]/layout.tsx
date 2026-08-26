import type { Metadata } from "next";
import { afficheDuMatch, getMatchPublic, phraseDuMatch } from "@/lib/match-public";

// ============================================
// Un layout qui ne dessine rien, et n'existe que pour le titre.
//
// La fiche du match est un composant client — état temps réel, minuteur,
// feuille de match — et un composant client ne peut pas exporter
// `generateMetadata`. Le lien partagé n'annonçait donc rien de plus que
// « KoppaFoot ».
//
// Ce layout, lui, est un composant serveur : il lit le match, en tire le
// titre et la phrase, et rend ses enfants tels quels. L'image d'aperçu vient
// du fichier voisin, opengraph-image.tsx.
//
// IL COUVRE AUSSI /live ET /manage, qui sont des enfants de ce segment. Ce
// n'est pas gênant : ces deux pages demandent un compte, personne ne les
// partage, et porter le nom du match plutôt que « KoppaFoot » dans l'onglet
// du navigateur les rend plutôt plus lisibles.
// ============================================

export async function generateMetadata(
  { params }: PageProps<"/matches/[id]">,
): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchPublic(id);
  // Match inconnu ou Firestore muet : on ne pose rien, la racine fournit
  // déjà un titre et une image corrects.
  if (!match) return {};

  const affiche = afficheDuMatch(match);
  const description = phraseDuMatch(match);

  return {
    title: affiche,
    description,
    openGraph: { title: affiche, description, type: "article" },
    twitter: { card: "summary_large_image", title: affiche, description },
  };
}

export default function MatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
