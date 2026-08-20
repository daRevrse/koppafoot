import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/competitions/[cid]/followers, combien de personnes la suivent.
 *
 * Aucune competition ne stocke ce nombre : le suivi vit dans un tableau sur
 * chaque profil (`users.followed_competition_ids`). Mais ce tableau est
 * interrogeable en `array-contains`, deja utilise par les notifications, donc
 * on compte cote serveur avec une agregation `count()`, on ne rapatrie aucun
 * document, seulement le total.
 *
 * Publique : le nombre d'abonnes est une information de vitrine, comme sur
 * n'importe quel tableau de scores. Aucun profil ne sort d'ici.
 */

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cid: string }> },
) {
  const { cid } = await params;
  if (!cid) return NextResponse.json({ count: 0 });

  try {
    const snap = await adminDb
      .collection("users")
      .where("followed_competition_ids", "array-contains", cid)
      .count()
      .get();

    return NextResponse.json({ count: snap.data().count ?? 0 });
  } catch (err) {
    console.error("GET followers failed:", err);
    return NextResponse.json({ count: 0 });
  }
}
