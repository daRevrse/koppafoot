import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/public/photos?uids=<uid>,<uid>
 *
 * La photo de profil de plusieurs comptes d'un coup : ceux d'une feuille de
 * match, pour leurs pastilles sur le terrain et pour l'homme du match.
 *
 * `users/{uid}` est fermé aux visiteurs (voir /api/public/profile/[uid]), et
 * une fiche de match se lit sans compte. On lit donc avec le SDK admin, et on
 * ne rend QUE la photo : un champ que la fiche publique du joueur montre déjà
 * à tout le monde. Ni nom, ni rien d'autre du compte — la feuille de match
 * porte déjà les noms.
 *
 * Un compte sans photo est simplement absent de la réponse.
 */

export const dynamic = "force-dynamic";

/** Deux feuilles et leurs bancs, largement. Au-delà, c'est un balayage. */
const MAX_COMPTES = 60;
const UID = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET(req: Request) {
  const uids = [...new Set(
    (new URL(req.url).searchParams.get("uids") ?? "")
      .split(",")
      .map((u) => u.trim())
      .filter((u) => UID.test(u)),
  )].slice(0, MAX_COMPTES);

  if (uids.length === 0) return NextResponse.json({ photos: {} });

  try {
    const docs = await adminDb.getAll(...uids.map((uid) => adminDb.doc(`users/${uid}`)));
    const photos: Record<string, string> = {};
    for (const d of docs) {
      const url = d.get("profile_picture_url");
      if (typeof url === "string" && url) photos[d.id] = url;
    }
    return NextResponse.json(
      { photos },
      // Une photo change rarement : cinq minutes en cache partagé, et une
      // heure de plus à servir l'ancienne pendant qu'on relit la nouvelle.
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    console.error("GET /api/public/photos failed:", err);
    return NextResponse.json({ photos: {} }, { status: 500 });
  }
}
