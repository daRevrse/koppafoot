import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { ficheCompteAdmin } from "@/lib/admin-serveur";

/** GET /api/admin/comptes/[uid], tout ce qu'il faut savoir d'un compte, en une lecture. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const { uid } = await params;
  try {
    const fiche = await ficheCompteAdmin(uid);
    if (!fiche) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
    return NextResponse.json(fiche);
  } catch (err) {
    console.error("GET /api/admin/comptes", err);
    return NextResponse.json({ error: "Lecture du compte impossible" }, { status: 500 });
  }
}
