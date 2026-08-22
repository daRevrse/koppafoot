import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// ============================================
// Les retours du terrain.
//
// Ils arrivent ici et repartent aussitôt dans les notifications des
// superadmins, plutôt que dans une collection qu'il faudrait penser à aller
// consulter. Une boîte de réception que personne n'ouvre est une corbeille
// avec un nom plus poli, et le projet a déjà l'endroit où l'équipe regarde
// tous les jours.
//
// Le message est aussi conservé dans `feedback` : les notifications se lisent
// et s'oublient, un retour doit pouvoir se relire dans six mois.
//
// SANS COMPTE AUSSI. Le premier retour utile vient souvent de quelqu'un qui
// n'a pas réussi à créer son compte, et lui demander d'en avoir un pour le
// dire ferme la seule porte qui restait. Le jeton est donc facultatif, et ce
// qu'on sait de l'auteur est simplement plus mince.
// ============================================

/** Assez pour décrire un bug, trop court pour servir de dépotoir. */
const LONGUEUR_MAX = 4000;

/** Au-delà, on considère que ce n'est plus une personne qui écrit. */
const PAR_HEURE_MAX = 5;

export async function POST(req: NextRequest) {
  const corps = (await req.json().catch(() => ({}))) as {
    message?: string;
    page?: string;
  };

  const message = (corps.message ?? "").trim();
  if (message.length < 5) {
    return NextResponse.json({ error: "Le message est vide" }, { status: 400 });
  }
  if (message.length > LONGUEUR_MAX) {
    return NextResponse.json(
      { error: `Le message dépasse ${LONGUEUR_MAX} caractères` },
      { status: 400 },
    );
  }

  // L'auteur, quand il est connu. Un jeton invalide n'est pas une erreur ici :
  // le retour vaut d'être lu même si la session a expiré entre-temps.
  let uid: string | null = null;
  let nom: string | null = null;
  const entete = req.headers.get("authorization");
  if (entete?.startsWith("Bearer ")) {
    try {
      const decode = await adminAuth.verifyIdToken(entete.split("Bearer ")[1]);
      uid = decode.uid;
      const fiche = await adminDb.collection("users").doc(uid).get();
      const d = fiche.data();
      if (d) nom = `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() || null;
    } catch {
      uid = null;
    }
  }

  // Un compte connu ne peut pas noyer la boîte. Les visiteurs anonymes ne sont
  // pas comptés : sans identifiant fiable, la limite se contournerait d'un
  // onglet privé, et la faire porter à tout le monde à la fois punirait les
  // vrais retours d'un même lieu.
  if (uid) {
    const depuis = new Date(Date.now() - 3600_000);
    const recents = await adminDb
      .collection("feedback")
      .where("uid", "==", uid)
      .where("created_at", ">=", depuis)
      .count()
      .get()
      .catch(() => null);
    if (recents && recents.data().count >= PAR_HEURE_MAX) {
      return NextResponse.json(
        { error: "Vous avez déjà envoyé plusieurs retours cette heure-ci. Merci, on les lit." },
        { status: 429 },
      );
    }
  }

  const doc = await adminDb.collection("feedback").add({
    message,
    uid,
    author_name: nom,
    page: (corps.page ?? "").slice(0, 200) || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    handled: false,
    created_at: FieldValue.serverTimestamp(),
  });

  // Et tout de suite sous les yeux de l'équipe.
  try {
    const admins = await adminDb
      .collection("users")
      .where("user_type", "==", "superadmin")
      .get();

    if (!admins.empty) {
      const lot = adminDb.batch();
      const apercu = message.length > 240 ? `${message.slice(0, 240)}…` : message;
      admins.docs.forEach((a) => {
        lot.set(adminDb.collection("notifications").doc(), {
          user_id: a.id,
          type: "admin_message",
          title: nom ? `Retour de ${nom}` : "Retour d'un visiteur",
          body: apercu,
          link: null,
          read: false,
          created_at: FieldValue.serverTimestamp(),
        });
      });
      await lot.commit();
    }
  } catch (err) {
    // Le retour est enregistré ; l'avertissement peut échouer sans que
    // l'utilisateur ait à réécrire son message.
    console.error("Notification des superadmins échouée:", err);
  }

  return NextResponse.json({ ok: true, id: doc.id });
}
