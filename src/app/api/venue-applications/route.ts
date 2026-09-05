import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { estSuperadmin } from "@/lib/admin-api-auth";

/**
 * Candidatures « propriétaire de terrain ».
 *
 * Même circuit que les candidatures d'organisateur : un formulaire, une
 * décision d'administrateur, et la casquette qui s'ajoute au compte à
 * l'approbation. Elle s'AJOUTE, le rôle Evolution de la personne, joueur ou
 * arbitre, reste intact.
 *
 * Pourquoi une candidature plutôt qu'une activation libre : référencer un
 * terrain, c'est publier une adresse et se présenter comme son gestionnaire.
 * Rien n'empêche techniquement de le faire pour le terrain du voisin, donc
 * quelqu'un relit.
 *
 * La candidature porte déjà la fiche du terrain : à l'approbation, le terrain
 * est créé dans la foulée. Redemander ces informations après coup aurait fait
 * saisir deux fois la même chose.
 *
 * Tout passe par le SDK admin : la collection n'a pas de règles Firestore,
 * les clients n'y touchent jamais directement.
 */

async function verifyBearer(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyBearer(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const body = (await req.json()) as {
      venueName?: string; city?: string; address?: string;
      fieldSize?: string; fieldSurface?: string; phone?: string; motivation?: string;
    };

    const venueName = body.venueName?.trim().slice(0, 120) ?? "";
    if (venueName.length < 2) {
      return NextResponse.json({ error: "Indique le nom du terrain." }, { status: 400 });
    }
    const city = body.city?.trim().slice(0, 80) ?? "";
    if (city.length < 2) {
      return NextResponse.json({ error: "Indique la ville du terrain." }, { status: 400 });
    }

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    }
    const u = userSnap.data()!;
    if (u.is_venue_owner === true || u.user_type === "venue_owner") {
      return NextResponse.json(
        { error: "Tu gères déjà des terrains, ajoute le suivant depuis Mes terrains." },
        { status: 409 },
      );
    }

    const pending = await adminDb
      .collection("venue_applications")
      .where("uid", "==", uid)
      .where("status", "==", "pending")
      .limit(1)
      .get();
    if (!pending.empty) {
      return NextResponse.json(
        { error: "Ta candidature est déjà en cours d'examen." },
        { status: 409 },
      );
    }

    const doc = await adminDb.collection("venue_applications").add({
      uid,
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Utilisateur",
      email: u.email ?? null,
      phone: body.phone?.trim() || u.phone || null,
      venue_name: venueName,
      city,
      address: body.address?.trim() || null,
      field_size: body.fieldSize || "11v11",
      field_surface: body.fieldSurface || "synthetic",
      motivation: body.motivation?.trim() || null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: doc.id });
  } catch (err) {
    console.error("POST venue application failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyBearer(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const caller = await adminDb.collection("users").doc(uid).get();
    const isAdmin = estSuperadmin(caller.data());

    const q = isAdmin
      ? adminDb.collection("venue_applications").orderBy("created_at", "desc")
      : adminDb.collection("venue_applications").where("uid", "==", uid);

    const snap = await q.get();
    return NextResponse.json({
      applications: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    });
  } catch (err) {
    console.error("GET venue applications failed:", err);
    return NextResponse.json({ applications: [] });
  }
}
