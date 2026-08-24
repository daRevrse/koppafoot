import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

// ============================================
// Le contrôle superadmin des routes d'administration.
//
// Écrit une fois : la vérification était recopiée dans chaque route, et une
// route de plus, c'était une chance de plus d'oublier la lecture du profil et
// de s'arrêter au jeton — qui dit seulement QUI appelle, jamais ce qu'il a le
// droit de faire.
// ============================================

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
  const superadmin =
    profil.exists && (data?.user_type === "superadmin" || data?.is_superadmin === true);
  if (!superadmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  return { uid };
}
