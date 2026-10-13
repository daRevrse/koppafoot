import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { adminDb } from "@/lib/firebase-admin";
import { ID_PAIEMENT, type FirestorePaiement } from "@/lib/paiement";
import { reglerPaiement, vueEtat } from "@/lib/paiement-serveur";

/**
 * GET /api/paiements/{id}, où en est ce paiement ?
 *
 * C'est la vérification au retour du client : la page de l'offre l'appelle
 * avec l'identifiant lu dans l'adresse. Elle ne lit pas le `status` que
 * FedaPay y a mis (il ne prouve rien) : elle relit la collecte, et règle le
 * paiement s'il est abouti. Le webhook fait la même chose de son côté ; le
 * premier arrivé accorde, le second ne change rien.
 *
 * 404 pour tout autre que le titulaire : on ne dit même pas que la ligne existe.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const introuvable = () => NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  if (!ID_PAIEMENT.test(id)) return introuvable();

  try {
    const snap = await adminDb.collection("paiements").doc(id).get();
    const ligne = snap.data() as FirestorePaiement | undefined;
    if (!ligne || ligne.uid !== uid) return introuvable();
    try {
      return NextResponse.json((await reglerPaiement(id)) ?? vueEtat(ligne));
    } catch (err) {
      // FedaPay ne répond pas : on dit ce qu'on sait, la page redemandera.
      console.error("GET /api/paiements/[id], relecture:", id, err);
      return NextResponse.json(vueEtat(ligne));
    }
  } catch (err) {
    console.error("GET /api/paiements/[id]:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
