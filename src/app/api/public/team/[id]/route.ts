import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/public/team/[id], la fiche publique d'une équipe.
 *
 * Même raison que pour les profils : `teams/{id}` est fermé aux visiteurs
 * dans firestore.rules. Plutôt que d'ouvrir la règle, on lit ici avec le SDK
 * admin et on ne renvoie qu'une projection en liste blanche.
 *
 * Ce qui n'en fait PAS partie : `member_ids` et `manager_id`. Un effectif est
 * une liste d'identifiants de comptes, et la publier permettrait de relier
 * des personnes entre elles sans qu'elles l'aient demandé. On publie ce qui
 * décrit l'équipe, pas qui la compose, le nombre de membres suffit à dire
 * si elle est complète.
 */

export const revalidate = 300;

const PUBLIC_FIELDS = [
  "name", "city", "description", "slogan", "logo_url", "banner_url",
  "color", "level", "is_recruiting", "max_members",
  "matches_played", "wins", "draws", "losses", "achievements",
  "gallery_urls", "is_ghost",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ team: null }, { status: 404 });

  try {
    const snap = await adminDb.collection("teams").doc(id).get();
    if (!snap.exists) return NextResponse.json({ team: null }, { status: 404 });

    const data = snap.data() as Record<string, unknown>;
    const out: Record<string, unknown> = { id };
    for (const key of PUBLIC_FIELDS) {
      if (data[key] !== undefined) out[key] = data[key];
    }
    // Le nombre de membres est une information d'équipe ; la liste ne l'est pas.
    out.member_count = Array.isArray(data.member_ids) ? data.member_ids.length : 0;

    return NextResponse.json({ team: out });
  } catch (err) {
    console.error("GET public team failed:", err);
    return NextResponse.json({ team: null }, { status: 500 });
  }
}
