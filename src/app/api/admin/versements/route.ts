import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { adminDb } from "@/lib/firebase-admin";
import { ErreurVersement, reglerALaMain, sommesDues } from "@/lib/versements-serveur";

/**
 * Les versements, côté administration.
 *
 * GET              , ce qui est dû à chacun, et le taux des frais de paiement.
 * POST { ids }     , ces sommes ont été versées par mobile money : les marquer.
 * PUT  { tauxFrais }, le taux des frais de paiement ajoutés à ce que l'équipe paie.
 *
 * Les dépôts FedaPay sont fermés sur le compte tant que leur support ne les a
 * pas activés : en attendant, c'est ici qu'on lit qui verser, et qu'on le dit.
 */

export const dynamic = "force-dynamic";

const reglages = () => adminDb.collection("settings").doc("paiement");

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const [r, groupes] = await Promise.all([reglages().get(), sommesDues()]);
    const taux = r.data()?.taux_frais;
    return NextResponse.json({ tauxFrais: typeof taux === "number" ? taux : 0, groupes });
  } catch (err) {
    console.error("[admin/versements GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
      return NextResponse.json({ error: "Sommes manquantes" }, { status: 400 });
    }
    return NextResponse.json(await reglerALaMain(ids as string[], appelant.uid));
  } catch (err) {
    if (err instanceof ErreurVersement) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[admin/versements POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { tauxFrais } = (await req.json().catch(() => ({}))) as { tauxFrais?: unknown };
    if (typeof tauxFrais !== "number" || !Number.isFinite(tauxFrais) || tauxFrais < 0 || tauxFrais > 20) {
      return NextResponse.json({ error: "Taux invalide : un nombre entre 0 et 20." }, { status: 400 });
    }
    await reglages().set(
      { taux_frais: tauxFrais, updated_by: appelant.uid, updated_at: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/versements PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
