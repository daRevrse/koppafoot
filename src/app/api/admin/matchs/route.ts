import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { matchsPourAdmin } from "@/lib/admin-serveur";

/** GET /api/admin/matchs, les amicaux ET les matchs de compétition, du plus récent au plus ancien. */
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
