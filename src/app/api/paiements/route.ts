import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ErreurPaiement, demarrerPaiement, type RefusPaiement } from "@/lib/paiement-serveur";

/**
 * POST /api/paiements { formule }, démarrer l'achat du Pro.
 *
 * Rend l'adresse de la page de paiement FedaPay ; le navigateur y va. Le corps
 * ne porte que le nom de la formule : le montant est lu par le serveur dans
 * `settings/offre`, jamais reçu du navigateur.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const STATUT: Record<RefusPaiement, number> = {
  formule: 400,
  telephone: 400,
  reservation: 404,
  deja_paye: 409,
  trop_tard: 409,
  bac_a_sable: 403,
  pas_en_vente: 409,
  deja_illimite: 409,
  trop_de_tentatives: 429,
  fedapay: 502,
  non_configure: 503,
};

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const { formule } = (await req.json().catch(() => ({}))) as { formule?: unknown };
    return NextResponse.json(await demarrerPaiement(uid, formule, new URL(req.url).origin));
  } catch (err) {
    if (err instanceof ErreurPaiement) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUT[err.code] });
    }
    console.error("POST /api/paiements:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
