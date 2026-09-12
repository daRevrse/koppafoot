import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { peutGererEquipeServeur } from "@/lib/team-access-server";
import type { CampDuMatch, FirestoreMatch, FirestoreMatchValidation, StatutValidation } from "@/types";

// ============================================
// La validation d'un match, côté serveur.
//
// Elle vivait sur le document du match, que les règles laissent lire à tout
// le monde : statut, retours des managers, note donnée à l'arbitre, motifs de
// contestation. N'importe qui pouvait les lire avec le SDK web, sans compte.
// Elle vit désormais dans `match_validations/{matchId}` — lisible par les
// deux camps seulement, et écrite par le serveur seulement (voir
// firestore.rules). Tout ce qui l'écrit passe par ce fichier.
// ============================================

export const COLLECTION_VALIDATIONS = "match_validations";

/** La validation tacite : douze heures après la fin d'un match joué en direct. */
export const DELAI_VALIDATION_TACITE_MS = 12 * 60 * 60 * 1000;

export const refValidation = (matchId: string) =>
  adminDb.collection(COLLECTION_VALIDATIONS).doc(matchId);

/** Les uid des deux managers, sans le vide d'un adversaire hors plateforme. */
export function managersDuMatch(m: Pick<FirestoreMatch, "manager_id" | "away_manager_id">): string[] {
  return [m.manager_id, m.away_manager_id].filter((uid): uid is string => !!uid);
}

/**
 * Le camp au nom duquel parle ce compte, ou `null` s'il n'en gère aucun.
 *
 * `is_home` dit si le CRÉATEUR du match joue à domicile, et `away_manager_id`
 * est le manager d'en face — pas celui de l'équipe qui se déplace. Le staff
 * délégué parle pour son équipe, comme son manager.
 */
export async function campDuCompte(m: FirestoreMatch, uid: string): Promise<CampDuMatch | null> {
  const campDuCreateur: CampDuMatch = m.is_home ? "home" : "away";
  if (m.manager_id === uid) return campDuCreateur;
  if (m.away_manager_id && m.away_manager_id === uid) {
    return campDuCreateur === "home" ? "away" : "home";
  }
  if (await peutGererEquipeServeur(m.home_team_id, uid)) return "home";
  if (await peutGererEquipeServeur(m.away_team_id, uid)) return "away";
  return null;
}

/**
 * Le document d'une validation qui commence.
 *
 * `echeance` : la validation tacite, pour un match joué en direct entre deux
 * comptes. `null` partout ailleurs — un match renseigné attend une
 * contresignature, pas un délai, et un match contre une équipe hors
 * plateforme n'a personne pour valider.
 */
export function validationInitiale(
  matchId: string,
  m: Pick<FirestoreMatch, "manager_id" | "away_manager_id">,
  status: StatutValidation,
  echeance: Date | null,
): FirestoreMatchValidation {
  return {
    match_id: matchId,
    managers: managersDuMatch(m),
    status,
    feedback: {},
    contested_events: {},
    ...(echeance ? { auto_validate_at: Timestamp.fromDate(echeance) } : {}),
    created_at: FieldValue.serverTimestamp(),
    updated_at: FieldValue.serverTimestamp(),
  };
}
