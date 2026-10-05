import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";

/**
 * POST /api/partenaires/vue  { id }
 *
 * Un partenaire a été vu : son visuel est resté à moitié à l'écran (voir
 * components/partenaires/Emplacement). C'est le chiffre qu'on montre au
 * partenaire, avec les clics.
 *
 * Sans compte, comme la page qui l'envoie. Un compteur public peut être
 * gonflé par quelqu'un de décidé ; il reste un ordre de grandeur honnête pour
 * une marque de quartier, et le jour où un contrat se paiera à la vue, ce
 * comptage passera par une mesure qui se vérifie.
 */
export async function POST(req: NextRequest) {
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }
  try {
    // `update` et non `set` : un identifiant inventé ne crée pas de document.
    await adminDb.collection("partenariats").doc(id).update({ vues: FieldValue.increment(1) });
  } catch {
    // Partenariat supprimé entre-temps : rien à compter.
  }
  return NextResponse.json({ ok: true });
}
