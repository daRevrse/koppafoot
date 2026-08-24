import { adminDb } from "@/lib/firebase-admin";

// ============================================
// Les mêmes droits qu'en lib/team-access, mais lus avec le SDK admin.
//
// POURQUOI UN SECOND FICHIER : le prédicat client travaille sur un objet
// `Team` déjà chargé dans le navigateur, alors qu'une route API n'a qu'un
// identifiant et doit aller lire le document. Le SDK admin ne peut pas
// s'importer côté client — il porte une clé de service — donc les deux ne
// peuvent pas vivre ensemble.
//
// La RÈGLE, elle, est unique et écrite une fois : propriétaire, ou présent
// dans `staff_manager_ids`.
// ============================================

export async function peutGererEquipeServeur(
  teamId: string | null | undefined,
  uid: string,
): Promise<boolean> {
  if (!teamId) return false;
  const snap = await adminDb.collection("teams").doc(teamId).get();
  if (!snap.exists) return false;
  const data = snap.data() ?? {};
  const delegues: string[] = data.staff_manager_ids ?? [];
  return data.manager_id === uid || delegues.includes(uid);
}
