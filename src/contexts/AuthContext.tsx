"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  linkWithCredential,
  EmailAuthProvider,
  PhoneAuthProvider,
  signOut,
  type User as FirebaseUser,
  type ConfirmationResult,
  type RecaptchaVerifier,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { buildFirestoreUser, firestoreToProfile, providersDepuisFirebase } from "@/lib/profil";
import type { UserProfile, UserRole, SignupData, FirestoreUser, AuthProvider } from "@/types";

// ============================================
// Types
// ============================================

interface AuthContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  // Email auth
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (data: SignupData) => Promise<void>;
  // Phone auth
  sendPhoneCode: (phone: string, recaptcha: RecaptchaVerifier) => Promise<ConfirmationResult>;
  confirmPhoneCode: (
    confirmation: ConfirmationResult,
    code: string,
    signupData?: SignupData
  ) => Promise<{ isNewUser: boolean }>;
  // Google auth
  loginWithGoogle: (signupData?: SignupData) => Promise<{ isNewUser: boolean }>;
  // Account linking
  linkEmail: (email: string, password: string) => Promise<void>;
  linkPhone: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  // Onboarding (Google/Phone users without profile)
  completeProfile: (data: SignupData) => Promise<void>;
  // Common
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  updateProfile: (data: Partial<FirestoreUser>) => Promise<void>;
  /**
   * Re-read the profile document into the context. For writes that happen
   * outside updateProfile(), le suivi d'une compétition, par exemple, qui
   * passe par arrayUnion, sans quoi le reste de l'app (l'étoile du sidebar)
   * garde l'ancienne liste jusqu'au prochain rechargement.
   */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================
// Helpers
// ============================================

async function createUserProfile(uid: string, data: SignupData, providers: AuthProvider[]) {
  const userData = buildFirestoreUser(data, providers);
  await setDoc(doc(db, "users", uid), {
    ...userData,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
}

async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return firestoreToProfile(uid, snap.data() as FirestoreUser);
}

// ============================================
// Provider
// ============================================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Consolidated Firebase auth observer
  useEffect(() => {
    console.log("[AuthContext] Setting up onIdTokenChanged observer");
    
    // onIdTokenChanged is more robust as it fires on login, logout, and token refresh
    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      console.log("[AuthContext] Auth state changed:", fbUser?.uid ?? "logged out");
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        setLoading(true);
        
        try {
          // 1. Sync session cookie for middleware
          let token: string;
          try {
            token = await fbUser.getIdToken();
          } catch (e: any) {
            // Handle network-request-failed with a single retry
            if (e.code === "auth/network-request-failed" || e.message === "auth/network-request-failed") {
              console.warn("[AuthContext] Network request failed for token, retrying once in 2s...");
              await new Promise(resolve => setTimeout(resolve, 2000));
              token = await fbUser.getIdToken();
            } else {
              throw e;
            }
          }

          document.cookie = `__session=${token}; path=/; max-age=3600; SameSite=Lax${
            window.location.protocol === "https:" ? "; Secure" : ""
          }`;

          // 2. Fetch user profile
          const profile = await fetchUserProfile(fbUser.uid);
          if (profile) {
            profile.emailVerified = fbUser.emailVerified;
          }
          setUser(profile);
        } catch (error: any) {
          if (error.code === "auth/network-request-failed") {
            console.error("[AuthContext] persistent network error while syncing session. User might be offline.");
          } else {
            console.error("[AuthContext] Error in auth session sync:", error);
          }
        }
      } else {
        // Clear session cookie and user profile on logout
        document.cookie = "__session=; path=/; max-age=0";
        setUser(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // --- Email Auth ---

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signupWithEmail = useCallback(async (data: SignupData) => {
    if (!data.email || !data.password) throw new Error("Email et mot de passe requis");
    const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
    await createUserProfile(cred.user.uid, data, ["email"]);
    await sendEmailVerification(cred.user);
  }, []);

  // --- Phone Auth ---

  const sendPhoneCode = useCallback(
    async (phone: string, recaptcha: RecaptchaVerifier): Promise<ConfirmationResult> => {
      return signInWithPhoneNumber(auth, phone, recaptcha);
    },
    []
  );

  const confirmPhoneCode = useCallback(
    async (confirmation: ConfirmationResult, code: string, signupData?: SignupData) => {
      const result = await confirmation.confirm(code);
      // Check if user profile already exists (returning user)
      const existing = await fetchUserProfile(result.user.uid);
      if (existing) return { isNewUser: false };

      // First sign-in on this number. With signupData we can create the
      // profile straight away; without it the caller must route to
      // /get-started, an authenticated user with no profile is a dead end.
      if (signupData) {
        await createUserProfile(result.user.uid, {
          ...signupData,
          phone: result.user.phoneNumber ?? signupData.phone,
        }, ["phone"]);
        return { isNewUser: false };
      }
      return { isNewUser: true };
    },
    []
  );

  // --- Google Auth ---

  const loginWithGoogle = useCallback(async (signupData?: SignupData) => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const existing = await fetchUserProfile(result.user.uid);
    if (existing) return { isNewUser: false };

    // New user via Google, needs profile creation
    if (signupData) {
      await createUserProfile(result.user.uid, {
        ...signupData,
        email: result.user.email ?? signupData.email,
      }, ["google"]);
    }
    return { isNewUser: !existing };
  }, []);

  // --- Account Linking ---

  const linkEmail = useCallback(async (email: string, password: string) => {
    if (!auth.currentUser) throw new Error("Non connecté");
    const credential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(auth.currentUser, credential);
    // Update Firestore
    const ref = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as FirestoreUser;
      const providers = [...new Set([...(data.auth_providers ?? []), "email" as AuthProvider])];
      await setDoc(ref, { email, auth_providers: providers, updated_at: serverTimestamp() }, { merge: true });
    }
    await sendEmailVerification(auth.currentUser);
  }, []);

  const linkPhone = useCallback(async (confirmation: ConfirmationResult, code: string) => {
    if (!auth.currentUser) throw new Error("Non connecté");
    const credential = PhoneAuthProvider.credential(confirmation.verificationId, code);
    await linkWithCredential(auth.currentUser, credential);
    const ref = doc(db, "users", auth.currentUser.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as FirestoreUser;
      const providers = [...new Set([...(data.auth_providers ?? []), "phone" as AuthProvider])];
      await setDoc(
        ref,
        { phone: auth.currentUser.phoneNumber, auth_providers: providers, updated_at: serverTimestamp() },
        { merge: true }
      );
    }
  }, []);

  // --- Onboarding (Google/Phone new users) ---

  const completeProfile = useCallback(async (data: SignupData) => {
    if (!auth.currentUser) throw new Error("Non connecté");
    // Derive providers from Firebase auth providerData (voir lib/profil)
    const providers = providersDepuisFirebase(
      auth.currentUser.providerData.map((p) => p.providerId),
    );

    await createUserProfile(auth.currentUser.uid, {
      ...data,
      email: data.email ?? auth.currentUser.email ?? undefined,
      phone: data.phone ?? auth.currentUser.phoneNumber ?? undefined,
    }, providers);

    // Refresh local state
    const profile = await fetchUserProfile(auth.currentUser.uid);
    if (profile) {
      profile.emailVerified = auth.currentUser.emailVerified;
    }
    setUser(profile);
  }, []);

  // --- Common ---

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const sendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Non connecté");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!auth.currentUser) return;
    const profile = await fetchUserProfile(auth.currentUser.uid);
    if (profile && firebaseUser) {
      profile.emailVerified = firebaseUser.emailVerified;
    }
    setUser(profile);
  }, [firebaseUser]);

  const updateProfileFn = useCallback(
    async (data: Partial<FirestoreUser>) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      // Strip undefined values, Firestore rejects them
      const cleaned = Object.fromEntries(
        Object.entries(data).filter(([, v]) => v !== undefined)
      );
      const ref = doc(db, "users", auth.currentUser.uid);
      await setDoc(ref, { ...cleaned, updated_at: serverTimestamp() }, { merge: true });
      // Refresh local state
      const profile = await fetchUserProfile(auth.currentUser.uid);
      if (profile && firebaseUser) {
        profile.emailVerified = firebaseUser.emailVerified;
      }
      setUser(profile);
    },
    [firebaseUser]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        loading,
        loginWithEmail,
        signupWithEmail,
        sendPhoneCode,
        confirmPhoneCode,
        loginWithGoogle,
        completeProfile,
        linkEmail,
        linkPhone,
        logout,
        resetPassword,
        sendVerificationEmail,
        updateProfile: updateProfileFn,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ============================================
// Hook
// ============================================

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
