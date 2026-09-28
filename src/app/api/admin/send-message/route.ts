import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendPushToUser } from "@/lib/fcm-server";
import { sendNotificationEmail, adminMessageEmailHtml } from "@/lib/email";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { dansLeSegment, estUnSegment, type Segment } from "@/lib/admin-segments";

/**
 * POST /api/admin/send-message, un message de l'équipe à un segment ou à un
 * compte : notification dans l'application, push et e-mail.
 *
 * Corps : { title, body, segment } ou { title, body, uid | email }.
 * `apercu: true` n'envoie rien et répond qui recevrait le message : l'écran
 * le montre AVANT l'envoi. Un envoi à tous part en push et par e-mail sur
 * tous les téléphones et toutes les boîtes, et ne se rattrape pas.
 *
 * Voir lib/admin-segments pour ce qu'est un segment : les rôles et les
 * casquettes du modèle actuel, plus `user_type`.
 */

/** L'ancien vocabulaire de l'écran, le temps que tous les clients l'oublient. */
const ANCIENNES_CIBLES: Record<string, Segment> = {
  all: "tous", player: "joueurs", manager: "managers",
  referee: "arbitres", venue_owner: "proprietaires",
};

type Destinataire = { uid: string; email: string | null; nom: string };

function destinataire(d: FirebaseFirestore.DocumentSnapshot): Destinataire {
  const x = d.data() ?? {};
  return {
    uid: d.id,
    email: typeof x.email === "string" && x.email ? x.email : null,
    nom: `${x.first_name ?? ""} ${x.last_name ?? ""}`.trim() || "Compte sans nom",
  };
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  const corps = (await req.json().catch(() => ({}))) as {
    title?: string; body?: string; segment?: string; target?: string;
    uid?: string; email?: string; apercu?: boolean;
  };
  const title = (corps.title ?? "").trim();
  const body = (corps.body ?? "").trim();
  const apercu = corps.apercu === true;
  if (!apercu && (!title || !body)) {
    return NextResponse.json({ error: "Un titre et un message sont requis" }, { status: 400 });
  }

  // La cible : un compte précis, ou un segment.
  let destinataires: Destinataire[] = [];
  const ancienne = corps.target && ANCIENNES_CIBLES[corps.target];
  const segment = estUnSegment(corps.segment) ? corps.segment : ancienne || null;
  const email = corps.email ?? (corps.target && !ancienne && corps.target.includes("@") ? corps.target : undefined);

  if (corps.uid) {
    const d = await adminDb.collection("users").doc(corps.uid).get();
    if (!d.exists) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    destinataires = [destinataire(d)];
  } else if (email) {
    const snap = await adminDb.collection("users").where("email", "==", email.trim()).limit(1).get();
    if (snap.empty) {
      // Un compte créé par téléphone n'a pas d'e-mail en profil, mais
      // l'authentification peut en connaître un.
      const compte = await adminAuth.getUserByEmail(email.trim()).catch(() => null);
      const d = compte ? await adminDb.collection("users").doc(compte.uid).get() : null;
      if (!d?.exists) return NextResponse.json({ error: "Aucun compte pour cet e-mail" }, { status: 404 });
      destinataires = [destinataire(d)];
    } else {
      destinataires = [destinataire(snap.docs[0])];
    }
  } else if (segment) {
    const snap = await adminDb.collection("users").get();
    destinataires = snap.docs.filter((d) => dansLeSegment(d.data(), segment)).map(destinataire);
  } else {
    return NextResponse.json({ error: "Choisis un segment ou un compte" }, { status: 400 });
  }

  if (apercu) {
    return NextResponse.json({
      count: destinataires.length,
      avecEmail: destinataires.filter((d) => d.email).length,
      exemples: destinataires.slice(0, 5).map((d) => d.nom),
    });
  }

  // Les notifications, par lots (Firestore plafonne un lot à 500 écritures).
  for (let i = 0; i < destinataires.length; i += 400) {
    const lot = adminDb.batch();
    for (const d of destinataires.slice(i, i + 400)) {
      lot.set(adminDb.collection("notifications").doc(), {
        user_id: d.uid,
        type: "admin_message",
        title,
        body,
        link: "/dashboard",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await lot.commit();
  }

  // Push et e-mail, au mieux, en parallèle : un téléphone éteint ou une boîte
  // pleine ne doit pas faire échouer l'envoi aux autres.
  const html = adminMessageEmailHtml(title, body);
  await Promise.allSettled(
    destinataires.map(async (d) => {
      await sendPushToUser(d.uid, { title, body, link: "/dashboard", category: "annonces" }).catch(() => {});
      if (d.email) await sendNotificationEmail(d.email, title, html).catch(() => {});
    }),
  );

  return NextResponse.json({ ok: true, count: destinataires.length });
}
