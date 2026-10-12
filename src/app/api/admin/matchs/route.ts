import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { matchsPourAdmin } from "@/lib/admin-serveur";
import { lireAmicalAdmin } from "@/lib/amical-admin";
import { AmicalRefuse, creerAmicalAdmin } from "@/lib/amical-admin-server";

/**
 * GET  /api/admin/matchs, les amicaux ET les matchs de compétition, du plus récent au plus ancien.
 * POST /api/admin/matchs, programmer un amical entre deux clubs (voir lib/amical-admin-server).
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json({ matchs: await matchsPourAdmin() });
  } catch (err) {
    console.error("GET /api/admin/matchs", err);
    return NextResponse.json({ error: "Lecture des matchs impossible" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;

  // Le jour se compte en temps universel, qui est aussi l'heure de Lomé.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const lu = lireAmicalAdmin(await req.json().catch(() => ({})), aujourdhui);
  if ("erreur" in lu) return NextResponse.json({ error: lu.erreur }, { status: 400 });

  try {
    return NextResponse.json(await creerAmicalAdmin(lu.valeur, appelant.uid));
  } catch (err) {
    if (err instanceof AmicalRefuse) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("POST /api/admin/matchs", err);
    return NextResponse.json({ error: "La création du match a échoué" }, { status: 500 });
  }
}
