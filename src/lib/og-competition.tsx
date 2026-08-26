import { ImageResponse } from "next/og";
import { getCompetitionLanding } from "@/lib/competition-admin";
import { AfficheDeCompetition, AfficheDeMarque, ETATS_COMPETITION, TAILLE_OG } from "@/lib/og";

// ============================================
// L'aperçu d'une compétition, en une fonction.
//
// DEUX ROUTES L'APPELLENT : /c/[slug] et /c/[slug]/rejoindre. La seconde a
// besoin de son propre fichier — déclarer un objet `openGraph` dans un
// `generateMetadata` remplace celui du parent en entier, images comprises —
// mais elle doit montrer exactement la même affiche.
// ============================================

export async function imageDeCompetition(slug: string) {
  const landing = await getCompetitionLanding(slug);
  // Slug inconnu, ou compétition en brouillon : l'affiche de marque, plutôt
  // qu'une image vide qu'un robot garderait en cache.
  if (!landing) return new ImageResponse(<AfficheDeMarque />, TAILLE_OG);

  const { competition, teams, matchCount } = landing;

  // Une ligne de zéros dessert : on ne montre que les chiffres qui existent.
  const chiffres = [
    teams.length > 0 ? `${teams.length} équipe${teams.length > 1 ? "s" : ""}` : null,
    matchCount > 0 ? `${matchCount} match${matchCount > 1 ? "s" : ""}` : null,
    competition.venueCity,
  ].filter((x): x is string => !!x);

  return new ImageResponse(
    <AfficheDeCompetition
      nom={competition.name}
      etat={ETATS_COMPETITION[competition.status] ?? "COMPÉTITION"}
      chiffres={chiffres}
    />,
    TAILLE_OG,
  );
}
