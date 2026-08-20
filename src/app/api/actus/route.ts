import { NextResponse } from "next/server";
import { getSportsArticles } from "@/lib/news-rss";

/**
 * GET /api/actus, les derniers titres, pour le rail du Direct.
 *
 * La page /actus lit `getSportsArticles` directement, cote serveur. Le rail,
 * lui, est un composant client monte dans le shell : il ne peut pas appeler
 * une fonction qui fait trois requetes sortantes. D'ou cette route.
 *
 * Revalidee comme la page elle-meme : le rail et /actus regardent le meme
 * fil au meme moment, sans multiplier les appels chez l'agregateur.
 */

export const revalidate = 900;

export async function GET() {
  try {
    const articles = await getSportsArticles(8);
    return NextResponse.json({ articles });
  } catch (err) {
    console.error("GET actus failed:", err);
    return NextResponse.json({ articles: [] });
  }
}
