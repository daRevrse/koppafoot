import { NextResponse } from "next/server";
import { lireClassements } from "@/lib/classement-admin";

/**
 * GET /api/rankings, le classement des joueurs, pour l'écran Classement de
 * l'application.
 *
 * Le même document que la page /top-players (voir lib/classement-admin) :
 * il ne change qu'à la fin d'un match, et les règles Firestore ne l'ouvrent
 * pas à la lecture. L'application trie, filtre et découpe elle-même, avec
 * `classementPar` (lib/classement), comme la page.
 *
 * Revalidée comme la page : une minute.
 */

export const revalidate = 60;

export async function GET() {
  // lireClassements ne lève pas : un classement illisible se rend vide.
  return NextResponse.json(await lireClassements());
}
