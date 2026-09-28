import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { marquerRetour, retoursPourAdmin } from "@/lib/admin-serveur";

/**
 * Les retours des utilisateurs (le formulaire « Un retour ? »).
 *
 * GET              : les 300 derniers, du plus récent au plus ancien.
 * PATCH { id, traite } : marquer traité, ou rouvrir.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json({ retours: await retoursPourAdmin() });
  } catch (err) {
    console.error("GET /api/admin/retours", err);
    return NextResponse.json({ error: "Lecture des retours impossible" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const { id, traite } = (await req.json().catch(() => ({}))) as { id?: string; traite?: boolean };
  if (!id || typeof traite !== "boolean") {
    return NextResponse.json({ error: "id et traite requis" }, { status: 400 });
  }
  const ok = await marquerRetour(id, traite, appelant.uid);
  if (!ok) return NextResponse.json({ error: "Retour introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
