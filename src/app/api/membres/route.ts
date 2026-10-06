import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { lireMembres } from "@/lib/membres-serveur";

/**
 * POST /api/membres { uids } , les profils d'autres membres, en liste blanche
 * (lib/membres-serveur) : jamais leur e-mail ni leur numéro.
 *
 * Réservé aux comptes connectés, comme la règle Firestore qu'elle remplace
 * pour ces lectures ; les visiteurs ont leurs pages publiques
 * (/api/public/profile).
 */

export const dynamic = "force-dynamic";

const MAX_PAR_APPEL = 100;

export async function POST(req: Request) {
  if (!(await uidAppelant(req))) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { uids } = (await req.json().catch(() => ({}))) as { uids?: unknown };
    if (!Array.isArray(uids)) return NextResponse.json({ error: "Liste de comptes attendue" }, { status: 400 });
    if (uids.length > MAX_PAR_APPEL) {
      return NextResponse.json({ error: `${MAX_PAR_APPEL} comptes au plus par appel` }, { status: 400 });
    }
    return NextResponse.json({ membres: await lireMembres(uids as string[]) });
  } catch (err) {
    console.error("POST /api/membres:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
