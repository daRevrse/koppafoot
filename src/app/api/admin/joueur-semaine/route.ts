import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { jourDeLome } from "@/lib/jour";
import { semaineDu, semainePrecedente } from "@/lib/joueur-semaine";
import { imagesDesCandidats, lireLaSemaine, partenairesDuJour } from "@/lib/joueur-semaine-admin";

/**
 * GET /api/admin/joueur-semaine, le classement d'une semaine pour choisir le
 * joueur de l'affiche (voir lib/joueur-semaine).
 *
 *   ?lundi=AAAA-MM-JJ   n'importe quel jour de la semaine voulue ; absent : la
 *                       dernière semaine terminée
 *   ?ecartees=cid,cid   les compétitions écartées cette semaine
 *
 * Chaque candidat porte l'état de son image (voir lib/consentement-image),
 * jamais l'adresse de sa photo : la page n'en a pas besoin, l'aperçu passe
 * par /affiche.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  const p = req.nextUrl.searchParams;
  const demande = p.get("lundi");
  if (demande && !/^\d{4}-\d{2}-\d{2}$/.test(demande)) {
    return NextResponse.json({ error: "Semaine illisible" }, { status: 400 });
  }
  const lundi = demande ? semaineDu(demande).lundi : semainePrecedente(jourDeLome()).lundi;
  const ecartees = (p.get("ecartees") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  try {
    const [classement, partenaires] = await Promise.all([
      lireLaSemaine(lundi, ecartees),
      // Une page sans partenaires vaut mieux qu'une page en erreur.
      partenairesDuJour().catch((err) => {
        console.error("GET /api/admin/joueur-semaine: partenaires", err);
        return [];
      }),
    ]);
    const images = await imagesDesCandidats(classement.candidats);
    return NextResponse.json({
      classement: {
        semaine: classement.semaine,
        competitions: classement.competitions,
        dossards: classement.dossards,
        candidats: classement.candidats.map((c) => ({
          cle: c.cle,
          nom: c.nom,
          equipes: [...new Set(c.matchs.map((m) => m.equipe))],
          matchs: c.matchs.length,
          buts: c.buts,
          passes: c.passes,
          note: c.note,
          hommeDuMatch: c.hommeDuMatch,
          image: images.get(c.cle)?.etat ?? "aucun",
        })),
      },
      partenaires,
    });
  } catch (err) {
    console.error("GET /api/admin/joueur-semaine", err);
    return NextResponse.json({ error: "La semaine n'a pas pu être lue" }, { status: 500 });
  }
}
