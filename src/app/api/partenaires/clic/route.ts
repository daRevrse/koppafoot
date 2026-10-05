import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { lienValide, type FirestorePartenariat } from "@/lib/partenaires";

/**
 * GET /api/partenaires/clic?id=<id>
 *
 * Le clic sur un partenaire passe par ici : on le compte, puis on renvoie
 * vers son site. Le lien de destination n'est jamais écrit dans la page,
 * seul le serveur le connaît, et il n'accepte que du https enregistré par
 * l'administration : cette route ne peut pas servir à rediriger n'importe où.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const accueil = new URL("/", req.url);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.redirect(accueil);

  try {
    const ref = adminDb.collection("partenariats").doc(id);
    const snap = await ref.get();
    const lien = lienValide((snap.data() as FirestorePartenariat | undefined)?.lien);
    if (!snap.exists || !lien) return NextResponse.redirect(accueil);
    await ref.update({ clics: FieldValue.increment(1) }).catch(() => {});
    return NextResponse.redirect(lien);
  } catch (err) {
    console.error("[partenaires clic]", err);
    return NextResponse.redirect(accueil);
  }
}
