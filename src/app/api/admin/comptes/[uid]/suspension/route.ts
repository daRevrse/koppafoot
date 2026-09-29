import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { SuspensionImpossible, suspendreCompte } from "@/lib/suspension-serveur";

/**
 * POST /api/admin/comptes/[uid]/suspension { suspendre, motif }
 *
 * Suspendre bloque la connexion (voir lib/suspension-serveur). LE MOTIF EST
 * EXIGÉ pour suspendre : un autre administrateur relira la fiche, et le compte
 * écrira pour demander pourquoi. La réactivation n'en demande pas.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  const { uid } = await params;

  const corps = (await req.json().catch(() => ({}))) as { suspendre?: unknown; motif?: unknown };
  if (typeof corps.suspendre !== "boolean") {
    return NextResponse.json({ error: "suspendre (booléen) requis" }, { status: 400 });
  }
  const motif = typeof corps.motif === "string" ? corps.motif.trim().slice(0, 500) : "";
  if (corps.suspendre && motif.length < 5) {
    return NextResponse.json({ error: "Dis pourquoi ce compte est suspendu" }, { status: 400 });
  }

  try {
    const { connexionBloquee } = await suspendreCompte(uid, corps.suspendre, motif || null, appelant.uid);
    return NextResponse.json({ ok: true, actif: !corps.suspendre, connexionBloquee });
  } catch (err) {
    if (err instanceof SuspensionImpossible) {
      return NextResponse.json({ error: err.message }, { status: err.statut });
    }
    console.error("POST /api/admin/comptes/suspension", err);
    return NextResponse.json({ error: "La suspension a échoué" }, { status: 500 });
  }
}
