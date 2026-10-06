import { NextResponse } from "next/server";
import { clubParSlug, estEveille, vuePublique } from "@/lib/clubs-serveur";

/**
 * GET /api/public/club/[slug], la page publique d'un club.
 *
 * Éveillé : son identité, son encadrement et ses sections. En sommeil (le Pro
 * de son propriétaire s'est arrêté) : son nom et son état, rien d'autre ; ses
 * équipes, elles, restent visibles sur leurs propres fiches.
 *
 * Aucun effectif ici : un club réunit des équipes de jeunes, et la liste de
 * leurs joueurs reste sur la fiche de chaque équipe, avec ses propres règles.
 */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const club = await clubParSlug(slug);
    if (!club) return NextResponse.json({ club: null }, { status: 404 });
    return NextResponse.json(
      { club: await vuePublique(club, await estEveille(club)) },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch (err) {
    console.error("GET /api/public/club:", err);
    return NextResponse.json({ club: null }, { status: 500 });
  }
}
