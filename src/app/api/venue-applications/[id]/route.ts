import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendNotificationEmail, venueApplicationDecisionHtml } from "@/lib/email";
import { sendPushToUser } from "@/lib/fcm-server";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { champsCandidature } from "@/lib/candidature-terrain";

async function appelant(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    return (await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1])).uid;
  } catch {
    return null;
  }
}

/**
 * La candidature du candidat lui-même, tant qu'elle attend.
 *
 * MODIFIER OU RETIRER SA DEMANDE. Une fois envoyée, elle était figée : une
 * faute dans le nom du terrain, une adresse oubliée, et il fallait attendre
 * le refus pour recommencer. Tant que personne ne l'a relue, le candidat la
 * corrige (PUT) ou la retire (DELETE). Après la décision, plus rien : c'est
 * un dossier jugé.
 */
async function saCandidatureEnAttente(req: NextRequest, id: string) {
  const uid = await appelant(req);
  if (!uid) return { erreur: NextResponse.json({ error: "Non autorisé" }, { status: 401 }) };
  const ref = adminDb.collection("venue_applications").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.uid !== uid) {
    return { erreur: NextResponse.json({ error: "Candidature introuvable" }, { status: 404 }) };
  }
  if (snap.data()?.status !== "pending") {
    return { erreur: NextResponse.json({ error: "Ta candidature a déjà été relue." }, { status: 409 }) };
  }
  return { ref };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await saCandidatureEnAttente(req, id);
    if ("erreur" in r) return r.erreur;
    const lu = champsCandidature(await req.json());
    if ("erreur" in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 });
    await r.ref.update({ ...lu.champs, updated_at: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT venue application failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const r = await saCandidatureEnAttente(req, id);
    if ("erreur" in r) return r.erreur;
    await r.ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE venue application failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * PATCH /api/venue-applications/[id], décision de l'administrateur.
 *
 * À l'approbation, deux écritures : la casquette sur le compte, et le terrain
 * lui-même, créé à partir de ce que la candidature portait déjà.
 *
 * La casquette est un DRAPEAU, jamais un `user_type`. Écraser le type de
 * compte effacerait ce que la personne est par ailleurs, c'est exactement ce
 * que faisait l'approbation d'organisateur, et ce qui rendait invisible un
 * organisateur qui joue.
 *
 * UN REFUS DIT POURQUOI. `motif` part avec la décision : il est gardé sur
 * la candidature, affiché sur la page du candidat et repris dans la
 * notification et l'email. Un refus sans raison laissait deviner quoi
 * corriger avant de redéposer.
 */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const callerUid = await appelant(req);
    if (!callerUid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const callerSnap = await adminDb.collection("users").doc(callerUid).get();
    // Le drapeau ET l'ancien `user_type`, comme toutes les routes
    // d'administration : ne lire que le second refusait l'approbation à un
    // administrateur qui n'a que le drapeau.
    if (!callerSnap.exists || !estSuperadmin(callerSnap.data())) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { action, motif: motifBrut } = (await req.json()) as { action?: string; motif?: unknown };
    const motif = action === "reject" && typeof motifBrut === "string" ? motifBrut.trim().slice(0, 500) : "";
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json({ error: "action doit être approve ou reject" }, { status: 400 });
    }

    const { id } = await params;
    const ref = adminDb.collection("venue_applications").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Candidature introuvable" }, { status: 404 });
    }
    const application = snap.data()!;
    if (application.status !== "pending") {
      return NextResponse.json({ error: "Candidature déjà traitée" }, { status: 409 });
    }

    const approved = action === "approve";
    await ref.update({
      status: approved ? "approved" : "rejected",
      rejection_reason: motif || null,
      reviewed_by: callerUid,
      reviewed_at: FieldValue.serverTimestamp(),
    });

    let venueId: string | null = null;

    if (approved) {
      const surface = application.field_surface ?? "synthetic";

      // LE TÉLÉPHONE DE LA CANDIDATURE REJOINT LE COMPTE, s'il n'en avait pas.
      // C'est celui que « Contacter le responsable » donne aux équipes : resté
      // sur la candidature, il ne servait à personne, et la fiche d'un
      // propriétaire sans numéro de compte ne donnait aucun moyen de l'appeler.
      const compte = (await adminDb.collection("users").doc(application.uid).get()).data();
      const telephone = typeof application.phone === "string" ? application.phone.trim() : "";
      const aUnTelephone = typeof compte?.phone === "string" && compte.phone.trim() !== "";

      const [, venueRef] = await Promise.all([
        adminDb.collection("users").doc(application.uid).update({
          is_venue_owner: true,
          ...(telephone && !aUnTelephone ? { phone: telephone } : {}),
          updated_at: FieldValue.serverTimestamp(),
        }),
        // Le terrain naît avec la casquette : la candidature portait déjà sa
        // fiche, la redemander aurait fait saisir deux fois la même chose.
        //
        // Photo, tarif et équipements naissent VIDES et se complètent dans
        // l'espace : les demander dans un formulaire de candidature aurait
        // allongé la seule étape où l'on n'a encore rien reçu en échange.
        adminDb.collection("venues").add({
          name: application.venue_name,
          address: application.address ?? "",
          city: application.city ?? "",
          owner_id: application.uid,
          field_type: surface === "indoor" ? "indoor" : "outdoor",
          field_surface: surface,
          field_size: application.field_size ?? "11v11",
          price_per_hour: 0,
          amenities: [],
          available: true,
          photo_url: null,
          rating: 0,
          review_count: 0,
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        }),
      ]);
      venueId = venueRef.id;
      // Le numéro donné dans la candidature devient celui du terrain, celui
      // que « Contacter le responsable » montrera (voir /api/venues/[id]/contact).
      await venueRef.collection("prive").doc("contact").set({
        telephone: telephone || null,
        email_visible: true,
        updated_at: FieldValue.serverTimestamp(),
      });
    }

    // ON PRÉVIENT LE CANDIDAT. Sans ça, une candidature approuvée ouvrait un
    // espace dont personne n'était averti : la personne devait deviner, et
    // revenir d'elle-même sur une page qui ne lui avait rien promis.
    //
    // Trois canaux, tous best-effort : la cloche dans le produit, le push sur
    // le téléphone, l'email pour celui qui a fermé l'application depuis des
    // jours. La décision, elle, est déjà écrite et ne dépend d'aucun des trois.
    //
    // `await` sur l'ensemble : une instance sans serveur gèle dès la réponse
    // rendue, un envoi non attendu serait simplement perdu.
    const prenom = String(application.name ?? "").split(" ")[0] || "toi";
    const terrain = String(application.venue_name ?? "ton terrain");
    const lien = approved ? "/mes-terrains" : "/terrains/candidature";

    await Promise.allSettled([
      adminDb.collection("notifications").add({
        user_id: application.uid,
        type: "venue_application",
        title: approved ? "Terrain publié" : "Candidature terrain",
        body: approved
          ? `${terrain} est en ligne. Complète sa fiche pour être choisi.`
          : `La fiche de ${terrain} n'a pas été publiée cette fois.${motif ? ` Motif : ${motif}` : ""}`,
        link: lien,
        read: false,
        created_at: FieldValue.serverTimestamp(),
      }),

      sendPushToUser(application.uid, {
        title: approved ? "Ton terrain est en ligne" : "Candidature terrain",
        body: approved
          ? `${terrain} est visible par les équipes. Ajoute une photo et un tarif.`
          : motif ? `Ta demande n'a pas été retenue : ${motif}` : "Ta demande n'a pas été retenue pour le moment.",
        link: lien,
        // Une réponse à MA candidature, pas une annonce générale.
        category: "perso",
      }),

      application.email
        ? sendNotificationEmail(
            String(application.email),
            approved ? `${terrain} est en ligne sur KoppaFoot` : "Ta demande de référencement, KoppaFoot",
            venueApplicationDecisionHtml(prenom, terrain, approved, motif || null),
          )
        : Promise.resolve(),
    ]).then((sorts) => {
      sorts
        .filter((s): s is PromiseRejectedResult => s.status === "rejected")
        .forEach((s) => console.warn("[venue-applications PATCH] notification:", s.reason?.message ?? s.reason));
    });

    return NextResponse.json({ ok: true, status: approved ? "approved" : "rejected", venueId });
  } catch (err) {
    console.error("PATCH venue application failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
