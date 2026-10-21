import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { EMPTY_COUNTS, type Pick, type PredictionCounts } from "@/lib/pronostics-shared";
import { lireMessage, TCHAT_DERNIERS, type MessageDuTchat } from "@/lib/tchat";
import { API_URL } from "~/lib/config";
import { auth, db } from "~/lib/firebase";

// Ce qu'on fait sur une fiche de match : pronostiquer, écrire au tchat. Les
// répliques de lib/predictions et lib/tchat-client du site — mêmes documents,
// mêmes routes —, qui lisent l'initialisation de l'application.

// ---- Le pronostic ----------------------------------------------------------

/** Un compte, un match, un pronostic : l'identifiant du document le garantit (lib/predictions). */
const idDuPronostic = (matchId: string, uid: string) => `${matchId}__${uid}`;

export async function monPronostic(matchId: string, uid: string): Promise<Pick | null> {
  try {
    const snap = await getDoc(doc(db, "match_predictions", idDuPronostic(matchId, uid)));
    if (!snap.exists()) return null;
    const pick = (snap.data() as { pick?: string }).pick;
    return pick === "home" || pick === "draw" || pick === "away" ? pick : null;
  } catch {
    return null;
  }
}

export async function pronostiquer(matchId: string, uid: string, pick: Pick): Promise<void> {
  await setDoc(
    doc(db, "match_predictions", idDuPronostic(matchId, uid)),
    { match_id: matchId, uid, pick, updated_at: serverTimestamp() },
    { merge: true },
  );
}

/** Les comptes du match, par la route du site (les comptes ne se lisent pas un à un). */
export async function comptesDesPronostics(matchId: string): Promise<PredictionCounts> {
  try {
    const res = await fetch(`${API_URL}/api/matches/${encodeURIComponent(matchId)}/predictions`);
    if (!res.ok) return EMPTY_COUNTS;
    const d = (await res.json()) as Partial<PredictionCounts>;
    return { home: d.home ?? 0, draw: d.draw ?? 0, away: d.away ?? 0, total: d.total ?? 0 };
  } catch {
    return EMPTY_COUNTS;
  }
}

// ---- Le tchat --------------------------------------------------------------

/**
 * Les derniers messages du tchat d'un match, en direct et du plus ancien au
 * plus récent ; `null` tant qu'on ne les a pas encore lus. La lecture est
 * publique (lib/tchat-client du site).
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
      () => setLus({ mid, messages: [] }),
    );
  }, [mid]);
  return mid && lus?.mid === mid ? lus.messages : null;
}

/** L'écriture passe par le serveur, qui contrôle le compte, le délai et la modération. */
async function appeler(chemin: string, method: "POST" | "DELETE", corps: Record<string, unknown>): Promise<void> {
  const utilisateur = auth.currentUser;
  if (!utilisateur) throw new Error("Connecte-toi pour continuer.");
  const res = await fetch(`${API_URL}${chemin}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${await utilisateur.getIdToken()}` },
    body: JSON.stringify(corps),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Une erreur est survenue");
  }
}

const routeDuTchat = (mid: string) => `/api/matches/${encodeURIComponent(mid)}/tchat`;

export const envoyerMessage = (mid: string, cid: string | null, texte: string) =>
  appeler(routeDuTchat(mid), "POST", { cid, texte });

export const supprimerMessage = (mid: string, cid: string | null, id: string) =>
  appeler(routeDuTchat(mid), "DELETE", { cid, id });

export const signalerMessage = (mid: string, cid: string | null, id: string) =>
  appeler(`${routeDuTchat(mid)}/signaler`, "POST", { cid, id });
