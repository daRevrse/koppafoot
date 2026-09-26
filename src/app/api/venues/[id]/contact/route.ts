import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * GET /api/venues/[id]/contact, les coordonnées du responsable d'un terrain.
 * PUT : le responsable choisit ce qu'il en montre.
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
 *
 * LE RESPONSABLE DÉCIDE DE CE QUI SORT. Il ne savait pas que son numéro et
 * son email personnels partaient ainsi, et ne pouvait pas donner celui de
 * l'accueil du complexe. Le réglage vit dans `venues/{id}/prive/contact` :
 * pas dans la fiche, qui est en lecture publique, et hors de portée des
 * navigateurs (aucune règle Firestore ne l'ouvre, seul ce point d'accès y
 * lit et y écrit). Sans réglage, on retombe sur le compte, comme avant.
 */

export const dynamic = "force-dynamic";

const TELEPHONE = /^\+?[\d\s.-]{6,20}$/;

interface ReglageContact {
  /** Le numéro du terrain, s'il diffère de celui du compte. */
  telephone: string | null;
  /** `false` : l'email du compte n'est pas montré. */
  email_visible: boolean;
}

const s = (x: unknown) => (typeof x === "string" && x.trim() ? x.trim() : null);

async function appelant(req: NextRequest): Promise<string | NextResponse> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Compte requis" }, { status: 401 });
  }
  try {
    return (await adminAuth.verifyIdToken(header.split("Bearer ")[1])).uid;
  } catch {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
}

const refReglage = (venueId: string) =>
  adminDb.collection("venues").doc(venueId).collection("prive").doc("contact");

async function lireReglage(venueId: string): Promise<ReglageContact> {
  const d = (await refReglage(venueId).get()).data() ?? {};
  return { telephone: s(d.telephone), email_visible: d.email_visible !== false };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await appelant(req);
  if (typeof uid !== "string") return uid;

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
    const nom = `${s(d.first_name) ?? ""} ${s(d.last_name) ?? ""}`.trim();
    const reglage = await lireReglage(id);

    return NextResponse.json({
      contact: {
        nom: nom || "Le responsable",
        telephone: reglage.telephone ?? s(d.phone),
        email: reglage.email_visible ? s(d.email) : null,
      },
      // Au responsable seul : de quoi préremplir son réglage.
      ...(uid === ownerId
        ? {
            reglage: {
              telephone: reglage.telephone,
              emailVisible: reglage.email_visible,
              telephoneCompte: s(d.phone),
              emailCompte: s(d.email),
            },
          }
        : {}),
    });
  } catch (err) {
    console.error("GET venue contact failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const uid = await appelant(req);
  if (typeof uid !== "string") return uid;

  try {
    const { id } = await params;
    const venue = await adminDb.collection("venues").doc(id).get();
    if (!venue.exists) {
      return NextResponse.json({ error: "Terrain introuvable" }, { status: 404 });
    }
    if (venue.data()?.owner_id !== uid) {
      return NextResponse.json({ error: "Ce terrain n'est pas le tien" }, { status: 403 });
    }

    const corps = (await req.json()) as { telephone?: unknown; emailVisible?: unknown };
    const telephone = typeof corps.telephone === "string" ? corps.telephone.trim() : "";
    if (telephone && !TELEPHONE.test(telephone)) {
      return NextResponse.json({ error: "Ce numéro semble incomplet." }, { status: 400 });
    }

    await refReglage(id).set({
      telephone: telephone || null,
      email_visible: corps.emailVisible !== false,
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT venue contact failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
