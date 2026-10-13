import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ErreurReglement, lireTicket, validerTicket } from "@/lib/reglement-serveur";

/**
 * GET  /api/reservations/ticket?code=…, ce que dit un ticket.
 * POST /api/reservations/ticket { code }, le valider.
 *
 * Le gérant, et lui seul : le serveur ne reconnaît un ticket que sur les
 * terrains de celui qui le présente. LIRE N'EST PAS VALIDER : le QR code
 * ouvre une page, et un téléphone qui précharge un lien ne doit pas déclarer
 * une équipe présente. La validation est un geste, donc un POST.
 */

export const dynamic = "force-dynamic";

function echec(err: unknown) {
  if (err instanceof ErreurReglement) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error("/api/reservations/ticket:", err);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

export async function GET(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    return NextResponse.json(await lireTicket(uid, new URL(req.url).searchParams.get("code")));
  } catch (err) {
    return echec(err);
  }
}

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
    return NextResponse.json(await validerTicket(uid, code));
  } catch (err) {
    return echec(err);
  }
}
