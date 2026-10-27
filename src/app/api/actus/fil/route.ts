import { NextResponse } from "next/server";
import { getSportsArticles } from "@/lib/news-rss";

/**
 * GET /api/actus/fil, le fil entier, pour l'onglet Actus de l'application.
 *
 * Le même que la page /actus (trente articles), là où /api/actus n'en rend
 * que huit pour le rail : le rail est chargé sur chaque page du site, il n'a
 * pas à porter le fil complet. L'application le découpe elle-même, avec
 * `filParJour` (lib/fil-actus), comme la page.
 *
 * Revalidée comme la page : un quart d'heure, les flux ne bougent pas plus vite.
 */

export const revalidate = 900;

export async function GET() {
  try {
    const articles = await getSportsArticles();
    return NextResponse.json({ articles });
  } catch (err) {
    console.error("GET actus/fil failed:", err);
    return NextResponse.json({ articles: [] });
  }
}
