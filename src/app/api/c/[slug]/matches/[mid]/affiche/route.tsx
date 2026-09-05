import { ImageResponse } from "next/og";
import { getCompMatchPublic } from "@/lib/match-public";
import { banniereAPartager } from "@/lib/affiche-partage";
import { AfficheCarree, AfficheDeMarque, etatDuMatch, TAILLE_AFFICHE } from "@/lib/og";

// ============================================
// L'image d'un match de compétition, à partager.
//
// LA BANNIÈRE SI ELLE EXISTE, l'affiche dessinée sinon. C'est le seul endroit
// du produit où quelqu'un a explicitement choisi ce qu'il veut montrer d'une
// rencontre : un organisateur qui téléverse une bannière dans son calendrier
// a fait un travail que nul dessin automatique ne remplace.
//
// POURQUOI CETTE ROUTE EXISTE. Le jumeau des amicaux — /api/matches/[mid]
// /affiche — ne sait lire que la collection `matches`. Les rencontres de
// compétition vivent dans `competitions/<id>/comp_matches`, et ce sont
// justement elles qui portent une bannière, et elles dont l'adresse circule
// vraiment. Le bouton Partager de leur fiche n'avait donc aucune image à
// tendre : il envoyait le lien seul, là où le même bouton, sur un amical,
// envoyait une affiche.
//
// PAS UN `opengraph-image` : celui-là existe déjà à côté et sert l'aperçu de
// lien, dans son format paysage, à une adresse versionnée que le produit ne
// choisit pas et ne peut pas donner à `navigator.share`. Ici l'adresse est
// stable, parce qu'un bouton doit pouvoir aller chercher l'image.
//
// PUBLIQUE comme la fiche : les deux noms, l'heure et le terrain se lisent
// déjà sans compte, et c'est précisément ce qu'on envoie à quelqu'un qui n'en
// a pas encore.
// ============================================

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; mid: string }> },
) {
  const { slug, mid } = await params;
  const match = await getCompMatchPublic(slug, mid);

  // Match introuvable, ou compétition encore en brouillon : l'affiche de
  // marque. Une rencontre à un seul camp aurait l'air d'un défaut plutôt que
  // d'un lien périmé.
  if (!match) return new ImageResponse(<AfficheDeMarque />, TAILLE_AFFICHE);

  const banniere = await banniereAPartager(match);
  if (banniere) return banniere;

  const { texte, couleur } = etatDuMatch(match.status, match.date, match.time);
  const joue = match.status === "live" || match.status === "completed";

  // `etatDuMatch` rend la DATE BRUTE pour un match à venir — « 2026-09-05 » —
  // ce qui convient à un aperçu de lien, où elle est la seule mention du
  // quand. Ici la date est déjà au centre de l'affiche, en toutes lettres. Le
  // surtitre annonce donc la compétition, qui est ce qui manquerait le plus
  // à quelqu'un qui découvre l'image hors du produit.
  const surtitre =
    joue || match.status === "cancelled"
      ? [match.competition, texte].filter(Boolean).join(" · ")
      : match.competition || "COMPÉTITION";

  return new ImageResponse(
    <AfficheCarree
      surtitre={surtitre}
      couleurSurtitre={couleur}
      home={match.homeTeamName || "À déterminer"}
      away={match.awayTeamName || "À déterminer"}
      homeLogo={match.homeTeamLogo}
      awayLogo={match.awayTeamLogo}
      score={joue ? `${match.scoreHome ?? 0} - ${match.scoreAway ?? 0}` : null}
      quand={quandLisible(match.date, match.time)}
      lieu={[match.venueName, match.venueCity].filter(Boolean).join(", ")}
    />,
    TAILLE_AFFICHE,
  );
}

/**
 * « samedi 5 septembre · 18:00 ».
 *
 * Même besoin que sur l'affiche d'un amical : sur une image qu'on colle dans
 * une conversation pour faire venir du monde, c'est le jour de la semaine qui
 * compte d'abord, pas « 2026-09-05 ».
 */
function quandLisible(date: string | null, time: string | null): string {
  const d = new Date(`${date ?? ""}T${time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return [date, time].filter(Boolean).join(" · ");
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return time ? `${jour} · ${time}` : jour;
}
