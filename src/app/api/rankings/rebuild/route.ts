import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { recalculerClassements } from "@/lib/classement-admin";

/**
 * POST /api/rankings/rebuild, recalcule le classement des joueurs.
 *
 * Appelée à la fin de chaque match, par la console qui vient de le clore. Le
 * classement lit TOUS les matchs terminés de la plateforme : c'est trop cher
 * pour une lecture de page, et inutile entre deux rencontres puisque rien ne
 * bouge. On le calcule donc au seul moment où il change.
 *
 * UN JETON EST EXIGÉ, sans contrôle de rôle. Le calcul ne détruit rien et ne
 * dépend d'aucun paramètre — il relit la base et republie —, donc il n'y a pas
 * de dégât à craindre d'un appelant mal intentionné. Il y a en revanche un
 * COÛT : chaque appel parcourt toutes les compétitions. Le jeton est là pour
 * ça, pas pour protéger une donnée.
 *
 * L'échec est silencieux côté appelant : un classement en retard d'un match
 * est un désagrément, un coup de sifflet final qui échoue est une perte.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const entete = req.headers.get("authorization");
  if (!entete?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    await adminAuth.verifyIdToken(entete.split("Bearer ")[1]);
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  try {
    const classements = await recalculerClassements();
    return NextResponse.json({
      ok: true,
      performances: classements.performances.length,
      gardiens: classements.gardiens.length,
      matchsRetenus: classements.matchsRetenus,
    });
  } catch (err) {
    console.error("POST /api/rankings/rebuild failed:", err);
    return NextResponse.json({ error: "Calcul impossible" }, { status: 500 });
  }
}
