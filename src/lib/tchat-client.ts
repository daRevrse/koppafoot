"use client";

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { lireMessage, TCHAT_DERNIERS, type MessageDuTchat } from "@/lib/tchat";

// ============================================
// Le tchat d'un match, côté navigateur (voir lib/tchat). Les messages se
// lisent en direct depuis Firestore ; tout ce qui écrit passe par le serveur.
// ============================================

/**
 * Les derniers messages du tchat, du plus ancien au plus récent, en direct.
 * `null` tant qu'on ne sait pas encore ; `mid` à `null` n'écoute rien.
 */
export function useMessagesDuTchat(mid: string | null): MessageDuTchat[] | null {
  const [lus, setLus] = useState<{ mid: string; messages: MessageDuTchat[] } | null>(null);
  useEffect(() => {
    if (!mid) return;
    const q = query(collection(db, "match_chats", mid, "messages"), orderBy("cree_le", "desc"), limit(TCHAT_DERNIERS));
    return onSnapshot(
      q,
      (snap) => {
        const messages = snap.docs
          .map((d) => lireMessage(d.id, d.data({ serverTimestamps: "estimate" })))
          .filter((m): m is MessageDuTchat => m != null)
          .reverse();
        setLus({ mid, messages });
      },
      // Un tchat illisible ne doit pas casser la fiche du match : il reste vide.
      () => setLus({ mid, messages: [] }),
    );
  }, [mid]);
  return mid && lus?.mid === mid ? lus.messages : null;
}

async function appeler(url: string, method: "POST" | "DELETE", corps: Record<string, unknown>): Promise<void> {
  const utilisateur = auth.currentUser;
  if (!utilisateur) throw new Error("Connecte-toi pour continuer.");
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await utilisateur.getIdToken()}` },
    body: JSON.stringify(corps),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Une erreur est survenue");
  }
}

const route = (mid: string) => `/api/matches/${encodeURIComponent(mid)}/tchat`;

export const envoyerMessage = (mid: string, cid: string | null, texte: string) =>
  appeler(route(mid), "POST", { cid, texte });

export const supprimerMessage = (mid: string, cid: string | null, id: string) =>
  appeler(route(mid), "DELETE", { cid, id });

export const signalerMessage = (mid: string, cid: string | null, id: string) =>
  appeler(`${route(mid)}/signaler`, "POST", { cid, id });
