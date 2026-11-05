import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { lireDemande } from "@/lib/joueur-semaine-requete";
import { publierLeJoueur, retirerLeJoueur } from "@/lib/joueur-semaine-publie-serveur";

/**
 * POST   /api/admin/joueur-semaine/publier   publie le joueur de la semaine
 *        dans l'application. Le corps : celui d'une affiche (voir
 *        `DemandeAffiche`), sans format : les deux sont fabriqués et figés.
 * DELETE /api/admin/joueur-semaine/publier?lundi=AAAA-MM-JJ   le retire.
 *
 * Le Direct et Top performances se régénèrent à la visite suivante.
 * Voir lib/joueur-semaine-publie.
 */
export const dynamic = "force-dynamic";
// Deux affiches à dessiner, et la semaine entière à relire.
export const maxDuration = 60;

function rafraichir() {
  revalidatePath("/");
  revalidatePath("/top-players");
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  const demande = lireDemande(await req.json().catch(() => null));
  if ("erreur" in demande) return NextResponse.json({ error: demande.erreur }, { status: 400 });

  try {
    const joueur = await publierLeJoueur(demande, appelant.uid);
    if (!joueur) return NextResponse.json({ error: "Joueur introuvable cette semaine" }, { status: 404 });
    rafraichir();
    return NextResponse.json({ joueur });
  } catch (err) {
    console.error("POST /api/admin/joueur-semaine/publier", err);
    return NextResponse.json({ error: "La publication a échoué" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  const lundi = req.nextUrl.searchParams.get("lundi") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lundi)) return NextResponse.json({ error: "Semaine illisible" }, { status: 400 });

  try {
    await retirerLeJoueur(lundi);
    rafraichir();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/joueur-semaine/publier", err);
    return NextResponse.json({ error: "Le retrait a échoué" }, { status: 500 });
  }
}
