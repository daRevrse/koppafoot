import { lireChoixDesButeurs } from "@/lib/buteurs-affiche";
import { buteursPublics } from "@/lib/buteurs-publics";
import { afficheDesButeurs } from "@/lib/og-buteurs";

// ============================================
// L'affiche des meilleurs buteurs d'une compétition (lib/og-buteurs), à
// partager.
//
//   ?journee=2      après la journée 2 (lib/buteurs-affiche)
//   ?a-ce-jour=1    tous les matchs, phase finale comprise
//   &page=1         une seule page : la fenêtre de l'organisateur demande les
//                   pages une à une, comme pour le programme, et s'arrête au
//                   premier refus
//
// PUBLIQUE comme celle du programme, à une adresse stable. 400 pour une
// adresse bricolée, 404 pour une compétition en brouillon, un choix sans
// buteur ou une page au-delà de la première.
// ============================================

export const runtime = "nodejs";

const SANS_CACHE = { "Cache-Control": "no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recherche = new URL(req.url).searchParams;
  const choix = lireChoixDesButeurs(recherche);
  const page = recherche.get("page") ?? "1";
  if (!choix || !/^\d{1,2}$/.test(page) || Number(page) < 1) {
    return new Response(null, { status: 400, headers: SANS_CACHE });
  }
  if (page !== "1") return new Response(null, { status: 404, headers: SANS_CACHE });
  const donnees = await buteursPublics(slug, choix);
  if (!donnees) return new Response(null, { status: 404, headers: SANS_CACHE });
  return afficheDesButeurs(donnees);
}
