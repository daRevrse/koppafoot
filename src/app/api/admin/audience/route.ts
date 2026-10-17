import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { lireCible, lirePeriode } from "@/lib/audience";
import {
  audienceDeCompetition, audienceDeMatch, directMaintenant, panorama, sessionsDe,
} from "@/lib/audience-serveur";

/**
 * GET /api/admin/audience, la mesure d'audience vue par l'administration.
 *
 *   ?vue=direct                          , les spectateurs de chaque match en cours
 *   ?cible=comp-{cid}&periode=…          , une compétition, ses pages et ses matchs
 *   ?cible=match-{mid}[&cid=…]           , un match : sa courbe, ses buts
 *   (rien)&periode=…                     , le panorama de la plateforme
 *
 * Voir lib/audience-serveur : la page des organisateurs et le rapport PDF
 * lisent les mêmes chiffres.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const p = req.nextUrl.searchParams;
  const periode = lirePeriode(p.get("periode"));
  try {
    if (p.get("vue") === "direct") return NextResponse.json(await directMaintenant());

    const brute = p.get("cible");
    if (brute) {
      const cible = lireCible(brute);
      if (!cible) return NextResponse.json({ error: "Cible inconnue" }, { status: 400 });
      if (cible.genre === "competition") {
        const audience = await audienceDeCompetition(cible.id, periode);
        return audience
          ? NextResponse.json(audience)
          : NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
      }
      // Un match de compétition se trouve sous sa compétition : la session la
      // porte, quand l'adresse ne la donne pas.
      const cid = p.get("cid")
        ?? (await sessionsDe(brute, "00000000")).find((s) => s.cid)?.cid
        ?? null;
      const audience = await audienceDeMatch(cible.id, cid);
      return audience
        ? NextResponse.json(audience)
        : NextResponse.json({ error: "Match introuvable" }, { status: 404 });
    }

    return NextResponse.json(await panorama(periode));
  } catch (err) {
    console.error("GET /api/admin/audience", err);
    return NextResponse.json({ error: "L'audience n'a pas pu être calculée" }, { status: 500 });
  }
}
