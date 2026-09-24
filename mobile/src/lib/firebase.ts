import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  // @ts-expect-error Exporté par la version React Native de @firebase/auth, que Metro
  // choisit à l'exécution ; absent des types publics. Si Firebase l'y ajoute un jour,
  // cette ligne cessera de compiler : retirer alors le commentaire.
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Le projet Firebase du site. Les EXPO_PUBLIC_* sont inlinés au build : ils
// doivent être lus un par un, en toutes lettres.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const premiere = getApps().length === 0;
export const app = premiere ? initializeApp(firebaseConfig) : getApp();

/**
 * LA SESSION DOIT SURVIVRE AU REDÉMARRAGE. `getAuth()` seul ne persiste rien
 * en React Native : l'utilisateur serait déconnecté à chaque lancement, et le
 * symptôme ressemble à un bug de règles.
 *
 * `initializeAuth` ne s'appelle qu'une fois par app : au rechargement à chaud
 * le module est réévalué, et un second appel lèverait auth/already-initialized.
 */
export const auth: Auth = premiere
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
