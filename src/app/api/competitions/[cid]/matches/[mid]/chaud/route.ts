import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { annoncerMatchChaud } from "@/lib/chauds-serveur";
import { peutConfigurer } from "@/lib/competition-api-auth";
import type { FirestoreCompetition } from "@/types";

/**
 * POST /api/competitions/[cid]/matches/[mid]/chaud
 *
 * L'annonce d'un match chaud à ses abonnés et à ceux de sa compétition
 * (lib/chauds-serveur), appelée par le calendrier de l'organisateur juste
 * après avoir allumé la flamme. La flamme elle-même s'écrit côté client,
 * sous les règles Firestore ; cette route ne fait que prévenir, et seulement
 * une fois par match.
 *
 * Pour le staff de la compétition et l'administration (`peutConfigurer`),
 * vérifié ici : sans quoi n'importe quel compte pourrait faire sonner tous
 * les abonnés d'un tournoi.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ cid: string; mid: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { cid, mid } = await params;

  try {
    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    if (!(await peutConfigurer(uid, compSnap.data() as FirestoreCompetition))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return NextResponse.json(await annoncerMatchChaud(cid, mid));
  } catch (err) {
    console.error("POST /api/competitions/[cid]/matches/[mid]/chaud", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
