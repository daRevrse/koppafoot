import { NextResponse } from "next/server";
import { getDirectBoard } from "@/lib/direct-admin";

/**
 * GET /api/direct, le tableau du Direct pour l'application mobile.
 *
 * Exactement ce que la page d'accueil affiche (voir lib/direct-admin) :
 * l'application ne peut pas le lire elle-même, les amicaux et le football
 * mondial passant par le SDK admin. Elle attache ensuite ses propres
 * écouteurs Firestore pour le temps réel, comme DirectHomeV2.
 *
 * Mis en cache 60 s, comme la page. Public, comme elle.
 *
 * Réponse : { board: CompetitionFeed[] }
 */

export const dynamic = "force-static";
export const revalidate = 60;

export async function GET() {
  const board = await getDirectBoard();
  return NextResponse.json({ board });
}
