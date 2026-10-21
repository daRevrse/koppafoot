import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { peutConfigurer } from "@/lib/competition-api-auth";
import { calendrierDeCompetition } from "@/lib/calendrier-competition";
import { DEFAULT_HALF_DURATION, halfDuration } from "@/lib/competition-format";
import { toCompetition, toCompMatch } from "@/lib/competition-mappers";
import { dateAvecJourLong } from "@/lib/dates";
import { imageSure } from "@/lib/image-sure";
import { jourDeLome } from "@/lib/jour";
import { pdfCalendrier } from "@/lib/pdf-calendrier";
import type { FirestoreCompetition, FirestoreCompMatch } from "@/types";

/**
 * GET /api/competitions/[cid]/calendrier
 *
 * Le calendrier et les résultats de la compétition en PDF, pour le staff et
 * l'administration — le même contrôle que le rapport d'audience. L'organisateur
 * le partage ou le glisse dans ses rapports (voir lib/pdf-calendrier).
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
    const brut = compSnap.data() as FirestoreCompetition;
    if (!(await peutConfigurer(uid, brut))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const comp = toCompetition(cid, brut);
    const matchs = await compSnap.ref.collection("comp_matches").get();
    const cal = calendrierDeCompetition(
      matchs.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch)),
      comp.format ? halfDuration(comp.format) : DEFAULT_HALF_DURATION,
    );

    const jour = jourDeLome();
    const pdf = await pdfCalendrier(
      {
        nom: comp.name, slug: comp.slug, logo: imageSure(comp.logoUrl),
        debut: comp.startDate, fin: comp.endDate, ville: comp.venueCity, organisateur: comp.organizerName,
      },
      cal,
      dateAvecJourLong(new Date(`${jour}T00:00:00`), "fr", { annee: true }),
    );
    const nom = `calendrier-${comp.slug || cid}-${jour}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nom}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("GET /api/competitions/[cid]/calendrier", err);
    return NextResponse.json({ error: "Le calendrier n'a pas pu être créé" }, { status: 500 });
  }
}
