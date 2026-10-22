import { afficheDuProgramme } from "@/lib/og-programme";
import { lireChoix } from "@/lib/programme";
import { programmePublic } from "@/lib/programme-public";

// ============================================
// L'affiche du programme d'une compétition, « Journée X » / « Matchs du
// jour » (lib/og-programme), à partager.
//
//   ?journee=2                      une journée (lib/journees)
//   ?dates=2026-10-25,2026-11-01    une ou plusieurs dates
//   &page=2                         au-delà de douze matchs
//
// PUBLIQUE comme celles du tableau et du champion, à une adresse stable.
// 400 pour une adresse bricolée, 404 pour une compétition en brouillon, un
// choix sans match ou une page qui n'existe pas.
// ============================================

export const runtime = "nodejs";

const SANS_CACHE = { "Cache-Control": "no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const recherche = new URL(req.url).searchParams;
  const choix = lireChoix(recherche);
  const brute = recherche.get("page") ?? "1";
  if (!choix || !/^\d{1,2}$/.test(brute) || Number(brute) < 1) {
    return new Response(null, { status: 400, headers: SANS_CACHE });
  }
  const donnees = await programmePublic(slug, choix, Number(brute));
  if (!donnees) return new Response(null, { status: 404, headers: SANS_CACHE });
  return afficheDuProgramme(donnees);
}
