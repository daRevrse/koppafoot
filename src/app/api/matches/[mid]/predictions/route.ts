import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/matches/[mid]/predictions, les totaux du pronostic.
 *
 * Pourquoi compter ici plutôt que dans le navigateur : les règles ferment
 * `match_predictions` à son auteur, donc un client ne peut pas parcourir la
 * collection pour additionner. C'est voulu, le rail publie un résultat, pas
 * la liste de qui a voté quoi. Le SDK admin compte, et ne renvoie que trois
 * nombres.
 *
 * Aucune authentification : un total est public, comme le score.
 */

export const dynamic = "force-dynamic";

type Pick = "home" | "draw" | "away";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ mid: string }> },
) {
  const { mid } = await params;

  const empty = { home: 0, draw: 0, away: 0, total: 0 };
  if (!mid) return NextResponse.json(empty);

  try {
    const snap = await adminDb
      .collection("match_predictions")
      .where("match_id", "==", mid)
      .get();

    const counts = { ...empty };
    for (const doc of snap.docs) {
      const pick = (doc.data() as { pick?: string }).pick;
      if (pick === "home" || pick === "draw" || pick === "away") {
        counts[pick as Pick] += 1;
        counts.total += 1;
      }
    }

    return NextResponse.json(counts, {
      // Un pronostic bouge vite avant le coup d'envoi : pas de cache partagé,
      // juste de quoi absorber une rafale de rechargements.
      headers: { "Cache-Control": "public, max-age=10, s-maxage=10" },
    });
  } catch (err) {
    console.error("GET predictions failed:", err);
    return NextResponse.json(empty);
  }
}
