import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { exigerSuperadmin } from "@/lib/admin-api-auth";
import { messagesDuTchat } from "@/lib/tchat-serveur";
import type { SignalementDuTchat } from "@/lib/tchat";

/**
 * Les messages du tchat signalés (voir /api/matches/[mid]/tchat/signaler).
 *
 * GET                                  , la file : un message par ligne, avec
 *                                        le nombre de comptes qui l'ont signalé
 * PATCH { mid, messageId, action }     , « supprimer » vide le message dans le
 *                                        tchat ; « ignorer » le laisse. Dans les
 *                                        deux cas, ses signalements quittent la file.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const snap = await adminDb.collection("chat_reports").where("status", "==", "pending").limit(300).get();
    const parMessage = new Map<string, SignalementDuTchat>();
    for (const d of snap.docs) {
      const r = d.data();
      const cle = `${r.mid}_${r.message_id}`;
      const le = typeof r.cree_le?.toDate === "function" ? r.cree_le.toDate().toISOString() : null;
      const e: SignalementDuTchat = parMessage.get(cle) ?? {
        mid: r.mid, cid: r.cid ?? null, messageId: r.message_id, texte: r.texte ?? "",
        auteurUid: r.auteur_uid ?? "", auteurNom: r.auteur_nom ?? "", signalements: 0, raisons: [], le,
      };
      e.signalements += 1;
      if (r.raison) e.raisons.push(r.raison);
      if (le && (!e.le || le > e.le)) e.le = le;
      parMessage.set(cle, e);
    }
    const signalements = [...parMessage.values()].sort((a, b) => b.signalements - a.signalements || (b.le ?? "").localeCompare(a.le ?? ""));
    return NextResponse.json({ signalements });
  } catch (err) {
    console.error("GET /api/admin/tchat-signalements", err);
    return NextResponse.json({ error: "La file n'a pas pu être lue" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const appelant = await exigerSuperadmin(req);
  if (appelant instanceof NextResponse) return appelant;
  try {
    const { mid, messageId, action } = (await req.json().catch(() => ({}))) as {
      mid?: unknown; messageId?: unknown; action?: unknown;
    };
    const id = (x: unknown) => (typeof x === "string" && /^[A-Za-z0-9]{1,40}$/.test(x) ? x : null);
    const m = id(mid);
    const msg = id(messageId);
    if (!m || !msg || (action !== "supprimer" && action !== "ignorer")) {
      return NextResponse.json({ error: "mid, messageId et action requis" }, { status: 400 });
    }

    if (action === "supprimer") {
      const ref = messagesDuTchat(m).doc(msg);
      if ((await ref.get()).exists) {
        await ref.update({
          texte: null, supprime: true, supprime_par: appelant.uid, supprime_le: FieldValue.serverTimestamp(),
        });
      }
    }
    const reports = await adminDb.collection("chat_reports")
      .where("mid", "==", m).where("message_id", "==", msg).get();
    const lot = adminDb.batch();
    for (const d of reports.docs) {
      lot.update(d.ref, { status: action === "supprimer" ? "traite" : "ignore", traite_par: appelant.uid, traite_le: FieldValue.serverTimestamp() });
    }
    await lot.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/tchat-signalements", err);
    return NextResponse.json({ error: "L'opération a échoué" }, { status: 500 });
  }
}
