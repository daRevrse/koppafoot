// ============================================
// Le transfert de propriété d'une compétition, la partie pure.
//
// Le propriétaire propose sa compétition à l'un de ses modérateurs, qui
// accepte ou refuse. Ce module dit qui a le droit d'accepter et ce que
// l'acceptation écrit ; la route /api/competitions/transfert l'applique dans
// une transaction, avec le SDK admin.
//
// Aucun SDK ici : le serveur l'importe, et la suite de tests des modules
// partagés (mobile/src/__tests__) le teste sans Firebase.
// ============================================

import type { FirestoreTransfert } from "@/types";

type Equipe = {
  organizer_ids?: string[];
  moderator_ids?: string[];
};

/**
 * Ce que l'acceptation écrit sur la compétition.
 *
 * Le nouveau propriétaire prend la place des organisateurs ; ceux-ci restent
 * au staff comme modérateurs. Les retirer d'un coup aurait privé de son
 * tournoi quelqu'un qui voulait seulement passer la main, et le nouveau
 * propriétaire peut toujours les retirer ensuite.
 *
 * `created_by` suit : c'est lui que l'offre gratuite compte (voir
 * lib/offre-server), la compétition passe donc dans la limite du nouveau.
 */
export function apresTransfert(
  competition: Equipe,
  nouveau: string,
): { organizer_ids: string[]; moderator_ids: string[]; created_by: string } {
  const anciens = (competition.organizer_ids ?? []).filter((uid) => uid !== nouveau);
  const moderateurs = (competition.moderator_ids ?? []).filter((uid) => uid !== nouveau);
  return {
    organizer_ids: [nouveau],
    moderator_ids: [...new Set([...moderateurs, ...anciens])],
    created_by: nouveau,
  };
}

/**
 * Pourquoi `uid` ne peut pas accepter le transfert, ou `null` s'il le peut.
 *
 * Relu au moment d'accepter, et pas seulement au moment de proposer : entre
 * les deux, le propriétaire a pu retirer ce modérateur du staff.
 */
export function refusDeTransfert(
  competition: Equipe & { transfert?: FirestoreTransfert | null },
  uid: string,
): string | null {
  const t = competition.transfert;
  if (!t) return "Aucun transfert n'est proposé pour cette compétition.";
  if (t.vers_uid !== uid) return "Ce transfert n'est pas à toi.";
  if ((competition.organizer_ids ?? []).includes(uid)) return "Tu es déjà propriétaire de cette compétition.";
  if (!(competition.moderator_ids ?? []).includes(uid)) {
    return "Tu n'es plus modérateur de cette compétition, le transfert ne tient plus.";
  }
  return null;
}
