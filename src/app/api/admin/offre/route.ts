import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import {
  droitActif, jourDeLome, type DroitAccorde, type DroitOffre, type FirestoreDroits,
} from "@/lib/offre";

/**
 * L'offre, côté administration.
 *
 * GET                                    , le réglage et les comptes qui ont un droit.
 * PUT    { limitesDepuis }                , fixer (ou retirer) l'entrée en vigueur des limites.
 * POST   { compte, droit, jusquAu, motif } , accorder le Pro ou l'option sans pub.
 * DELETE { uid, droit }                   , retirer un droit.
 *
 * Superadmin seulement. `droits/{uid}` et `settings/offre` ne s'écrivent que
 * par ici (firestore.rules) : c'est la seule porte vers le Pro tant que rien
 * ne s'achète.
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
    return NextResponse.json({ jour, limitesDepuis: reglage.data()?.limites_depuis ?? null, comptes });
  } catch (err) {
    console.error("[admin/offre GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { limitesDepuis } = (await req.json()) as { limitesDepuis?: unknown };
    if (limitesDepuis !== null && !jourValide(limitesDepuis)) {
      return NextResponse.json({ error: "Date invalide" }, { status: 400 });
    }
    await adminDb.collection("settings").doc("offre").set({
      limites_depuis: limitesDepuis,
      updated_by: appelant.uid,
      updated_at: FieldValue.serverTimestamp(),
    }, { merge: true });
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
