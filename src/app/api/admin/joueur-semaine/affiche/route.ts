import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { donneesDeLAffiche } from "@/lib/joueur-semaine-admin";
import { lireDemande } from "@/lib/joueur-semaine-requete";
import { afficheJoueurSemaine } from "@/lib/og-joueur-semaine";

/**
 * POST /api/admin/joueur-semaine/affiche, l'affiche d'un candidat en PNG, à
 * télécharger. Le corps : voir `DemandeAffiche` (lib/joueur-semaine-requete).
 *
 * Le serveur relit la semaine et ne croit le corps que sur le nom affiché et
 * les partenaires : la photo n'y paraît que si son joueur l'a autorisée.
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
    const format = demande.format ?? "vertical";
    const png = await afficheJoueurSemaine(donnees, format);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="joueur-semaine-${donnees.numeroSemaine}-${format}.png"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("POST /api/admin/joueur-semaine/affiche", err);
    return NextResponse.json({ error: "L'affiche n'a pas pu être générée" }, { status: 500 });
  }
}
