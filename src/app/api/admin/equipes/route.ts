import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { equipesPourAdmin } from "@/lib/admin-serveur";

/** GET /api/admin/equipes, les clubs avec le bilan et l'effectif de leur fiche publique. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json({ equipes: await equipesPourAdmin() });
  } catch (err) {
    console.error("GET /api/admin/equipes", err);
    return NextResponse.json({ error: "Lecture des équipes impossible" }, { status: 500 });
  }
}
