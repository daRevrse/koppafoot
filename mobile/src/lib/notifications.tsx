import {
  collection, doc, getDocs, limit, onSnapshot, orderBy, query, updateDoc, where, writeBatch, type Unsubscribe,
} from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toNotification } from "@/lib/notification-mappers";
import type { FirestoreNotification, Notification } from "@/types";
import { usePremierPlan } from "~/hooks/usePremierPlan";
import { useAuth } from "~/lib/auth";
import { db } from "~/lib/firebase";

// La cloche : les notifications du compte connecté, les mêmes requêtes que le
// site (onNotifications, markNotificationRead, markAllNotificationsRead dans
// lib/firestore). UN SEUL ÉCOUTEUR pour toute l'application : la pastille de
// l'en-tête, sur chaque onglet, et le centre de notifications le partagent.

/** Assez pour le centre ; la pastille compte les non lues de cette fenêtre, comme celle du site. */
const HISTORIQUE = 100;

function ecouterNotifications(uid: string, cb: (liste: Notification[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "notifications"), where("user_id", "==", uid), orderBy("created_at", "desc"), limit(HISTORIQUE)),
    (snap) => cb(snap.docs.map((d) => toNotification(d.id, d.data() as FirestoreNotification))),
    // Hors ligne ou refusé : la cloche reste muette, rien ne casse.
    () => {},
  );
}

async function toutMarquerLuDansLaBase(uid: string): Promise<void> {
  const snap = await getDocs(query(collection(db, "notifications"), where("user_id", "==", uid), where("read", "==", false)));
  if (snap.empty) return;
  const lot = writeBatch(db);
  snap.docs.forEach((d) => lot.update(d.ref, { read: true }));
  await lot.commit();
}

interface EtatNotifications {
  /** `null` tant que le premier relevé n'est pas arrivé, ou sans compte. */
  notifications: Notification[] | null;
  nonLues: number;
  marquerLue: (id: string) => void;
  toutMarquerLu: () => void;
}

const Contexte = createContext<EtatNotifications>({ notifications: null, nonLues: 0, marquerLue: () => {}, toutMarquerLu: () => {} });

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const { utilisateur } = useAuth();
  const actif = usePremierPlan();
  const uid = utilisateur?.uid ?? null;
  // Les notifications lues appartiennent au compte qui les a lues : déconnecté, il n'y en a plus.
  const [lues, setLues] = useState<{ uid: string; liste: Notification[] } | null>(null);

  useEffect(() => {
    if (!uid || !actif) return;
    return ecouterNotifications(uid, (liste) => setLues({ uid, liste }));
  }, [uid, actif]);

  const notifications = uid && lues?.uid === uid ? lues.liste : null;

  // Optimiste, comme le site : la ligne s'éclaire tout de suite, l'écouteur confirme.
  const marquerLue = useCallback((id: string) => {
    setLues((l) => (l ? { ...l, liste: l.liste.map((n) => (n.id === id ? { ...n, read: true } : n)) } : l));
    updateDoc(doc(db, "notifications", id), { read: true }).catch(() => {});
  }, []);
  const toutMarquerLu = useCallback(() => {
    if (!uid) return;
    setLues((l) => (l ? { ...l, liste: l.liste.map((n) => ({ ...n, read: true })) } : l));
    toutMarquerLuDansLaBase(uid).catch(() => {});
  }, [uid]);

  const valeur = useMemo<EtatNotifications>(
    () => ({ notifications, nonLues: notifications?.filter((n) => !n.read).length ?? 0, marquerLue, toutMarquerLu }),
    [notifications, marquerLue, toutMarquerLu],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export const useNotifications = () => useContext(Contexte);
