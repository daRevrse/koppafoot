import { NextResponse } from "next/server";
import {
  ErreurReservation, annoncer, appelant, synchroniserTerrain, type Annonce,
} from "@/lib/reservations-server";
import type { FirestoreReservationDuMatch } from "@/types";

// ============================================
// POST /api/competitions/[cid]/terrain, aligner la réservation du terrain sur
// une LISTE de matchs de compétition.
//
// Le pendant de /api/matches/[mid]/terrain pour un calendrier : un match
// programmé, un report, mais aussi un import de toute une journée. D'où la
// liste, et les annonces rangées puis envoyées À LA FIN, groupées par
// propriétaire : un email pour vingt demandes, pas vingt emails.
//
// Corps : { mids: string[] }. Comme pour un amical, rien d'autre : c'est
// l'état de chaque match, relu ici, qui dit quoi demander ou libérer.
// ============================================

export const dynamic = "force-dynamic";

/** Une journée de championnat tient large dedans ; le navigateur découpe au-delà. */
const MAX_MATCHS = 100;
/** Assez pour qu'un import ne traîne pas, pas au point d'inonder Firestore. */
const EN_PARALLELE = 5;

export async function POST(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  try {
    const uid = await appelant(req);
    const { cid } = await params;
    const corps = (await req.json().catch(() => ({}))) as { mids?: unknown };
    const mids = Array.isArray(corps.mids)
      ? [...new Set(corps.mids.filter(
          (m): m is string => typeof m === "string" && m.length > 0 && m.length <= 128 && !m.includes("/"),
        ))]
      : [];
    if (mids.length === 0) return NextResponse.json({ error: "Aucun match à aligner" }, { status: 400 });
    if (mids.length > MAX_MATCHS) {
      return NextResponse.json({ error: `${MAX_MATCHS} matchs au plus par appel` }, { status: 400 });
    }

    const annonces: (Annonce & { ownerId: string })[] = [];
    const reservations: Record<string, FirestoreReservationDuMatch | null> = {};
    let echecs = 0;

    for (let i = 0; i < mids.length; i += EN_PARALLELE) {
      await Promise.all(
        mids.slice(i, i + EN_PARALLELE).map(async (mid) => {
          try {
            reservations[mid] = await synchroniserTerrain({ mid, cid }, uid, annonces);
          } catch (err) {
            // Un refus d'accès vaut pour toute la compétition : on s'arrête.
            if (err instanceof ErreurReservation) throw err;
            echecs += 1;
            console.error(`POST /api/competitions/${cid}/terrain, match ${mid}:`, err);
          }
        }),
      );
    }

    // Les demandes déjà écrites sont annoncées même si d'autres ont échoué :
    // le propriétaire doit savoir ce qui l'attend.
    await annoncer(annonces);
    return NextResponse.json({ reservations, echecs });
  } catch (err) {
    if (err instanceof ErreurReservation) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("POST /api/competitions/[cid]/terrain failed:", err);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
