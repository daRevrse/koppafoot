import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Les candidatures de scoreur.
 *
 * Décalque de `organizer-applications`, et volontairement : la casquette de
 * scoreur s'obtient de la même façon, elle est relue par la même personne, et
 * deux mécaniques différentes pour une même chose auraient divergé.
 *
 * POURQUOI UNE CANDIDATURE plutôt qu'une case à cocher. Un scoreur validé peut
 * couvrir un amical qui n'est pas le sien : ce qu'il saisit devient le score
 * officiel de la rencontre, alimente les statistiques des deux équipes et
 * remonte dans le classement de la plateforme. Ce n'est pas une préférence
 * d'affichage, c'est une responsabilité sur la donnée d'autrui.
 *
 * Tout passe par le SDK admin : la collection `scorer_applications` n'a donc
 * aucune règle Firestore, les clients n'y touchent jamais.
 *
 * POST , déposer une candidature (tout compte connecté qui n'est pas déjà scoreur).
 * GET  , superadmin : toutes ; les autres : la leur seulement.
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

    const { motivation, city, phone } = (await req.json()) as {
      motivation?: string; city?: string; phone?: string;
    };
    if (!motivation?.trim() || motivation.trim().length < 20) {
      return NextResponse.json(
        { error: "Dis-nous en quelques phrases pourquoi tu veux couvrir des matchs (20 caractères minimum)." },
        { status: 400 },
      );
    }

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    }
    const u = userSnap.data()!;
    if (u.is_scorer === true || u.user_type === "superadmin") {
      return NextResponse.json({ error: "Tu es déjà scoreur." }, { status: 409 });
    }

    // Une candidature en attente à la fois : sans ça, un formulaire renvoyé
    // trois fois donne trois lignes à relire pour la même personne.
    const pending = await adminDb
      .collection("scorer_applications")
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

    const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Utilisateur";
    const doc = await adminDb.collection("scorer_applications").add({
      uid,
      name,
      email: u.email ?? null,
      phone: phone?.trim() || u.phone || null,
      city: city?.trim() || u.location_city || null,
      motivation: motivation.trim(),
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, id: doc.id });
  } catch (err) {
    console.error("[scorer-applications POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyBearer(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const callerSnap = await adminDb.collection("users").doc(uid).get();
    const isSuperadmin = callerSnap.exists && callerSnap.data()?.user_type === "superadmin";

    const base = adminDb.collection("scorer_applications");
    const snap = isSuperadmin
      ? await base.orderBy("created_at", "desc").limit(200).get()
      : await base.where("uid", "==", uid).get();

    const applications = snap.docs.map((d) => {
      const x = d.data();
      return {
        id: d.id,
        uid: x.uid,
        name: x.name ?? "",
        email: x.email ?? null,
        phone: x.phone ?? null,
        city: x.city ?? null,
        motivation: x.motivation ?? "",
        status: x.status ?? "pending",
        createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
        reviewedAt: x.reviewed_at?.toDate?.()?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ applications });
  } catch (err) {
    console.error("[scorer-applications GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
