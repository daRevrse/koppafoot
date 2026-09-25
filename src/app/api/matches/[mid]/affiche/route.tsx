import { getMatchPublic } from "@/lib/match-public";
import { banniereAPartager } from "@/lib/affiche-partage";
import { flyerDuMatch } from "@/lib/og-flyer";

// ============================================
// Le flyer d'un match, en PNG, à partager.
//
// PAS UN `opengraph-image`. Celui-là existe déjà et sert l'aperçu de lien,
// dans son format paysage : il est posé par la convention de fichier de
// Next, à une adresse versionnée que le produit ne choisit pas et ne peut
// pas donner à `navigator.share`. Ici l'adresse est stable et connue, parce
// qu'un bouton doit pouvoir aller chercher l'image.
//
// MATCHDAY AVANT, SCORE FINAL APRÈS, RIEN PENDANT : voir lib/og-flyer. Un
// 404 n'est pas une panne, la page partage alors le lien seul.
//
// PUBLIQUE comme la fiche du match : ce qu'elle montre — les deux noms,
// l'heure, le terrain, le score — est déjà lisible sans compte, et c'est
// précisément ce qu'on partage à quelqu'un qui n'en a pas encore.
// ============================================

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mid: string }> },
) {
  const { mid } = await params;
  const match = await getMatchPublic(mid);

  // Match introuvable : pas d'image. Seule la fiche du match va chercher
  // cette adresse, et elle affiche déjà « introuvable » à sa place.
  if (!match) return new Response(null, { status: 404 });

  // LA BANNIÈRE D'ABORD. Quand quelqu'un en a posé une sur la rencontre,
  // c'est elle qu'on partage : une image choisie bat une image calculée.
  // Aucun amical n'en porte aujourd'hui, seul l'organisateur d'une
  // compétition peut en téléverser une — mais la règle s'écrit ici comme
  // là-bas, et le jour où un manager pourra habiller son amical, il n'y a
  // rien à rebrancher.
  const banniere = await banniereAPartager(match);
  if (banniere) return banniere;

  return flyerDuMatch(match);
}
