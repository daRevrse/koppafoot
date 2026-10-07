import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";

/**
 * Les terrains à la une du Direct, côté administration.
 *
 * GET                        , les identifiants à la une, dans l'ordre.
 * POST { venueId, aLaUne }   , en mettre un à la une, ou l'en retirer.
 *
 * Rangés dans `settings/vitrine`, que seul le serveur écrit : la fiche d'un
 * terrain se modifie par son propriétaire, un champ « à la une » posé dessus
 * lui aurait permis de se mettre en avant lui-même.
 */

const DOC = "settings/vitrine";

async function lesIds(): Promise<string[]> {
  const snap = await adminDb.doc(DOC).get();
  return ((snap.get("terrains_a_la_une") ?? []) as unknown[]).filter((v): v is string => typeof v === "string");
}

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json({ ids: await lesIds() });
  } catch (err) {
    console.error("[admin/terrains-a-la-une GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { venueId, aLaUne } = (await req.json().catch(() => ({}))) as { venueId?: string; aLaUne?: boolean };
    if (!venueId || typeof aLaUne !== "boolean") {
      return NextResponse.json({ error: "venueId et aLaUne requis" }, { status: 400 });
    }
    if (aLaUne && !(await adminDb.collection("venues").doc(venueId).get()).exists) {
      return NextResponse.json({ error: "Terrain introuvable" }, { status: 404 });
    }
    await adminDb.doc(DOC).set({
      terrains_a_la_une: aLaUne ? FieldValue.arrayUnion(venueId) : FieldValue.arrayRemove(venueId),
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ ids: await lesIds() });
  } catch (err) {
    console.error("[admin/terrains-a-la-une POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
