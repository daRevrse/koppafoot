import type { NotificationType } from "@/types";

// ============================================
// Ce qu'un compte peut écrire, lui-même, dans la cloche d'un autre.
//
// La plupart des notifications naissent sur le serveur. Quelques-unes naissent
// dans le navigateur, au geste de celui qui agit : il invite, défie, convoque,
// déplace un match, désigne un arbitre, répond à une demande. Celles-là seules
// passent par la route /api/notifications/push, et les règles Firestore
// n'acceptent que ces types, signés de leur auteur (`from_uid`).
//
// La liste est reprise telle quelle dans firestore.rules : les deux doivent
// bouger ensemble.
// ============================================

export const TYPES_ECRITS_PAR_LE_CLIENT: readonly NotificationType[] = [
  "invitation",
  "join_request",
  "match_challenge",
  "match_update",
  "participation_request",
  "arbitrage",
];

/** Une notification telle que le navigateur l'écrit. */
export interface NotificationClient {
  user_id: string;
  from_uid: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
}
