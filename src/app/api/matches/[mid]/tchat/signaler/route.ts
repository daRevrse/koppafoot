import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { messagesDuTchat } from "@/lib/tchat-serveur";

/**
 * POST /api/matches/[mid]/tchat/signaler  { cid?, id, raison? }
 *
 * Signaler un message du tchat. Il rejoint la file des signalements de
 * l'administration (/admin/signalements), à côté de ceux de la Tribune, avec
 * une COPIE du texte : un modérateur qui le supprime ensuite ne doit pas
 * effacer ce que l'administration a besoin de lire. `chat_reports` est fermé
 * aux navigateurs ; on y écrit d'ici, et on ne le relit jamais d'ici.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Connecte-toi pour signaler un message." }, { status: 401 });
    const { mid } = await params;
    const corps = (await req.json().catch(() => ({}))) as { cid?: unknown; id?: unknown; raison?: unknown };
    const id = typeof corps.id === "string" && /^[A-Za-z0-9]{1,40}$/.test(corps.id) ? corps.id : null;
    if (!/^[A-Za-z0-9]{1,40}$/.test(mid) || !id) return NextResponse.json({ error: "Message inconnu" }, { status: 400 });
    const raison = typeof corps.raison === "string" ? corps.raison.trim().slice(0, 300) : "";

    const message = await messagesDuTchat(mid).doc(id).get();
    if (!message.exists || message.get("supprime") === true) {
      return NextResponse.json({ error: "Ce message n'existe plus." }, { status: 404 });
    }
    if (message.get("auteur_uid") === uid) {
      return NextResponse.json({ error: "Tu ne peux pas signaler ton propre message : supprime-le." }, { status: 400 });
    }

    // Un signalement par compte et par message : le même doigt qui insiste ne
    // fait pas monter la file.
    const ref = adminDb.collection("chat_reports").doc(`${mid}_${id}_${uid}`);
    await ref.set({
      mid,
      cid: typeof corps.cid === "string" && corps.cid ? corps.cid : null,
      message_id: id,
      texte: message.get("texte") ?? "",
      auteur_uid: message.get("auteur_uid"),
      auteur_nom: message.get("auteur_nom") ?? "",
      signale_par: uid,
      raison,
      status: "pending",
      cree_le: FieldValue.serverTimestamp(),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tchat signaler]", err);
    return NextResponse.json({ error: "Le signalement n'est pas parti" }, { status: 500 });
  }
}
