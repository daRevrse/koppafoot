import { phaseFinalePublique } from "@/lib/phase-finale-publique";
import { afficheDuTableau } from "@/lib/og-phase-finale";

// ============================================
// L'affiche du tableau de la phase finale, à partager (lib/og-phase-finale).
//
// PUBLIQUE comme la page de la compétition, à une adresse stable : le bouton
// Partager va la chercher d'avance. 404 tant qu'il n'y a pas de phase finale,
// ou pour une compétition en brouillon.
// ============================================

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pf = await phaseFinalePublique(slug);
  if (!pf || pf.tours.length === 0) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return afficheDuTableau(pf);
}
