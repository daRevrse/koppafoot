import { ImageResponse } from "next/og";
import { getCompMatchPublic } from "@/lib/match-public";
import { AfficheDeMarque, AfficheDeMatch, etatDuMatch, TAILLE_OG } from "@/lib/og";

// ============================================
// L'affiche d'un match de compétition.
//
// C'EST L'ADRESSE QUI CIRCULE VRAIMENT. La collection des amicaux est vide ;
// les rencontres qui existent aujourd'hui sont celles des compétitions, et
// c'est ce lien-là qu'on colle dans un groupe WhatsApp avant un match.
//
// Le surtitre porte le NOM DE LA COMPÉTITION en plus de l'état : hors de
// l'appli, « EN DIRECT » tout seul ne dit pas de quel tournoi il s'agit.
// ============================================

export const size = TAILLE_OG;
export const contentType = "image/png";
export const alt = "L'affiche du match sur KoppaFoot";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; mid: string }>;
}) {
  const { slug, mid } = await params;
  const match = await getCompMatchPublic(slug, mid);
  if (!match) return new ImageResponse(<AfficheDeMarque />, size);

  const { texte, couleur } = etatDuMatch(match.status, match.date, match.time);
  const joue = match.status === "live" || match.status === "completed";
  const surtitre = match.competition ? `${match.competition} · ${texte}` : texte;

  return new ImageResponse(
    <AfficheDeMatch
      surtitre={surtitre}
      couleurSurtitre={couleur}
      home={match.homeTeamName || "À déterminer"}
      away={match.awayTeamName || "À déterminer"}
      score={joue ? `${match.scoreHome ?? 0} - ${match.scoreAway ?? 0}` : null}
      lieu={[match.venueName, match.venueCity].filter(Boolean).join(", ")}
    />,
    size,
  );
}
