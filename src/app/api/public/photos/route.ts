import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { lireGenre, type Genre } from "@/lib/genre";
import { lireCleSansCompte } from "@/lib/photos-sans-compte";

/**
 * GET /api/public/photos?uids=<uid>,<uid>&lignes=<club>:<id>,<club>:<id>
 *
 * La photo de profil de plusieurs comptes d'un coup : ceux d'une feuille de
 * match, pour leurs pastilles sur le terrain et pour l'homme du match.
 *
 * `users/{uid}` est fermé aux visiteurs (voir /api/public/profile/[uid]), et
 * une fiche de match se lit sans compte. On lit donc avec le SDK admin, et on
 * ne rend QUE la photo et le genre : deux champs que la fiche publique du
 * joueur montre déjà à tout le monde (le genre par ses accords, « Joueuse du
 * match »). Ni nom, ni rien d'autre du compte — la feuille de match porte déjà
 * les noms.
 *
 * Un compte sans photo, ou sans genre déclaré, est simplement absent de la
 * liste correspondante.
 *
 * `lignes` : les joueurs SANS COMPTE d'une feuille, désignés par leur club et
 * leur fiche (voir lib/photos-sans-compte). Leur photo, que le club a posée
 * avec leur accord, est déjà sur la fiche publique du club ; rien d'autre de
 * la fiche ne sort d'ici.
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
  const lignes = [...new Set((new URL(req.url).searchParams.get("lignes") ?? "").split(","))]
    .map((c) => lireCleSansCompte(c.trim()))
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .slice(0, MAX_COMPTES);

  if (uids.length === 0 && lignes.length === 0) return NextResponse.json({ photos: {}, genres: {}, lignes: {} });

  try {
    // `getAll` refuse une liste vide : chaque lecture n'a lieu que si on a
    // quelque chose à lui demander.
    const [docs, fiches] = await Promise.all([
      uids.length ? adminDb.getAll(...uids.map((uid) => adminDb.doc(`users/${uid}`))) : [],
      lignes.length
        ? adminDb.getAll(...lignes.map((l) => adminDb.doc(`teams/${l.clubId}/ghost_players/${l.ghostId}`)))
        : [],
    ]);
    const photos: Record<string, string> = {};
    const genres: Record<string, Genre> = {};
    for (const d of docs) {
      const url = d.get("profile_picture_url");
      if (typeof url === "string" && url) photos[d.id] = url;
      const genre = lireGenre(d.get("gender"));
      if (genre) genres[d.id] = genre;
    }
    const photosSansCompte: Record<string, string> = {};
    fiches.forEach((d, i) => {
      const url = d.get("photo_url");
      if (typeof url === "string" && url) photosSansCompte[`${lignes[i].clubId}:${lignes[i].ghostId}`] = url;
    });
    return NextResponse.json(
      { photos, genres, lignes: photosSansCompte },
      // Une photo change rarement : cinq minutes en cache partagé, et une
      // heure de plus à servir l'ancienne pendant qu'on relit la nouvelle.
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    console.error("GET /api/public/photos failed:", err);
    return NextResponse.json({ photos: {}, genres: {}, lignes: {} }, { status: 500 });
  }
}
