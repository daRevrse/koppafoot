import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { vitrineDesTerrains, type TerrainBrut } from "@/lib/vitrine";

/**
 * GET /api/public/terrains-a-la-une
 *
 * Les terrains de la vitrine du Direct : ceux que l'administration a mis à la
 * une, sinon les mieux présentés (voir lib/vitrine). Public, et en cache
 * cinq minutes : la carte est sur la page la plus lue du produit.
 *
 * Le repli lit au plus cinquante terrains ouverts, sans tri côté Firestore :
 * un `orderBy` sur la note avec le filtre d'ouverture demanderait un index
 * composite pour une liste qui tient en mémoire.
 */

export const dynamic = "force-dynamic";

const ID = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET() {
  try {
    const reglages = await adminDb.doc("settings/vitrine").get();
    const ids = ((reglages.get("terrains_a_la_une") ?? []) as unknown[])
      .filter((v): v is string => typeof v === "string" && ID.test(v))
      .slice(0, 10);

    const aLaUne: TerrainBrut[] = ids.length
      ? (await adminDb.getAll(...ids.map((id) => adminDb.doc(`venues/${id}`))))
          .filter((d) => d.exists)
          .map((d) => ({ id: d.id, ...d.data() }))
      : [];

    let resultat = vitrineDesTerrains(aLaUne, []);
    if (resultat.terrains.length === 0) {
      const ouverts = await adminDb.collection("venues").where("available", "==", true).limit(50).get();
      resultat = vitrineDesTerrains([], ouverts.docs.map((d) => ({ id: d.id, ...d.data() })));
    }

    return NextResponse.json(resultat, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err) {
    console.error("[terrains-a-la-une GET]", err);
    // Une carte sans terrain vaut mieux qu'une page en erreur.
    return NextResponse.json({ terrains: [], aLaUne: false });
  }
}
