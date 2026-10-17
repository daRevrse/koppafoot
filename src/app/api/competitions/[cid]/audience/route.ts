import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { peutConfigurer } from "@/lib/competition-api-auth";
import { lirePeriode } from "@/lib/audience";
import { audienceDeCompetition, audienceDeMatch } from "@/lib/audience-serveur";
import type { FirestoreCompetition } from "@/types";

/**
 * GET /api/competitions/[cid]/audience, l'audience d'une compétition pour
 * son staff — organisateurs et modérateurs, ceux qui la configurent — et pour
 * l'administration.
 *
 *   ?periode=7j|30j|tout , ses pages et ses matchs
 *   ?match={mid}         , la courbe d'un de ses matchs
 *
 * Des agrégats seulement, les mêmes que l'administration (lib/audience-serveur) :
 * personne ne lit une session.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ cid: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { cid } = await params;

  try {
    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    if (!(await peutConfigurer(uid, compSnap.data() as FirestoreCompetition))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const url = new URL(req.url);
    const mid = url.searchParams.get("match");
    if (mid) {
      // Un match de CETTE compétition, pas d'une autre : `audienceDeMatch` le
      // cherche sous elle, et ne trouve rien ailleurs.
      const audience = await audienceDeMatch(mid, cid);
      return audience
        ? NextResponse.json(audience)
        : NextResponse.json({ error: "Match introuvable dans cette compétition" }, { status: 404 });
    }

    const audience = await audienceDeCompetition(cid, lirePeriode(url.searchParams.get("periode")));
    return NextResponse.json(audience);
  } catch (err) {
    console.error("GET /api/competitions/[cid]/audience", err);
    return NextResponse.json({ error: "L'audience n'a pas pu être calculée" }, { status: 500 });
  }
}
