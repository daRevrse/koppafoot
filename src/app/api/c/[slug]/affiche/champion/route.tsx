import { phaseFinalePublique } from "@/lib/phase-finale-publique";
import { afficheDuChampion } from "@/lib/og-phase-finale";

// ============================================
// L'affiche du champion, à partager (lib/og-phase-finale) : le vainqueur de
// la finale, son score, le meilleur joueur et le meilleur buteur.
//
// 404 tant que la finale n'a pas de vainqueur : il n'y a personne à couronner.
// ============================================

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pf = await phaseFinalePublique(slug);
  if (!pf?.champion || !pf.finale) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return afficheDuChampion(pf);
}
