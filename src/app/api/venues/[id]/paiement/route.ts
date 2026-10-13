import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { fedapayConfigure } from "@/lib/fedapay";
import { adminDb } from "@/lib/firebase-admin";
import { battementLu } from "@/lib/reglement";
import { ErreurReservation, appelant } from "@/lib/reservations-server";
import { ErreurVersement, ecrireCompteVersement, lireCompteVersement } from "@/lib/versements-serveur";

// ============================================
// GET /api/venues/[id]/paiement, PUT /api/venues/[id]/paiement
//
// Le propriétaire décide, terrain par terrain, si les frais de réservation se
// paient dans l'application, où il veut être versé, et ce que son terrain
// garde après chaque créneau.
//
// POURQUOI LE SERVEUR. Le terrain est un document public : le numéro de
// versement n'y a pas sa place, il va dans `comptes_versement`, fermée. Et
// activer le paiement sans tarif ni numéro encaisserait de l'argent qu'on ne
// saurait ni calculer ni verser.
//
// PAS D'ACTIVATION TANT QUE LE PAIEMENT N'EST PAS EN SERVICE. Sans clé FedaPay
// sur ce serveur, personne ne peut payer : on n'active pas des frais que les
// équipes ne pourraient pas régler, et l'écran ne les propose pas
// (`disponible`). Le battement, lui, n'a rien à voir avec l'argent : il se
// règle toujours.
// ============================================

export const dynamic = "force-dynamic";

async function lire(id: string, uid: string) {
  const snap = await adminDb.collection("venues").doc(id).get();
  if (!snap.exists) throw new ErreurReservation("Terrain introuvable", 404);
  if (snap.data()?.owner_id !== uid) throw new ErreurReservation("Ce terrain n'est pas le tien", 403);
  return snap;
}

async function etat(id: string, uid: string) {
  const v = (await lire(id, uid)).data() ?? {};
  const compte = await lireCompteVersement(uid);
  return {
    actif: v.paiement_app === true,
    /** Le paiement est en service sur ce serveur : les frais peuvent s'activer. */
    disponible: fedapayConfigure(),
    numero: compte?.numero ?? null,
    battement: battementLu(v.battement_min),
    tarif: typeof v.price_per_hour === "number" ? v.price_per_hour : 0,
  };
}

function echec(err: unknown, ou: string) {
  if (err instanceof ErreurReservation || err instanceof ErreurVersement) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${ou} failed:`, err);
  return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    return NextResponse.json(await etat(id, uid));
  } catch (err) {
    return echec(err, "GET /api/venues/[id]/paiement");
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uid = await appelant(req);
    const { id } = await params;
    const snap = await lire(id, uid);
    const corps = (await req.json().catch(() => ({}))) as { actif?: unknown; numero?: unknown; battement?: unknown };
    const actif = corps.actif === true;

    if (typeof corps.numero === "string" && corps.numero.trim()) await ecrireCompteVersement(uid, corps.numero);

    const dejaActif = snap.data()?.paiement_app === true;
    if (actif && !dejaActif && !fedapayConfigure()) {
      throw new ErreurReservation("Le paiement dans l'application n'est pas encore ouvert.", 409);
    }
    if (actif) {
      const tarif = snap.data()?.price_per_hour;
      if (typeof tarif !== "number" || tarif <= 0) {
        throw new ErreurReservation("Indique d'abord le tarif horaire de ce terrain : les frais en sont 5 %.", 400);
      }
      if (!(await lireCompteVersement(uid))) {
        throw new ErreurReservation("Donne le numéro mobile money où te verser les frais.", 400);
      }
    }

    const etaitActif = snap.data()?.paiement_app === true && typeof snap.data()?.paiement_app_depuis === "number";
    await snap.ref.update({
      paiement_app: actif,
      // Les frais ne valent que pour les demandes faites à partir de maintenant
      // (lib/reglement-serveur) : on date l'activation, pas chaque enregistrement.
      ...(actif && !etaitActif ? { paiement_app_depuis: Date.now() } : {}),
      battement_min: battementLu(corps.battement),
      updated_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json(await etat(id, uid));
  } catch (err) {
    return echec(err, "PUT /api/venues/[id]/paiement");
  }
}
