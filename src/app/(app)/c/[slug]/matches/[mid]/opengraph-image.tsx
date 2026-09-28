import { getCompMatchPublic } from "@/lib/match-public";
import { imageDuMatch, TAILLE_OG } from "@/lib/og";

// ============================================
// L'affiche d'un match de compétition.
//
// C'EST L'ADRESSE QUI CIRCULE VRAIMENT. La collection des amicaux est vide ;
// les rencontres qui existent aujourd'hui sont celles des compétitions, et
// c'est ce lien-là qu'on colle dans un groupe WhatsApp avant un match.
//
// L'affiche porte la COMPÉTITION en plus de l'état — son logo, ou son nom
// quand elle n'en a pas : hors de l'appli, « EN DIRECT » tout seul ne dit
// pas de quel tournoi il s'agit.
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
  // LA BANNIÈRE PASSE DEVANT : quand l'organisateur en a posé une sur cette
  // rencontre, elle EST l'affiche. Voir lib/og.
  return imageDuMatch(await getCompMatchPublic(slug, mid));
}
