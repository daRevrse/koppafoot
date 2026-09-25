import { getCompMatchPublic } from "@/lib/match-public";
import { banniereAPartager } from "@/lib/affiche-partage";
import { flyerDuMatch } from "@/lib/og-flyer";

// ============================================
// L'image d'un match de compétition, à partager.
//
// LA BANNIÈRE SI ELLE EXISTE, le flyer sinon. C'est le seul endroit du
// produit où quelqu'un a explicitement choisi ce qu'il veut montrer d'une
// rencontre : un organisateur qui téléverse une bannière dans son calendrier
// a fait un travail que nul dessin automatique ne remplace.
//
// LE FLYER porte le logo de la compétition en tête, et suit l'état du match :
// MATCHDAY avant, SCORE FINAL après, rien pendant (voir lib/og-flyer).
//
// POURQUOI CETTE ROUTE EXISTE. Le jumeau des amicaux — /api/matches/[mid]
// /affiche — ne sait lire que la collection `matches`. Les rencontres de
// compétition vivent dans `competitions/<id>/comp_matches`, et ce sont
// justement elles qui portent une bannière, et elles dont l'adresse circule
// vraiment.
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

  // Match introuvable, ou compétition encore en brouillon : pas d'image.
  // Seule la fiche du match va chercher cette adresse, et elle affiche déjà
  // « introuvable » à sa place.
  if (!match) return new Response(null, { status: 404 });

  const banniere = await banniereAPartager(match);
  if (banniere) return banniere;

  return flyerDuMatch(match);
}
