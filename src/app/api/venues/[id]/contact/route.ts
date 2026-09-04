import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/venues/[id]/contact, les coordonnées du responsable d'un terrain.
 *
 * POURQUOI CE N'EST PAS DANS LA FICHE. La page du terrain est rendue à
 * l'avance, mise en cache et lue par les robots : un numéro de téléphone
 * posé dans son HTML est un numéro moissonné. Les coordonnées ne descendent
 * donc jamais avec la page — elles se demandent, à ce point d'accès, au
 * moment où quelqu'un clique.
 *
 * ET POURQUOI IL FAUT UN COMPTE. `users` est fermé dans firestore.rules
 * précisément parce que le document porte l'email et le téléphone, et la
 * projection publique de /api/public/profile les exclut par liste blanche.
 * Cette route est la seule porte qui les laisse sortir : l'ouvrir sans
 * compte reviendrait à rouvrir la fuite qu'on avait fermée, avec une étape
 * de plus. Un compte, c'est le prix d'entrée — le même que pour demander un
 * créneau, donc aucune friction nouvelle sur le chemin qui compte.
 *
 * Ce qui sort : le nom, le téléphone, l'email. Rien d'autre, et jamais
 * l'identifiant d'un autre compte que celui du propriétaire du terrain
 * demandé.
 */

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Compte requis" }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(header.split("Bearer ")[1]);
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const venue = await adminDb.collection("venues").doc(id).get();
    if (!venue.exists) {
      return NextResponse.json({ error: "Terrain introuvable" }, { status: 404 });
    }

    const ownerId = venue.data()?.owner_id;
    if (typeof ownerId !== "string" || !ownerId) {
      return NextResponse.json({ error: "Ce terrain n'a pas de responsable déclaré" }, { status: 404 });
    }

    const owner = await adminDb.collection("users").doc(ownerId).get();
    if (!owner.exists) {
      return NextResponse.json({ error: "Responsable introuvable" }, { status: 404 });
    }

    const d = owner.data() as Record<string, unknown>;
    const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);
    const nom = `${s(d.first_name) ?? ""} ${s(d.last_name) ?? ""}`.trim();

    return NextResponse.json({
      contact: {
        nom: nom || "Le responsable",
        telephone: s(d.phone),
        email: s(d.email),
      },
    });
  } catch (err) {
    console.error("GET venue contact failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
