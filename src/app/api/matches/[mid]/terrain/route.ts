import { NextResponse } from "next/server";
import { suivreReservation } from "@/lib/reglement-serveur";
import { ErreurReservation, appelant, synchroniserTerrain } from "@/lib/reservations-server";

// ============================================
// POST /api/matches/[mid]/terrain, aligner la réservation du terrain sur le
// match.
//
// Appelée par la page des matchs APRÈS chaque geste : création d'un amical ou
// d'un défi, défi refusé, annulation, suppression, report, modification
// acceptée. Elle ne reçoit rien d'autre que l'identifiant : c'est l'état du
// match, relu ici, qui dit quoi demander ou libérer (voir lib/reservations).
//
// Un échec ne défait pas le geste sur le match : la page le signale, et le
// prochain geste — ou un simple nouvel appel — rattrape l'écart.
// ============================================

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  try {
    const uid = await appelant(req);
    const { mid } = await params;
    const reservation = await synchroniserTerrain(mid, uid);
    // La réservation que le match garde : si elle est confirmée sur un terrain
    // qui fait payer ses frais, son règlement s'ouvre (lib/reglement-serveur).
    // Celle qu'un déplacement vient de libérer se clôt à sa prochaine lecture,
    // ou le lendemain matin.
    if (reservation?.booking_id) {
      await suivreReservation(reservation.booking_id).catch((err) => console.error("[reglement] suivi du match:", mid, err));
    }
    return NextResponse.json({ reservation });
  } catch (err) {
    if (err instanceof ErreurReservation) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/matches/[mid]/terrain failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
