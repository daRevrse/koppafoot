import { formatDate } from "@/lib/dates";
import type { FirestoreNotification, Notification } from "@/types";

// Une notification de la cloche, du document Firestore à l'objet de
// l'interface. Sans SDK : le site (lib/firestore, qui le réexporte) et
// l'application le partagent.

export function toNotification(id: string, d: FirestoreNotification): Notification {
  return {
    id,
    userId: d.user_id,
    type: d.type,
    title: d.title,
    body: d.body,
    link: d.link ?? undefined,
    read: d.read,
    createdAt: formatDate(d.created_at),
  };
}
