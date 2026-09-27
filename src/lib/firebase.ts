import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, type Messaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (prevent duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

/**
 * LE CACHE DE FIRESTORE VIT SUR L'APPAREIL, et plus seulement en mémoire.
 *
 * C'est ce qui rend la console live sûre sur un terrain où le réseau va et
 * vient. Une saisie faite sans réseau part dans la file de Firestore ; en
 * mémoire, un rechargement de la page — ou un téléphone qui décharge l'onglet
 * — la perdait. Sur l'appareil, elle attend le retour du réseau, même
 * application fermée, et part au lancement suivant.
 *
 * Plusieurs onglets partagent le même cache (`persistentMultipleTabManager`).
 * Côté serveur, rien : le rendu serveur n'a ni appareil ni IndexedDB, et
 * `getFirestore` y rend l'instance ordinaire. Si le navigateur refuse le
 * stockage (navigation privée), Firestore retombe de lui-même sur la mémoire.
 * Un second appel (rechargement à chaud en développement) lève : l'instance
 * déjà créée sert.
 */
if (typeof window !== "undefined") {
  try {
    initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Déjà initialisée : voir plus haut.
  }
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

let _messaging: Messaging | null = null;
export function getClientMessaging(): Messaging | null {
  if (typeof window === "undefined") return null;
  try {
    if (!_messaging) _messaging = getMessaging(app);
    return _messaging;
  } catch {
    // Unsupported browser (no Push API / service workers).
    return null;
  }
}

export default app;
