import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { cibleDeLEvenement, signatureValide } from "@/lib/fedapay";
import { paiementParCollecte, reglerPaiement } from "@/lib/paiement-serveur";

/**
 * POST /api/webhooks/fedapay, ce que FedaPay nous annonce.
 *
 * LA SIGNATURE D'ABORD, sur le corps BRUT : `req.text()`, jamais `req.json()`,
 * qui rendrait un objet dont la réécriture ne serait plus celle qui a été
 * signée.
 *
 * ON N'APPLIQUE PAS CE QUE L'ÉVÉNEMENT DIT. On y lit seulement de quelle
 * collecte il parle ; `reglerPaiement` la relit chez FedaPay et décide. Un
 * événement rejoué, en retard, ou arrivé dans le désordre ne peut donc rien
 * fausser.
 *
 * CE QUI NE NOUS CONCERNE PAS REÇOIT 200. FedaPay désactive un webhook après
 * dix échecs : un événement d'un autre type, ou d'une collecte qu'on ne
 * connaît pas, n'est pas une erreur. Seule une vraie panne (FedaPay ou
 * Firestore injoignable pendant la relecture) répond 500, pour qu'il réessaie.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook non configuré" }, { status: 503 });

  const corps = await req.text();
  const hmac = (message: string) => createHmac("sha256", secret).update(message, "utf8").digest("hex");
  if (!signatureValide(corps, req.headers.get("x-fedapay-signature"), hmac)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  let evenement: unknown;
  try {
    evenement = JSON.parse(corps);
  } catch {
    return NextResponse.json({ ok: true, ignore: "corps illisible" });
  }
  const cible = cibleDeLEvenement(evenement);
  if (!cible) return NextResponse.json({ ok: true, ignore: "hors sujet" });

  try {
    const id = cible.reference ?? (cible.idCollecte !== null ? await paiementParCollecte(cible.idCollecte) : null);
    const etat = id ? await reglerPaiement(id) : null;
    if (!etat) return NextResponse.json({ ok: true, ignore: "paiement inconnu" });
    return NextResponse.json({ ok: true, statut: etat.statut });
  } catch (err) {
    console.error("[webhooks/fedapay]", cible, err);
    return NextResponse.json({ error: "Relecture impossible" }, { status: 500 });
  }
}
