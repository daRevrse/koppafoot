import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ID_PAIEMENT } from "@/lib/paiement";
import { vuePour } from "@/lib/reglement-serveur";

/**
 * GET /api/reservations/{id}/reglement, où en sont les frais de réservation.
 *
 * Les deux parties d'une réservation le lisent, chacune à sa façon : l'équipe
 * y trouve ce qu'elle doit et son ticket, le propriétaire ce qui lui est dû.
 * La lecture SUIT la réservation au passage : c'est elle qui ouvre un
 * règlement manquant et qui constate une échéance passée.
 *
 * 404 pour tout autre, et quand la réservation n'a pas de règlement.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  try {
    const vue = ID_PAIEMENT.test(id) ? await vuePour(uid, id) : null;
    if (!vue) return NextResponse.json({ error: "Pas de frais de réservation ici" }, { status: 404 });
    return NextResponse.json(vue);
  } catch (err) {
    console.error("GET /api/reservations/[id]/reglement:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
