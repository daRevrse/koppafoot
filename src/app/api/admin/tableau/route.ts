import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { tableauDeBord } from "@/lib/admin-serveur";

/** GET /api/admin/tableau, le tableau de bord : ce qui attend, et ce qui existe. */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json(await tableauDeBord());
  } catch (err) {
    console.error("GET /api/admin/tableau", err);
    return NextResponse.json({ error: "Le tableau de bord n'a pas pu être calculé" }, { status: 500 });
  }
}
