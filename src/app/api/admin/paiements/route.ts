import { NextRequest, NextResponse } from "next/server";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { ErreurFedapay } from "@/lib/fedapay";
import { adminDb } from "@/lib/firebase-admin";
import { ID_PAIEMENT, type FirestorePaiement } from "@/lib/paiement";
import { reglerPaiement } from "@/lib/paiement-serveur";

/**
 * Les paiements, côté administration.
 *
 * GET          , les cent derniers, du plus récent au plus ancien.
 * POST { id }  , revérifier : relire la collecte chez FedaPay et régler.
 *
 * « Revérifier » ne force rien : c'est `reglerPaiement`, la même fonction que
 * le webhook. Elle n'accorde que si FedaPay dit que c'est payé, au bon montant.
 * C'est le geste pour le client qui écrit « j'ai payé et je n'ai rien ».
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const iso = (x: unknown): string | null =>
  x && typeof (x as { toDate?: () => Date }).toDate === "function" ? (x as { toDate: () => Date }).toDate().toISOString() : null;

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const snap = await adminDb.collection("paiements").orderBy("created_at", "desc").limit(100).get();
    const uids = [...new Set(snap.docs.map((d) => (d.data() as FirestorePaiement).uid))];
    const profils = uids.length ? await adminDb.getAll(...uids.map((u) => adminDb.collection("users").doc(u))) : [];
    const parUid = new Map(profils.map((p) => [p.id, p.data() ?? {}]));
    const paiements = snap.docs.map((d) => {
      const l = d.data() as FirestorePaiement;
      const p = parUid.get(l.uid) ?? {};
      return {
        id: d.id,
        uid: l.uid,
        nom: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Compte sans nom",
        email: (p.email as string | undefined) ?? null,
        formule: l.formule,
        montant: l.montant,
        statut: l.statut,
        environnement: l.environnement,
        fedapayStatut: l.fedapay_statut,
        mode: l.mode,
        frais: l.frais,
        anomalie: l.anomalie,
        echeanceApres: l.echeance_apres,
        creeLe: iso(l.created_at),
      };
    });
    return NextResponse.json({ paiements });
  } catch (err) {
    console.error("[admin/paiements GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
    if (typeof id !== "string" || !ID_PAIEMENT.test(id)) {
      return NextResponse.json({ error: "Paiement manquant" }, { status: 400 });
    }
    const etat = await reglerPaiement(id);
    if (!etat) return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
    return NextResponse.json({ ok: true, ...etat });
  } catch (err) {
    if (err instanceof ErreurFedapay) {
      console.error("[admin/paiements POST] FedaPay:", err);
      return NextResponse.json({ error: "FedaPay ne répond pas. Réessaie dans un moment." }, { status: 502 });
    }
    console.error("[admin/paiements POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
