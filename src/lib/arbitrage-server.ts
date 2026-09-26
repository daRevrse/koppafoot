import { adminDb } from "@/lib/firebase-admin";
import type { FirestoreMatch } from "@/types";

// ============================================
// L'arbitrage et la couverture d'un match, côté serveur.
//
// Deux routes décident qui peut tenir le sifflet ou la console d'un amical :
// /api/matches/[mid]/couvrir (le scoreur) et /api/matches/[mid]/arbitre
// (l'arbitre). Elles partagent la même règle de fond — on n'officie pas dans
// un match qu'on joue — d'où ce fichier plutôt qu'une copie dans chacune.
// ============================================

/**
 * Est-il sur la feuille de ce match ?
 *
 * ON NE COUVRE PAS UN MATCH QU'ON JOUE. Le manager peut tenir la console de sa
 * propre équipe — c'est le dernier recours, et il l'a toujours pu — mais un
 * joueur qui saisit les buts de la rencontre qu'il dispute n'est pas un
 * scoreur, c'est un juge et partie.
 *
 * Deux sources, parce que la feuille n'existe pas toujours au moment où l'on
 * se propose : la convocation confirmée (`participations`), qui précède le
 * match de plusieurs jours, et la feuille elle-même quand elle est validée.
 */
export async function joueCeMatch(mid: string, uid: string, m: FirestoreMatch): Promise<boolean> {
  const surLaFeuille = [...(m.home_lineup ?? []), ...(m.away_lineup ?? [])]
    .some((e) => e.user_id === uid);
  if (surLaFeuille) return true;

  const convocations = await adminDb
    .collection("participations")
    .where("match_id", "==", mid)
    .where("player_id", "==", uid)
    .limit(5)
    .get();
  return convocations.docs.some((d) => d.data().status === "confirmed");
}

/** Le rôle d'arbitre, sur ses deux signaux (voir searchReferees). */
export function estArbitreServeur(d: Record<string, unknown> | undefined): boolean {
  return !!d && (d.evolution_role === "referee" || d.user_type === "referee");
}

/** « Prénom Nom », tel qu'on l'affiche sur le match. */
export function nomDuCompte(d: Record<string, unknown> | undefined, repli = "Un arbitre"): string {
  const s = (x: unknown) => (typeof x === "string" ? x.trim() : "");
  return `${s(d?.first_name)} ${s(d?.last_name)}`.trim() || repli;
}
