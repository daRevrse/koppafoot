import { NextResponse } from "next/server";
import { clubDeLEquipe } from "@/lib/clubs-serveur";

/**
 * GET /api/public/team/[id]/club, le club dont l'équipe est une section,
 * pour le lien en tête de sa fiche. `null` sans club, ou si le club dort.
 */

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(
      { club: await clubDeLEquipe(id) },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
    );
  } catch (err) {
    console.error("GET /api/public/team/[id]/club:", err);
    return NextResponse.json({ club: null });
  }
}
