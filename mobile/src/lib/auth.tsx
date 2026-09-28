import {
  createUserWithEmailAndPassword, GoogleAuthProvider, onAuthStateChanged, sendEmailVerification,
  sendPasswordResetEmail, signInWithCredential, signInWithEmailAndPassword, signOut, type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert } from "react-native";
import { MESSAGE_COMPTE_SUSPENDU } from "@/lib/auth-errors";
import { buildFirestoreUser, firestoreToProfile, providersDepuisFirebase } from "@/lib/profil";
import type { FirestoreUser, SignupData, UserProfile } from "@/types";
import { suivreCompetition } from "~/lib/direct-firestore";
import { auth, db } from "~/lib/firebase";
import { moduleGoogle } from "~/lib/google";
import { appliquerSuiviEnAttente } from "~/lib/suivi-en-attente";

export interface ChampsProfil {
  firstName: string;
  lastName: string;
  locationCity: string;
}

interface Etat {
  /** L'état initial n'est pas encore connu : on garde l'écran de lancement. */
  chargement: boolean;
  utilisateur: User | null;
  profil: UserProfile | null;
  /** Connecté, et le document users/{uid} n'existe pas : écran profil obligatoire. */
  profilManquant: boolean;
}

interface EtatAuth extends Etat {
  connexionEmail: (email: string, motDePasse: string) => Promise<void>;
  /** Rend faux si l'utilisateur a refermé le sélecteur de compte. */
  connexionGoogle: () => Promise<boolean>;
  inscriptionEmail: (email: string, motDePasse: string) => Promise<void>;
  motDePasseOublie: (email: string) => Promise<void>;
  completerProfil: (champs: ChampsProfil) => Promise<void>;
  rafraichirProfil: () => Promise<void>;
  deconnexion: () => Promise<void>;
}

const Contexte = createContext<EtatAuth | null>(null);

async function lireProfil(u: User): Promise<{ profil: UserProfile | null; manquant: boolean }> {
  const snap = await getDoc(doc(db, "users", u.uid));
  if (!snap.exists()) return { profil: null, manquant: true };
  const profil = firestoreToProfile(u.uid, snap.data() as FirestoreUser);
  profil.emailVerified = u.emailVerified;
  return { profil, manquant: false };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<Etat>({ chargement: true, utilisateur: null, profil: null, profilManquant: false });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setEtat({ chargement: false, utilisateur: null, profil: null, profilManquant: false });
          return;
        }
        // UN SEUL setState, après la lecture du profil : poser l'utilisateur
        // d'abord ferait passer les gardes par « connecté avec profil » le
        // temps d'une lecture, et les onglets clignoteraient avant l'écran profil.
        try {
          const { profil, manquant } = await lireProfil(u);
          setEtat({ chargement: false, utilisateur: u, profil, profilManquant: manquant });
        } catch {
          // Profil illisible (réseau) : connecté, sans profil connu. Surtout ne
          // pas conclure qu'il manque — l'écran profil écraserait un compte existant.
          setEtat({ chargement: false, utilisateur: u, profil: null, profilManquant: false });
        }
      }),
    [],
  );

  const rafraichirProfil = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return;
    const { profil, manquant } = await lireProfil(u);
    setEtat((e) => ({ ...e, utilisateur: u, profil, profilManquant: manquant }));
  }, []);

  // Un compte suspendu sort aussitôt, comme sur le site : la suspension le
  // désactive dans Firebase Auth, mais le jeton déjà délivré vaut encore
  // jusqu'à une heure. On écoute `is_active` sur le compte ouvert.
  const connecte = etat.utilisateur?.uid;
  useEffect(() => {
    if (!connecte) return;
    let sorti = false;
    return onSnapshot(
      doc(db, "users", connecte),
      (snap) => {
        // Seul le serveur fait foi : un cache garderait l'ancien `false` d'un compte réactivé.
        if (sorti || snap.metadata.fromCache || snap.data()?.is_active !== false) return;
        sorti = true;
        Alert.alert("Compte suspendu", MESSAGE_COMPTE_SUSPENDU);
        moduleGoogle()?.GoogleSignin.signOut().catch(() => {});
        signOut(auth).catch(() => {});
      },
      () => {},
    );
  }, [connecte]);

  // L'étoile touchée sans compte : suivie dès que le profil existe.
  const uid = etat.profil?.uid;
  useEffect(() => {
    if (!uid) return;
    appliquerSuiviEnAttente(uid, suivreCompetition)
      .then((fait) => (fait ? rafraichirProfil() : undefined))
      .catch((e) => console.warn("[auth] suivi en attente", e));
  }, [uid, rafraichirProfil]);

  const connexionEmail = useCallback(async (email: string, motDePasse: string) => {
    await signInWithEmailAndPassword(auth, email, motDePasse);
  }, []);

  /**
   * `signInWithPopup` n'existe pas en natif : la bibliothèque obtient le jeton
   * Google, Firebase le reçoit en `signInWithCredential`. Un compte Google
   * déjà créé sur le site retrouve son profil ; un nouveau tombe sur l'écran
   * profil, comme par e-mail.
   */
  const connexionGoogle = useCallback(async (): Promise<boolean> => {
    const google = moduleGoogle();
    if (!google) throw new Error("Connexion Google indisponible");
    await google.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const reponse = await google.GoogleSignin.signIn();
    if (!google.isSuccessResponse(reponse)) return false;
    const { idToken } = reponse.data;
    if (!idToken) throw new Error("Jeton Google absent");
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    return true;
  }, []);

  const inscriptionEmail = useCallback(async (email: string, motDePasse: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, motDePasse);
    // Comme sur le site : l'e-mail de vérification part, sans bloquer l'accès.
    sendEmailVerification(cred.user).catch(() => {});
  }, []);

  const motDePasseOublie = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const completerProfil = useCallback(
    async (champs: ChampsProfil) => {
      const u = auth.currentUser;
      if (!u) throw new Error("Non connecté");
      // Spectateur par défaut, comme /get-started : on n'est joueur que si on
      // l'a choisi, et ce choix-là vit sur le site.
      const data: SignupData = { ...champs, userType: "user", email: u.email ?? undefined };
      const providers = providersDepuisFirebase(u.providerData.map((p) => p.providerId));
      await setDoc(doc(db, "users", u.uid), {
        ...buildFirestoreUser(data, providers),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
      await rafraichirProfil();
    },
    [rafraichirProfil],
  );

  const deconnexion = useCallback(async () => {
    // Sans ça, le compte Google resterait choisi d'office à la connexion suivante.
    await moduleGoogle()?.GoogleSignin.signOut().catch(() => {});
    await signOut(auth);
  }, []);

  const valeur = useMemo<EtatAuth>(
    () => ({
      ...etat, connexionEmail, connexionGoogle, inscriptionEmail, motDePasseOublie, completerProfil,
      rafraichirProfil, deconnexion,
    }),
    [etat, connexionEmail, connexionGoogle, inscriptionEmail, motDePasseOublie, completerProfil, rafraichirProfil, deconnexion],
  );
  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useAuth(): EtatAuth {
  const etat = useContext(Contexte);
  if (!etat) throw new Error("useAuth hors d'AuthProvider");
  return etat;
}
