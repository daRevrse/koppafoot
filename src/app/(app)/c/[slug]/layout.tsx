import type { Metadata } from "next";
import { getCompetitionLanding } from "@/lib/competition-admin";

// Pages publiques d'une competition (/c/[slug]/**), dans le shell general.
//
// Ce layout ne fait plus que centrer : la barre d'onglets qu'il portait a
// rejoint la page principale, ou les onglets changent le contenu d'une carte
// au lieu de changer de page. Les routes filles qui restent, un match, une
// equipe, la page d'inscription, portent leur propre fil d'ariane.
//
// ============================================
// IL PORTE AUSSI LE TITRE ET L'APERÇU DU LIEN.
//
// /c/<slug> EST L'ADRESSE CANONIQUE DU PRODUIT : celle que le sitemap
// déclare, celle que l'organisateur envoie, celle qu'un supporter garde en
// favori. Elle n'annonçait pourtant rien — la page est un composant client,
// donc sans `generateMetadata` possible, et seule la page d'inscription qui
// vit dessous en avait un. Le lien vers la compétition arrivait plus nu que
// le lien vers son formulaire d'inscription.
//
// C'est ce layout, composant serveur, qui répare ça, et les pages filles
// héritent du nom de la compétition quand elles n'annoncent rien de plus
// précis — /rejoindre et /matches/[mid], eux, le remplacent.
// ============================================

export async function generateMetadata(
  { params }: PageProps<"/c/[slug]">,
): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getCompetitionLanding(slug);
  // Slug inconnu, ou compétition en brouillon : on ne pose rien plutôt que
  // d'annoncer un événement qui n'a pas été rendu public.
  if (!landing) return {};

  const { competition, teams } = landing;
  const ou = competition.venueCity ? ` à ${competition.venueCity}` : "";
  const description =
    competition.status === "registration"
      ? `Les inscriptions sont ouvertes${ou}. ${teams.length} équipe${teams.length > 1 ? "s" : ""} déjà engagée${teams.length > 1 ? "s" : ""}.`
      : `Calendrier, scores en direct et classements de ${competition.name}${ou}.`;

  return {
    title: competition.name,
    description,
    openGraph: { title: competition.name, description, type: "website" },
    twitter: { card: "summary_large_image", title: competition.name, description },
  };
}

export default function PublicCompetitionLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="mx-auto max-w-6xl">{children}</div>;
}
