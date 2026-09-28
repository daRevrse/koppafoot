import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin, superadminsDeLaPlateforme } from "@/lib/admin-api-auth";

/**
 * GET /api/admin/admins, les comptes qui ont la main sur l'administration.
 *
 * Paramètres les cherchait par `user_type == "superadmin"` et annonçait donc
 * « 0 superadmin sur la plateforme » à l'administrateur qui la lisait.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const admins = await superadminsDeLaPlateforme();
  return NextResponse.json({
    admins: admins
      .map(({ uid, data }) => ({
        uid,
        nom: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || "Compte sans nom",
        email: typeof data.email === "string" ? data.email : null,
        telephone: typeof data.phone === "string" ? data.phone : null,
        herite: data.is_superadmin !== true,
        moi: uid === appelant.uid,
      }))
      .sort((a, b) => Number(b.moi) - Number(a.moi) || a.nom.localeCompare(b.nom)),
  });
}
