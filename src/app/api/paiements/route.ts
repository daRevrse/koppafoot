import { NextResponse } from "next/server";
import { uidAppelant } from "@/lib/appelant";
import { ErreurPaiement, demarrerAcompte, demarrerPaiement, type RefusPaiement } from "@/lib/paiement-serveur";

/**
 * POST /api/paiements, démarrer un paiement.
 *
 *  - { formule } : l'achat du Pro ;
 *  - { objet: "acompte", reservation, telephone? } : les frais de réservation
 *    d'un terrain. `telephone` est le numéro où les rendre si le propriétaire
 *    annule, obligatoire quand la réservation n'en porte pas.
 *
 * Rend l'adresse de la page de paiement FedaPay ; le navigateur y va. Le corps
 * ne porte jamais de montant : le serveur le lit dans `settings/offre` pour
 * le Pro, dans le règlement de la réservation pour un acompte.
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
  profil: 403,
  pas_en_vente: 409,
  deja_illimite: 409,
  deja_compris: 409,
  trop_de_tentatives: 429,
  fedapay: 502,
  non_configure: 503,
};

export async function POST(req: Request) {
  const uid = await uidAppelant(req);
  if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  try {
    const corps = (await req.json().catch(() => ({}))) as {
      formule?: unknown; objet?: unknown; reservation?: unknown; telephone?: unknown;
    };
    const origine = new URL(req.url).origin;
    return NextResponse.json(
      corps.objet === "acompte"
        ? await demarrerAcompte(uid, corps.reservation, origine, corps.telephone)
        : await demarrerPaiement(uid, corps.formule, origine),
    );
  } catch (err) {
    if (err instanceof ErreurPaiement) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: STATUT[err.code] });
    }
    console.error("POST /api/paiements:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
