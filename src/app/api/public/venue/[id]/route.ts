import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/public/venue/[id], la fiche publique d'un terrain.
 *
 * Le document `venues` est déjà en lecture publique dans les règles : il ne
 * porte que ce qu'on publie volontairement. Cette route existe pour une
 * autre raison, joindre au terrain le NOM de son propriétaire, qui vit dans
 * `users`, lui fermé.
 *
 * Seuls le prénom, le nom et la photo en sortent. L'email et le téléphone
 * n'entrent jamais dans cette réponse : une équipe qui veut réserver passe
 * par la fiche du propriétaire, pas par un annuaire téléphonique ouvert.
 */

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ venue: null }, { status: 404 });

  try {
    const snap = await adminDb.collection("venues").doc(id).get();
    if (!snap.exists) return NextResponse.json({ venue: null }, { status: 404 });

    const v = snap.data() as Record<string, unknown>;
    const ownerId = typeof v.owner_id === "string" ? v.owner_id : null;

    let owner: { uid: string; name: string; photo: string | null } | null = null;
    if (ownerId) {
      const o = await adminDb.collection("users").doc(ownerId).get();
      if (o.exists) {
        const d = o.data() as Record<string, unknown>;
        const first = typeof d.first_name === "string" ? d.first_name : "";
        const last = typeof d.last_name === "string" ? d.last_name : "";
        owner = {
          uid: ownerId,
          name: `${first} ${last}`.trim(),
          photo: typeof d.profile_picture_url === "string" ? d.profile_picture_url : null,
        };
      }
    }

    return NextResponse.json({
      venue: {
        id: snap.id,
        name: v.name ?? "",
        address: v.address ?? null,
        city: v.city ?? null,
        fieldSize: v.field_size ?? null,
        fieldSurface: v.field_surface ?? null,
        fieldType: v.field_type ?? null,
        available: v.available !== false,
      },
      owner,
    });
  } catch (err) {
    console.error("GET public venue failed:", err);
    return NextResponse.json({ venue: null }, { status: 500 });
  }
}
