import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import {
  droitActif, jourDeLome, type DroitAccorde, type DroitOffre, type FirestoreDroits,
} from "@/lib/offre";
import { environnementFedapay, fedapayConfigure } from "@/lib/fedapay";
import { ID_FORMULES, PRIX_PLANCHER, lirePrix, prixValide } from "@/lib/paiement";

/**
 * L'offre, côté administration.
 *
 * GET                                    , le réglage, les prix, et les comptes qui ont un droit.
 * PUT    { limitesDepuis } et/ou { prix } , fixer l'entrée en vigueur des limites, les prix du Pro.
 * POST   { compte, droit, jusquAu, motif } , accorder le Pro ou l'option sans pub.
 * DELETE { uid, droit }                   , retirer un droit.
 *
 * Superadmin seulement. `settings/offre` ne s'écrit que par ici ;
 * `droits/{uid}` s'écrit par ici (à la main) et par un paiement réglé
 * (lib/paiement-serveur). Les navigateurs n'écrivent ni l'un ni l'autre
 * (firestore.rules).
 *
 * UNE FORMULE EST EN VENTE DÈS QU'ELLE A UN PRIX. Vider un prix la retire de
 * la vente, sur-le-champ : c'est l'interrupteur.
 */

const DROITS: DroitOffre[] = ["pro", "sans_pub"];
const jourValide = (x: unknown): x is string =>
  typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !Number.isNaN(Date.parse(x));

/** Un compte à partir de ce que l'administrateur a tapé : son e-mail ou son identifiant. */
async function resoudreCompte(saisie: unknown): Promise<string | null> {
  const brut = typeof saisie === "string" ? saisie.trim() : "";
  if (!brut) return null;
  if (brut.includes("@")) {
    try {
      return (await adminAuth.getUserByEmail(brut.toLowerCase())).uid;
    } catch {
      return null;
    }
  }
  return (await adminDb.collection("users").doc(brut).get()).exists ? brut : null;
}

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const jour = jourDeLome();
    const [reglage, snap] = await Promise.all([
      adminDb.collection("settings").doc("offre").get(),
      adminDb.collection("droits").limit(500).get(),
    ]);
    const profils = snap.empty ? [] : await adminDb.getAll(...snap.docs.map((d) => adminDb.collection("users").doc(d.id)));
    const vue = (d: DroitAccorde | null | undefined) =>
      d ? { actif: droitActif(d, jour), depuis: d.depuis, jusquAu: d.jusqu_au, motif: d.motif, source: d.source } : null;
    const comptes = snap.docs
      .map((d, i) => {
        const droits = d.data() as FirestoreDroits;
        const p = profils[i]?.data() ?? {};
        return {
          uid: d.id,
          nom: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Compte sans nom",
          email: (p.email as string | undefined) ?? null,
          pro: vue(droits.pro),
          sansPub: vue(droits.sans_pub),
        };
      })
      .filter((c) => c.pro || c.sansPub);
    return NextResponse.json({
      jour,
      limitesDepuis: reglage.data()?.limites_depuis ?? null,
      prix: lirePrix(reglage.data()?.prix),
      fedapay: { configure: fedapayConfigure(), environnement: environnementFedapay() },
      comptes,
    });
  } catch (err) {
    console.error("[admin/offre GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const corps = (await req.json()) as { limitesDepuis?: unknown; prix?: unknown };
    const maj: Record<string, unknown> = { updated_by: appelant.uid, updated_at: FieldValue.serverTimestamp() };

    if ("limitesDepuis" in corps) {
      if (corps.limitesDepuis !== null && !jourValide(corps.limitesDepuis)) {
        return NextResponse.json({ error: "Date invalide" }, { status: 400 });
      }
      maj.limites_depuis = corps.limitesDepuis;
    }

    if ("prix" in corps) {
      const saisi = (corps.prix && typeof corps.prix === "object" ? corps.prix : {}) as Record<string, unknown>;
      const prix: Record<string, number | null> = {};
      for (const id of ID_FORMULES) {
        const v = saisi[id];
        if (v === null || v === undefined) prix[id] = null;
        else if (prixValide(v)) prix[id] = v;
        else {
          return NextResponse.json(
            { error: `Prix invalide : un nombre entier d'au moins ${PRIX_PLANCHER} FCFA, ou vide.` },
            { status: 400 },
          );
        }
      }
      maj.prix = prix;
    }

    if (!("limitesDepuis" in corps) && !("prix" in corps)) {
      return NextResponse.json({ error: "Rien à enregistrer" }, { status: 400 });
    }
    await adminDb.collection("settings").doc("offre").set(maj, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/offre PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const c = (await req.json()) as { compte?: unknown; droit?: unknown; jusquAu?: unknown; motif?: unknown };
    const droit = DROITS.includes(c.droit as DroitOffre) ? (c.droit as DroitOffre) : null;
    if (!droit) return NextResponse.json({ error: "Droit inconnu" }, { status: 400 });
    const jour = jourDeLome();
    const jusquAu = c.jusquAu === null ? null : jourValide(c.jusquAu) ? c.jusquAu : undefined;
    if (jusquAu === undefined) return NextResponse.json({ error: "Échéance invalide" }, { status: 400 });
    if (jusquAu !== null && jusquAu < jour) {
      return NextResponse.json({ error: "L'échéance est déjà passée." }, { status: 400 });
    }
    const uid = await resoudreCompte(c.compte);
    if (!uid) return NextResponse.json({ error: "Aucun compte ne correspond." }, { status: 404 });

    const motif = typeof c.motif === "string" ? c.motif.trim().slice(0, 140) || null : null;
    const accorde: DroitAccorde = { depuis: jour, jusqu_au: jusquAu, source: "admin", accorde_par: appelant.uid, motif };
    await adminDb.collection("droits").doc(uid).set(
      { [droit]: accorde, updated_at: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    console.error("[admin/offre POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { uid, droit } = (await req.json()) as { uid?: string; droit?: DroitOffre };
    if (!uid || !DROITS.includes(droit as DroitOffre)) {
      return NextResponse.json({ error: "Compte ou droit manquant" }, { status: 400 });
    }
    await adminDb.collection("droits").doc(uid).set(
      { [droit as DroitOffre]: null, updated_at: FieldValue.serverTimestamp() },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/offre DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
