import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";

// ============================================
// Suspendre un compte, pour de bon.
//
// La suspension n'écrivait que `is_active: false` sur le document : le compte
// disparaissait de la recherche et des envois, mais il se connectait comme
// avant, et continuait tout ce qu'il faisait. Elle passe désormais par Firebase
// Auth, qui seul décide qui se connecte :
//
//  - le compte est DÉSACTIVÉ : plus de connexion, par e-mail, Google ou
//    téléphone, sur le site comme sur l'application ;
//  - ses jetons de renouvellement sont RÉVOQUÉS : une session déjà ouverte ne
//    se prolonge plus. Le site et l'application la ferment d'ailleurs aussitôt,
//    en écoutant `is_active` (contexts/AuthContext, mobile lib/auth) ;
//  - le motif, l'auteur et la date restent sur le document, lus sur la fiche.
//
// Rien n'est effacé : équipes, matchs et statistiques restent, et la
// réactivation rend la connexion.
// ============================================

export class SuspensionImpossible extends Error {
  constructor(message: string, readonly statut = 409) {
    super(message);
  }
}

/** Un document de compte sans identifiant de connexion (import, test) : rien à bloquer. */
function sansIdentifiant(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "auth/user-not-found";
}

/**
 * Suspendre (`suspendre: true`) ou réactiver un compte.
 *
 * Firebase Auth d'abord, le document ensuite : si la désactivation échoue, le
 * compte n'est pas marqué suspendu alors qu'il se connecte encore — l'erreur
 * remonte et l'administrateur recommence. Suspendre un compte déjà suspendu
 * n'est pas une erreur : c'est ainsi qu'on bloque la connexion d'un compte
 * suspendu avant que la suspension ne la bloque.
 *
 * Rend `connexionBloquee` : vrai ou faux selon Firebase Auth, `null` quand le
 * compte n'y existe pas.
 */
export async function suspendreCompte(
  uid: string,
  suspendre: boolean,
  motif: string | null,
  par: string,
): Promise<{ connexionBloquee: boolean | null }> {
  if (uid === par) throw new SuspensionImpossible("Vous ne pouvez pas suspendre votre propre compte.");

  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new SuspensionImpossible("Compte introuvable.", 404);
  // Un administrateur suspendu garderait ses droits sur tout le reste de la
  // base dès qu'il retrouverait une session : on retire d'abord le droit.
  if (suspendre && estSuperadmin(snap.data())) {
    throw new SuspensionImpossible("Retirez d'abord à ce compte l'accès à l'administration.");
  }

  let connexionBloquee: boolean | null = suspendre;
  try {
    await adminAuth.updateUser(uid, { disabled: suspendre });
    if (suspendre) await adminAuth.revokeRefreshTokens(uid);
  } catch (err) {
    if (!sansIdentifiant(err)) throw err;
    connexionBloquee = null;
  }

  await ref.update(
    suspendre
      ? {
          is_active: false,
          suspension_reason: motif,
          suspended_by: par,
          suspended_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        }
      : {
          is_active: true,
          suspension_reason: FieldValue.delete(),
          suspended_by: FieldValue.delete(),
          suspended_at: FieldValue.delete(),
          updated_at: FieldValue.serverTimestamp(),
        },
  );

  return { connexionBloquee };
}

/** La connexion de ce compte est-elle bloquée ? `null` : il n'a pas d'identifiant. */
export async function connexionBloquee(uid: string): Promise<boolean | null> {
  try {
    return (await adminAuth.getUser(uid)).disabled;
  } catch (err) {
    if (sansIdentifiant(err)) return null;
    throw err;
  }
}
