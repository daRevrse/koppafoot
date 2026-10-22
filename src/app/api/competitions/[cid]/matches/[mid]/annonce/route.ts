import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { estAVenir } from "@/lib/chauds";
import { peutConfigurer } from "@/lib/competition-api-auth";
import { getCompMatchPublic } from "@/lib/match-public";
import { calquesAnnonce } from "@/lib/og-annonce";
import { donneesDuFlyer } from "@/lib/og-flyer";
import type { FirestoreCompetition, FirestoreCompMatch } from "@/types";

/**
 * GET /api/competitions/[cid]/matches/[mid]/annonce
 *
 * Les calques de la vidéo d'annonce d'un match chaud (lib/og-annonce), que le
 * navigateur de l'organisateur anime et encode (lib/video-annonce,
 * lib/video-joueur-semaine-client). Voir
 * docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
 *
 * Pour le staff de la compétition et l'administration, comme le calendrier
 * PDF. Un match qui n'est pas chaud, ou plus à venir, n'a pas de vidéo : 404.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: Promise<{ cid: string; mid: string }> }) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { cid, mid } = await params;

  try {
    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    const comp = compSnap.data() as FirestoreCompetition;
    if (!(await peutConfigurer(uid, comp))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const matchSnap = await compSnap.ref.collection("comp_matches").doc(mid).get();
    const brut = matchSnap.data() as FirestoreCompMatch | undefined;
    if (!brut || brut.chaud !== true || !estAVenir(brut)) {
      return NextResponse.json({ error: "Seul un match chaud à venir a sa vidéo d'annonce" }, { status: 404 });
    }
    const match = comp.slug ? await getCompMatchPublic(comp.slug, mid) : null;
    if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

    return NextResponse.json(
      { calques: await calquesAnnonce(await donneesDuFlyer(match)) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (err) {
    console.error("GET /api/competitions/[cid]/matches/[mid]/annonce", err);
    return NextResponse.json({ error: "La vidéo n'a pas pu être préparée" }, { status: 500 });
  }
}
