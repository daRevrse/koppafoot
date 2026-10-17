import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { peutConfigurer } from "@/lib/competition-api-auth";
import { jourAudience, lirePeriode } from "@/lib/audience";
import { audienceDeCompetition, audienceDeMatch } from "@/lib/audience-serveur";
import { rapportAudience } from "@/lib/rapport-audience";
import { toCompMatch } from "@/lib/competition-mappers";
import { statsDeJeu } from "@/lib/stats-competition";
import type { FirestoreCompetition, FirestoreCompMatch } from "@/types";

/**
 * GET /api/competitions/[cid]/audience/rapport?periode=7j|30j|tout
 *
 * Le rapport d'audience en PDF, pour le staff de la compétition et
 * l'administration — le même contrôle que la page Statistiques. Un vrai
 * fichier, qui part tel quel sur WhatsApp (voir lib/rapport-audience). Sa
 * seconde page porte les statistiques de jeu, sur toute la compétition : la
 * période ne vaut que pour l'audience.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 30;

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

    const audience = await audienceDeCompetition(cid, lirePeriode(new URL(req.url).searchParams.get("periode")));
    if (!audience) return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    // La courbe du match au plus haut pic : `matchs` est déjà trié du plus suivi au moins suivi.
    const premier = audience.matchs.find((m) => m.pic);
    const [plusSuivi, matchs] = await Promise.all([
      premier ? audienceDeMatch(premier.mid, cid) : Promise.resolve(null),
      compSnap.ref.collection("comp_matches").where("status", "==", "completed").get(),
    ]);
    const jeu = statsDeJeu(matchs.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch)));

    const pdf = await rapportAudience(audience, plusSuivi, jeu);
    const jour = jourAudience();
    const nom = `statistiques-${audience.slug || cid}-${jour.slice(0, 4)}-${jour.slice(4, 6)}-${jour.slice(6, 8)}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nom}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/competitions/[cid]/audience/rapport", err);
    return NextResponse.json({ error: "Le rapport n'a pas pu être créé" }, { status: 500 });
  }
}
