import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// ============================================
// Le contrôle superadmin des routes serveur.
//
// Écrit une fois : la vérification était recopiée dans chaque route, et une
// route de plus, c'était une chance de plus d'oublier la lecture du profil et
// de s'arrêter au jeton — qui dit seulement QUI appelle, jamais ce qu'il a le
// droit de faire.
//
// LA RECOPIE A COÛTÉ EXACTEMENT CE QU'ON CRAIGNAIT. Vingt et une routes
// gardaient leur propre `user_type === "superadmin"`, et la bascule du modèle
// de rôles — où la casquette d'administrateur est passée dans un drapeau — les
// a toutes cassées d'un coup : l'administrateur porte désormais
// `user_type: "user"`. D'où `estSuperadmin`, qui lit LES DEUX signaux et que
// ces routes appellent maintenant au lieu de comparer une chaîne.
// ============================================

/**
 * Un profil Firestore déjà lu porte-t-il la casquette d'administrateur ?
 *
 * Les deux signaux, comme partout : le drapeau est le modèle actuel,
 * `user_type` couvre ce qui n'aurait pas encore été migré. Prend la DONNÉE et
 * non l'identifiant : ces routes ont presque toutes déjà lu le document pour
 * une autre raison, et une seconde lecture ne dirait rien de plus.
 */
export function estSuperadmin(data: Record<string, unknown> | undefined): boolean {
  return data?.is_superadmin === true || data?.user_type === "superadmin";
}

export type Appelant = { uid: string };

export async function exigerSuperadmin(
  req: NextRequest,
): Promise<Appelant | NextResponse> {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(entete.split("Bearer ")[1])).uid;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const profil = await adminDb.collection("users").doc(uid).get();
  const data = profil.data();
  const superadmin = profil.exists && estSuperadmin(data);
  if (!superadmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  return { uid };
}
