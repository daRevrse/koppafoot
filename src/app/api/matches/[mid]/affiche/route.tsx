import { ImageResponse } from "next/og";
import { getMatchPublic } from "@/lib/match-public";
import { AfficheCarree, AfficheDeMarque, etatDuMatch, TAILLE_AFFICHE } from "@/lib/og";

// ============================================
// L'affiche d'un match, en PNG, à partager.
//
// PAS UN `opengraph-image`. Celui-là existe déjà et sert l'aperçu de lien,
// dans son format paysage : il est posé par la convention de fichier de
// Next, à une adresse versionnée que le produit ne choisit pas et ne peut
// pas donner à `navigator.share`. Ici l'adresse est stable et connue, parce
// qu'un bouton doit pouvoir aller chercher l'image.
//
// CARRÉE, parce qu'elle finit dans un statut WhatsApp : voir TAILLE_AFFICHE.
//
// PUBLIQUE comme la fiche du match : ce qu'elle montre — les deux noms,
// l'heure, le terrain — est déjà lisible sans compte, et c'est précisément
// ce qu'on partage à quelqu'un qui n'en a pas encore.
// ============================================

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mid: string }> },
) {
  const { mid } = await params;
  const match = await getMatchPublic(mid);

  // Match introuvable : l'affiche de marque, comme l'aperçu de lien. Une
  // rencontre à un seul camp aurait l'air d'un défaut plutôt que d'un lien
  // périmé.
  if (!match) return new ImageResponse(<AfficheDeMarque />, TAILLE_AFFICHE);

  const { texte, couleur } = etatDuMatch(match.status, match.date, match.time);
  const joue = match.status === "live" || match.status === "completed";

  // `etatDuMatch` rend la DATE BRUTE pour un match à venir — « 2026-09-05 » —
  // ce qui convient à un aperçu de lien, où elle est la seule mention du
  // quand. Ici la date est déjà au centre de l'affiche, en toutes lettres :
  // le surtitre la répéterait, dans sa pire écriture. Il annonce donc la
  // nature de la rencontre, et laisse l'état aux matchs qui en ont un.
  const surtitre = joue || match.status === "cancelled" ? texte : "MATCH AMICAL";

  return new ImageResponse(
    <AfficheCarree
      surtitre={surtitre}
      couleurSurtitre={couleur}
      home={match.homeTeamName || "KoppaFoot"}
      away={match.awayTeamName}
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
 * L'aperçu de lien affiche la date brute, « 2026-09-05 », qui se lit comme
 * une référence de base de données. Sur une affiche qu'on colle dans une
 * conversation pour faire venir du monde, c'est le jour de la semaine qui
 * compte d'abord.
 */
function quandLisible(date: string, time: string): string {
  const d = new Date(`${date}T${time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return [date, time].filter(Boolean).join(" · ");
  const jour = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return time ? `${jour} · ${time}` : jour;
}
