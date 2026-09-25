import { NextResponse } from "next/server";
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
    return NextResponse.json({ reservation });
  } catch (err) {
    if (err instanceof ErreurReservation) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/matches/[mid]/terrain failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
