import { getToken, deleteToken, onMessage } from "firebase/messaging";
import { getClientMessaging } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ============================================
// Le push, côté navigateur.
//
// CE QUI A CHANGÉ ICI, et pourquoi ça comptait. La permission était demandée
// dans un effet, au montage, dès qu'un utilisateur était connecté : fenêtre
// système en pleine figure à l'ouverture, sans avoir rien demandé ni compris
// ce qu'on accepte. Or un refus est DÉFINITIF côté navigateur — plus aucun
// appel ne peut le rouvrir, ni le nôtre ni un autre. Un réflexe de fermeture
// coûtait donc le canal entier, sur l'appareil, pour toujours.
//
// La permission ne se demande plus qu'à l'instant où quelqu'un actionne
// l'interrupteur. Un geste, une intention, et un contexte qui explique ce
// qu'on va envoyer.
//
// LE JETON EST PAR APPAREIL, la préférence est par compte. Couper le push sur
// le téléphone ne doit pas l'éteindre sur l'ordinateur : on retire donc le
// jeton de CET appareil, pas la liste. D'où la trace en localStorage, seule
// façon de savoir lequel des jetons du compte est le nôtre.
// ============================================

const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY ?? "";

/** Le jeton de cet appareil, pour pouvoir le retirer sans toucher aux autres. */
const CLE_JETON = "koppafoot:push-token";

export type EtatPush =
  /** Ni service worker ni API de notification : rien à proposer. */
  | "non-supporte"
  /** iOS hors application installée. Safari ne donne le push qu'à une PWA
   *  ajoutée à l'écran d'accueil, proposer l'interrupteur ici ne mène qu'à
   *  une erreur silencieuse. */
  | "ios-hors-app"
  /** Permission refusée au navigateur. Irréversible par code. */
  | "refuse"
  /** Possible, pas activé sur cet appareil. */
  | "inactif"
  /** Activé sur cet appareil. */
  | "actif";

function estIOS(): boolean {
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ se présente comme un Mac, le tactile le trahit.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function estInstallee(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Ce que cet appareil peut, et où il en est. Lecture seule, sans effet. */
export function etatPush(): EtatPush {
  if (typeof window === "undefined") return "non-supporte";
  if (estIOS() && !estInstallee()) return "ios-hors-app";
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "non-supporte";
  if (!VAPID_KEY) return "non-supporte";

  if (Notification.permission === "denied") return "refuse";
  if (Notification.permission === "granted" && localStorage.getItem(CLE_JETON)) return "actif";
  return "inactif";
}

/**
 * Le service worker de FCM.
 *
 * Il lui faut le sien, distinct de celui de la PWA : il doit vivre pour
 * afficher les messages reçus application fermée. La configuration Firebase
 * (publique) part en paramètres d'URL plutôt qu'en dur dans le fichier
 * committé, et le scope est dédié pour qu'il coexiste avec sw.js au lieu de
 * le remplacer.
 */
async function enregistrerWorker(): Promise<ServiceWorkerRegistration | null> {
  const cfg = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  });
  try {
    return await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${cfg.toString()}`,
      { scope: "/firebase-cloud-messaging-push-scope" },
    );
  } catch (err) {
    console.warn("[FCM] enregistrement du service worker refusé :", err);
    return null;
  }
}

/** Mint un jeton et l'attache au compte. Ne demande aucune permission. */
async function inscrireAppareil(userId: string): Promise<boolean> {
  const messaging = getClientMessaging();
  if (!messaging) return false;

  const registration = await enregistrerWorker();
  if (!registration) return false;

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  }).catch((err) => {
    console.warn("[FCM] getToken a échoué :", err);
    return null;
  });
  if (!token) return false;

  await updateDoc(doc(db, "users", userId), { fcm_tokens: arrayUnion(token) });
  localStorage.setItem(CLE_JETON, token);
  return true;
}

/**
 * Allume le push sur cet appareil. À n'appeler que sur un geste utilisateur :
 * c'est ici, et nulle part ailleurs, que la fenêtre système s'ouvre.
 */
export async function activerPush(userId: string): Promise<EtatPush> {
  const depart = etatPush();
  if (depart !== "inactif") return depart;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "refuse" : "inactif";

  const ok = await inscrireAppareil(userId);
  return ok ? "actif" : "inactif";
}

/**
 * Éteint le push sur cet appareil seulement.
 *
 * On retire le jeton des deux côtés : de la liste du compte, pour que le
 * serveur cesse d'émettre, et du navigateur, pour ne pas laisser une
 * inscription orpheline qui se réveillerait à la prochaine activation.
 */
export async function desactiverPush(userId: string): Promise<EtatPush> {
  const token = localStorage.getItem(CLE_JETON);
  localStorage.removeItem(CLE_JETON);

  if (token) {
    await updateDoc(doc(db, "users", userId), {
      fcm_tokens: arrayRemove(token),
    }).catch((err) => console.warn("[FCM] retrait du jeton échoué :", err));
  }

  const messaging = getClientMessaging();
  if (messaging) await deleteToken(messaging).catch(() => {});

  return etatPush();
}

/**
 * Remet d'accord le navigateur et le compte, sans jamais ouvrir de fenêtre.
 *
 * Deux situations, un seul geste :
 *
 *  - LE JETON A TOURNÉ. Un jeton FCM change — réinstallation, nettoyage du
 *    navigateur, expiration — et un jeton périmé, c'est une notification qui
 *    ne part plus sans que personne ne s'en aperçoive.
 *
 *  - LE COMPTE AVAIT DÉJÀ ACCEPTÉ, avant que ce réglage existe. Il n'a donc
 *    aucune trace locale, et l'interrupteur l'afficherait éteint alors qu'il
 *    reçoit toujours. Le mensonge est pire que l'absence de réglage.
 *
 * Silencieux par construction : on ne tente rien tant que la permission n'est
 * pas déjà accordée, donc aucune fenêtre système ne peut s'ouvrir ici.
 */
export async function reconcilierPush(userId: string): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (etatPush() === "non-supporte" || etatPush() === "ios-hors-app") return;
  await inscrireAppareil(userId);
}

export function onForegroundMessage(
  callback: (payload: { title: string; body: string }) => void
): () => void {
  const messaging = getClientMessaging();
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    const title = payload.notification?.title ?? "KoppaFoot";
    const body = payload.notification?.body ?? "";
    callback({ title, body });
  });
}
