import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { rechercherMembres, type FiltresMembres } from "@/lib/membres-serveur";

/**
 * GET /api/membres/recherche?role=joueur|arbitre|scoreur&ville=&poste=&niveau=&licence=&texte=
 *
 * Les recherches du mercato, des désignations et du corps arbitral, en liste
 * blanche (lib/membres-serveur). Réservé aux comptes connectés.
 */

export const dynamic = "force-dynamic";

const ROLES: FiltresMembres["role"][] = ["joueur", "arbitre", "scoreur"];

export async function GET(req: Request) {
  if (!(await uidAppelant(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const p = new URL(req.url).searchParams;
    const role = p.get("role") as FiltresMembres["role"];
    if (!ROLES.includes(role)) return NextResponse.json({ error: "Rôle inconnu" }, { status: 400 });
    const lire = (cle: string) => p.get(cle)?.trim().slice(0, 80) || undefined;
    const membres = await rechercherMembres({
      role, ville: lire("ville"), poste: lire("poste"), niveau: lire("niveau"), licence: lire("licence"), texte: lire("texte"),
    });
    return NextResponse.json({ membres });
  } catch (err) {
    console.error("GET /api/membres/recherche:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
