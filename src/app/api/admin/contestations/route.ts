import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { ArbitrageImpossible, contestationsPourAdmin, trancherContestation } from "@/lib/admin-serveur";

/**
 * Les amicaux contestés, et leur arbitrage par l'administration.
 *
 * GET : ceux à trancher, puis les derniers tranchés.
 * POST { matchId, decision: "valide" | "annule", motif } : trancher.
 *
 * Quand deux camps ne s'accordent pas sur un match, personne ne pouvait
 * trancher : le match restait « contesté » pour toujours, le score ne
 * comptait ni ne disparaissait. LE MOTIF EST EXIGÉ : il part aux deux
 * managers, qui doivent comprendre la décision.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    return NextResponse.json({ contestations: await contestationsPourAdmin() });
  } catch (err) {
    console.error("GET /api/admin/contestations", err);
    return NextResponse.json({ error: "Lecture des contestations impossible" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const corps = (await req.json().catch(() => ({}))) as { matchId?: string; decision?: string; motif?: unknown };
  const motif = typeof corps.motif === "string" ? corps.motif.trim().slice(0, 500) : "";
  if (!corps.matchId || (corps.decision !== "valide" && corps.decision !== "annule")) {
    return NextResponse.json({ error: "matchId et decision (valide | annule) requis" }, { status: 400 });
  }
  if (motif.length < 5) {
    return NextResponse.json({ error: "Explique la décision aux deux managers" }, { status: 400 });
  }
  try {
    await trancherContestation(corps.matchId, corps.decision, motif, appelant.uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ArbitrageImpossible) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    console.error("POST /api/admin/contestations", err);
    return NextResponse.json({ error: "L'arbitrage a échoué" }, { status: 500 });
  }
}
