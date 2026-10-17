import { NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { uidAppelant } from "@/lib/appelant";
import { nomDansLaTribune, type CompteNomme } from "@/lib/tribune-commentaires";
import { attenteAvantMessage, tchatOuvert, texteDuMessage } from "@/lib/tchat";
import { lireMatchDuTchat, messagesDuTchat, peutModererLeTchat } from "@/lib/tchat-serveur";

/**
 * Le tchat d'un match en direct (voir lib/tchat).
 *
 * POST   { cid?, texte } , écrire : un compte actif, pendant le direct, un
 *                          message toutes les cinq secondes au plus.
 * DELETE { cid?, id }    , supprimer : l'auteur pour son propre message, le
 *                          staff du match et l'administration pour tous.
 *
 * `cid` désigne la compétition d'un match de compétition ; sans lui, c'est un
 * amical. La lecture, elle, se fait directement depuis Firestore : les
 * messages sont publics comme le match.
 */
export const dynamic = "force-dynamic";

class Refus extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Connecte-toi pour écrire dans le tchat." }, { status: 401 });
    const { mid } = await params;
    const corps = (await req.json().catch(() => ({}))) as { cid?: unknown; texte?: unknown };
    const cid = typeof corps.cid === "string" && corps.cid ? corps.cid : null;
    const texte = texteDuMessage(corps.texte);
    if (!texte) return NextResponse.json({ error: "Message vide ou trop long." }, { status: 400 });

    const [match, compte] = await Promise.all([
      lireMatchDuTchat(mid, cid),
      adminDb.collection("users").doc(uid).get(),
    ]);
    if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
    if (!tchatOuvert(match.statut)) {
      return NextResponse.json({ error: "Le tchat n'est ouvert que pendant le direct." }, { status: 409 });
    }
    const profil = compte.data();
    if (!profil) return NextResponse.json({ error: "Compte introuvable" }, { status: 403 });
    if (profil.is_active === false) {
      return NextResponse.json({ error: "Ton compte est suspendu : tu ne peux pas écrire." }, { status: 403 });
    }

    // Le débit se tient dans une transaction : deux onglets du même compte
    // ne passent pas à deux sous la limite.
    const auteurRef = adminDb.collection("match_chats").doc(mid).collection("auteurs").doc(uid);
    const messageRef = messagesDuTchat(mid).doc();
    const nom = nomDansLaTribune(profil as CompteNomme);
    await adminDb.runTransaction(async (tx) => {
      const auteur = await tx.get(auteurRef);
      const dernier = (auteur.get("dernier") as Timestamp | undefined)?.toMillis() ?? null;
      const attente = attenteAvantMessage(dernier);
      if (attente > 0) throw new Refus(`Patiente ${Math.ceil(attente / 1000)} s avant le prochain message.`, 429);
      tx.set(auteurRef, { dernier: FieldValue.serverTimestamp() });
      tx.set(messageRef, {
        texte,
        auteur_uid: uid,
        auteur_nom: nom,
        cree_le: FieldValue.serverTimestamp(),
        supprime: false,
      });
      // Le tchat sait de quel match il parle : utile à la modération.
      tx.set(adminDb.collection("match_chats").doc(mid), { cid, mid, maj_le: FieldValue.serverTimestamp() }, { merge: true });
    });

    return NextResponse.json({ id: messageRef.id, auteurNom: nom });
  } catch (err) {
    if (err instanceof Refus) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[tchat POST]", err);
    return NextResponse.json({ error: "Le message n'est pas parti" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ mid: string }> }) {
  try {
    const uid = await uidAppelant(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { mid } = await params;
    const corps = (await req.json().catch(() => ({}))) as { cid?: unknown; id?: unknown };
    const cid = typeof corps.cid === "string" && corps.cid ? corps.cid : null;
    const id = typeof corps.id === "string" && /^[A-Za-z0-9]{1,40}$/.test(corps.id) ? corps.id : null;
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const [match, message] = await Promise.all([lireMatchDuTchat(mid, cid), messagesDuTchat(mid).doc(id).get()]);
    if (!match || !message.exists) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

    const sonMessage = message.get("auteur_uid") === uid;
    if (!sonMessage && !(await peutModererLeTchat(uid, match))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Le message reste à sa place, vidé : la conversation garde son fil, et
    // ce qui a été dit ne se lit plus. Un signalement en a gardé la copie.
    await message.ref.update({
      texte: null,
      supprime: true,
      supprime_par: uid,
      supprime_le: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tchat DELETE]", err);
    return NextResponse.json({ error: "Le message n'a pas pu être supprimé" }, { status: 500 });
  }
}
