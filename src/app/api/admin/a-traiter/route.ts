import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { compterATraiter } from "@/lib/admin-serveur";

/**
 * GET /api/admin/a-traiter, les compteurs du menu : candidatures,
 * signalements, retours, contestations, compétitions à valider. Quelques
 * requêtes de comptage, relues à chaque changement de page.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json(await compterATraiter());
  } catch (err) {
    console.error("GET /api/admin/a-traiter", err);
    return NextResponse.json({ error: "Comptage impossible" }, { status: 500 });
  }
}
