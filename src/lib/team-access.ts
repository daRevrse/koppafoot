import type { Team } from "@/types";

// ============================================
// Qui a le droit de faire quoi sur une équipe.
//
// LE PROBLÈME QU'ON RÉSOUT : `manager_id`, une seule chaîne, une seule
// personne. Un manager qui perd son téléphone un dimanche matin, et c'est
// l'équipe entière qui ne peut plus composer, répondre à une candidature ni
// convoquer. Le point de panne unique n'était pas un risque théorique, c'est
// le fonctionnement normal d'une équipe amateur, où l'on est deux ou trois à
// s'en occuper.
//
// DÉLÉGATION, PAS HIÉRARCHIE. Un délégué a les droits du manager sur
// l'équipe, ni plus ni moins. On n'invente pas de niveaux intermédiaires,
// « peut composer mais pas répondre aux candidatures » : chaque niveau
// supplémentaire est une règle Firestore de plus, un test de plus, et un
// malentendu de plus le jour d'un match.
//
// DEUX CHOSES RESTENT AU PROPRIÉTAIRE, et une seule raison : ce sont les deux
// gestes par lesquels on pourrait lui prendre son équipe. Nommer et révoquer
// le staff, et supprimer l'équipe. Un délégué qui pourrait nommer des
// délégués pourrait s'en nommer un qui exclut le manager.
// ============================================

/** Les titres proposés. Le champ reste libre, une équipe a le droit d'avoir
 *  un rôle qu'on n'a pas prévu. */
export const TITRES_STAFF = [
  "Adjoint",
  "Coach",
  "Entraîneur des gardiens",
  "Préparateur physique",
  "Dirigeant",
  "Soigneur",
];

/** Celui qui a créé l'équipe. Lui seul nomme le staff et supprime l'équipe. */
export function estProprietaireEquipe(team: Team | null | undefined, uid: string | undefined): boolean {
  return !!team && !!uid && team.managerId === uid;
}

/**
 * A-t-on les droits du manager sur cette équipe ?
 *
 * C'est le prédicat que doivent utiliser TOUTES les surfaces de gestion :
 * composition, dossards, effectif, candidatures, entraînements, joueurs
 * fantômes. Comparer `team.managerId` à la main quelque part, c'est un écran
 * qui restera fermé au staff sans que personne ne comprenne pourquoi.
 */
export function peutGererEquipe(team: Team | null | undefined, uid: string | undefined): boolean {
  if (!team || !uid) return false;
  return team.managerId === uid || (team.staffManagerIds ?? []).includes(uid);
}
