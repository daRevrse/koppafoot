import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { lienInterne, sendPushToUser } from "@/lib/fcm-server";
import { categorieDuType, type PushCategory } from "@/lib/push-categories";
import type { NotificationType } from "@/types";

// ============================================
// Prévenir un compte depuis le serveur : la cloche ET le téléphone.
//
// Une quinzaine de routes écrivaient leur notification dans la cloche, et
// s'arrêtaient là : « Un résultat à confirmer », « Inscription acceptée »,
// « On te confie une équipe », « Tu couvres un match »… Tout ce qui attend
// une réponse de quelqu'un, et qu'il n'apprenait qu'en pensant à ouvrir
// l'appli. Un seul chemin désormais, pour ne plus en oublier la moitié.
//
// Rien ici ne fait échouer le geste qui l'a déclenché : l'inscription est
// acceptée, le score est enregistré ; la notification en est l'accusé.
// ============================================

export interface NotificationServeur {
  /** « system » : la modération qui s'adresse à un auteur (Tribune). */
  type: NotificationType | "system";
  title: string;
  body: string;
  link?: string | null;
  /** Par défaut, la catégorie du type (lib/push-categories). */
  categorie?: PushCategory;
  /**
   * Faux : la cloche seulement, sans sonner le téléphone. Pour ce qui arrive
   * en rafale (dix commentaires sous une même photo), où la cloche garde
   * chaque message et le téléphone n'en annonce qu'un.
   */
  push?: boolean;
}

/** Écrit la notification et la pousse. Ne lève jamais. */
export async function notifierCompte(uid: string, n: NotificationServeur): Promise<void> {
  if (!uid) return;
  const link = n.link ? lienInterne(n.link) : null;
  await Promise.allSettled([
    adminDb.collection("notifications").add({
      user_id: uid,
      type: n.type,
      title: n.title,
      body: n.body,
      link,
      read: false,
      created_at: FieldValue.serverTimestamp(),
    }),
    n.push === false ? null : sendPushToUser(uid, {
      title: n.title,
      body: n.body,
      link: link ?? "/notifications",
      category: n.categorie ?? (n.type === "system" ? "perso" : categorieDuType(n.type)),
    }),
  ]);
}

/** La même notification à plusieurs comptes, chacun une fois. */
export async function notifierComptes(uids: Iterable<string>, n: NotificationServeur): Promise<void> {
  await Promise.allSettled([...new Set([...uids].filter(Boolean))].map((uid) => notifierCompte(uid, n)));
}
