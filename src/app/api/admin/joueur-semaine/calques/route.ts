import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { donneesDeLAffiche } from "@/lib/joueur-semaine-admin";
import { lireDemande } from "@/lib/joueur-semaine-requete";
import { calquesJoueurSemaine } from "@/lib/og-joueur-semaine";

/**
 * POST /api/admin/joueur-semaine/calques, l'affiche verticale d'un candidat
 * élément par élément, pour que le navigateur de l'admin en fasse la vidéo
 * (voir lib/video-joueur-semaine). Même corps et mêmes garanties que /affiche.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  const demande = lireDemande(await req.json().catch(() => null));
  if ("erreur" in demande) return NextResponse.json({ error: demande.erreur }, { status: 400 });

  try {
    const donnees = await donneesDeLAffiche(demande);
    if (!donnees) return NextResponse.json({ error: "Joueur introuvable cette semaine" }, { status: 404 });
    return NextResponse.json({ calques: await calquesJoueurSemaine(donnees) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("POST /api/admin/joueur-semaine/calques", err);
    return NextResponse.json({ error: "La vidéo n'a pas pu être préparée" }, { status: 500 });
  }
}
