import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { lienInterne, sendPushToUser } from "@/lib/fcm-server";
import { categorieDuType } from "@/lib/push-categories";
import { TYPES_ECRITS_PAR_LE_CLIENT, type NotificationClient } from "@/lib/notification-client";
import type { NotificationType } from "@/types";

/**
 * POST /api/notifications/push { notificationId }
 *
 * Le push d'une notification qu'un compte vient d'écrire pour un autre
 * (invitation, défi, convocation… voir `createNotification`).
 *
 * LA ROUTE NE CROIT PLUS LE NAVIGATEUR. Elle prenait le destinataire, le
 * titre, le texte, le lien et le type dans le corps de la requête : n'importe
 * quel compte connecté pouvait donc faire vibrer le téléphone de n'importe qui
 * sous le nom de KoppaFoot, avec le texte et le lien de son choix — et même
 * lui faire envoyer un e-mail. Désormais :
 *  - elle relit la notification DANS LA BASE, par son identifiant ;
 *  - elle exige que l'appelant en soit l'auteur (`from_uid`, que les règles
 *    imposent à l'écriture) et qu'elle soit récente et pas déjà poussée ;
 *  - le lien doit rester dans le produit (`lienInterne`) ;
 *  - l'e-mail, pour une invitation ou une demande d'adhésion, est écrit ICI,
 *    à partir du type et du nom de l'expéditeur, jamais du texte reçu ;
 *  - un compte ne pousse pas plus de QUOTA notifications par fenêtre : de
 *    quoi convoquer une équipe entière, pas de quoi arroser la plateforme.
 */

const FRAICHEUR_MS = 10 * 60 * 1000;
const FENETRE_MS = 10 * 60 * 1000;
const QUOTA = 60;

/** Les types qui méritent aussi un e-mail : on attend une réponse de toi. */
const EMAILS: Partial<Record<NotificationType, (expediteur: string) => { sujet: string; texte: string }>> = {
  invitation: (qui) => ({
    sujet: "Nouvelle invitation",
    texte: `${qui} t'invite à rejoindre son équipe sur KoppaFoot. Ouvre l'application pour répondre.`,
  }),
  join_request: (qui) => ({
    sujet: "Nouvelle demande d'adhésion",
    texte: `${qui} demande à rejoindre ton équipe sur KoppaFoot. Ouvre l'application pour répondre.`,
  }),
};

function dateEnMs(v: unknown): number | null {
  const t = (v as { toMillis?: () => number } | null)?.toMillis?.();
  return typeof t === "number" ? t : null;
}

export async function POST(req: NextRequest) {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  let appelant: string;
  try {
    appelant = (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const { notificationId } = (await req.json().catch(() => ({}))) as { notificationId?: unknown };
  if (typeof notificationId !== "string" || !notificationId) {
    return NextResponse.json({ error: "notificationId requis" }, { status: 400 });
  }

  const ref = adminDb.collection("notifications").doc(notificationId);
  const quota = adminDb.collection("push_quotas").doc(appelant);

  // Vérifier et marquer d'un seul geste : deux appels simultanés pour la même
  // notification ne doivent pas faire sonner deux fois.
  const verdict = await adminDb.runTransaction(async (tx) => {
    const [snap, q] = await Promise.all([tx.get(ref), tx.get(quota)]);
    if (!snap.exists) return { refus: "Notification introuvable", statut: 404 } as const;
    const n = snap.data() as NotificationClient & { pushed_at?: unknown; created_at?: unknown };
    if (n.from_uid !== appelant) return { refus: "Accès refusé", statut: 403 } as const;
    if (n.pushed_at) return { refus: "Déjà envoyée", statut: 409 } as const;
    if (!TYPES_ECRITS_PAR_LE_CLIENT.includes(n.type)) return { refus: "Type non autorisé", statut: 403 } as const;
    const cree = dateEnMs(n.created_at);
    if (cree != null && Date.now() - cree > FRAICHEUR_MS) return { refus: "Trop ancienne", statut: 409 } as const;

    const qd = q.data() as { debut_ms?: number; nombre?: number } | undefined;
    const fenetreOuverte = qd?.debut_ms != null && Date.now() - qd.debut_ms < FENETRE_MS;
    const nombre = fenetreOuverte ? (qd?.nombre ?? 0) : 0;
    if (nombre >= QUOTA) return { refus: "Trop d'envois, réessaie plus tard", statut: 429 } as const;

    tx.set(quota, fenetreOuverte ? { nombre: nombre + 1 } : { debut_ms: Date.now(), nombre: 1 }, { merge: true });
    tx.update(ref, { pushed_at: FieldValue.serverTimestamp() });
    return { n } as const;
  });

  if ("refus" in verdict) {
    return NextResponse.json({ error: verdict.refus }, { status: verdict.statut });
  }
  const { n } = verdict;

  await sendPushToUser(n.user_id, {
    title: String(n.title).slice(0, 120),
    body: String(n.body).slice(0, 300),
    link: lienInterne(n.link),
    category: categorieDuType(n.type),
  }).catch(() => {});

  const courriel = EMAILS[n.type];
  if (courriel) {
    const [dest, exp] = await Promise.all([
      adminDb.collection("users").doc(n.user_id).get(),
      adminDb.collection("users").doc(appelant).get(),
    ]);
    const email = dest.data()?.email;
    // Pas d'e-mail à un compte suspendu : il ne peut pas répondre.
    if (email && dest.data()?.is_active !== false) {
      const e = exp.data();
      const qui = `${e?.first_name ?? ""} ${e?.last_name ?? ""}`.trim() || "Quelqu'un";
      const { sujet, texte } = courriel(qui);
      const { sendNotificationEmail, adminMessageEmailHtml } = await import("@/lib/email");
      await sendNotificationEmail(email, sujet, adminMessageEmailHtml(sujet, texte, "/notifications")).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}
