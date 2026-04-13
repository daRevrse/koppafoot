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
import { syncSessionCookie } from "@/lib/session";
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
  ) => Promise<void>;
  // Google auth
  loginWithGoogle: (signupData?: SignupData) => Promise<{ isNewUser: boolean }>;
  // Account linking
  linkEmail: (email: string, password: string) => Promise<void>;
  linkPhone: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  // Common
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  updateProfile: (data: Partial<FirestoreUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ============================================
// Helpers
// ============================================

function firestoreToProfile(uid: string, data: FirestoreUser): UserProfile {
  return {
    uid,
    email: data.email,
    phone: data.phone,
    firstName: data.first_name,
    lastName: data.last_name,
    userType: data.user_type,
    locationCity: data.location_city,
    profilePictureUrl: data.profile_picture_url,
    coverPhotoUrl: data.cover_photo_url,
    isActive: data.is_active,
    emailVerified: false, // overwritten by Firebase auth state
    authProviders: data.auth_providers ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

function buildFirestoreUser(
  data: SignupData,
  providers: AuthProvider[],
): Omit<FirestoreUser, "created_at" | "updated_at"> {
  return {
    email: data.email ?? null,
    phone: data.phone ?? null,
    first_name: data.firstName,
    last_name: data.lastName,
    user_type: data.userType,
    location_city: data.locationCity,
    profile_picture_url: null,
    cover_photo_url: null,
    is_active: true,
    auth_providers: providers,
    ...(data.userType === "player" && {
      position: data.position,
      skill_level: data.skillLevel,
    }),
    ...(data.userType === "manager" && {
      team_name: data.teamName,
    }),
    ...(data.userType === "referee" && {
      license_number: data.licenseNumber,
      license_level: data.licenseLevel,
      experience_years: data.experienceYears,
    }),
  };
}

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

  // Sync session cookie for proxy (middleware)
  useEffect(() => {
    const unsubscribe = syncSessionCookie();
    return unsubscribe;
  }, []);

  // Sync Firebase auth state → user profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const profile = await fetchUserProfile(fbUser.uid);
        if (profile) {
          profile.emailVerified = fbUser.emailVerified;
        }
        setUser(profile);
      } else {
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
      if (!existing && signupData) {
        await createUserProfile(result.user.uid, {
          ...signupData,
          phone: result.user.phoneNumber ?? signupData.phone,
        }, ["phone"]);
      }
    },
    []
  );

  // --- Google Auth ---

  const loginWithGoogle = useCallback(async (signupData?: SignupData) => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const existing = await fetchUserProfile(result.user.uid);
    if (existing) return { isNewUser: false };

    // New user via Google — needs profile creation
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

  const updateProfileFn = useCallback(
    async (data: Partial<FirestoreUser>) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      const ref = doc(db, "users", auth.currentUser.uid);
      await setDoc(ref, { ...data, updated_at: serverTimestamp() }, { merge: true });
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
        linkEmail,
        linkPhone,
        logout,
        resetPassword,
        sendVerificationEmail,
        updateProfile: updateProfileFn,
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
