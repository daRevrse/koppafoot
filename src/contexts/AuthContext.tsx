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
  // Onboarding (Google/Phone users without profile)
  completeProfile: (data: SignupData) => Promise<void>;
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
    bio: data.bio ?? null,
    profilePictureUrl: data.profile_picture_url,
    coverPhotoUrl: data.cover_photo_url,
    companyName: data.company_name ?? null,
    isActive: data.is_active,
    emailVerified: false, // overwritten by Firebase auth state
    authProviders: data.auth_providers ?? [],
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    // Role-specific optional fields
    ...(data.position !== undefined && { position: data.position }),
    ...(data.skill_level !== undefined && { skillLevel: data.skill_level }),
    ...(data.team_name !== undefined && { teamName: data.team_name }),
    ...(data.license_number !== undefined && { licenseNumber: data.license_number }),
    ...(data.license_level !== undefined && { licenseLevel: data.license_level }),
    ...(data.experience_years !== undefined && { experienceYears: data.experience_years }),
    // Physical info
    ...(data.strong_foot !== undefined && { strongFoot: data.strong_foot }),
    ...(data.height !== undefined && { height: data.height }),
    ...(data.weight !== undefined && { weight: data.weight }),
    ...(data.date_of_birth !== undefined && { dateOfBirth: data.date_of_birth }),
    // Social
    followersCount: data.followers_count ?? 0,
    followingCount: data.following_count ?? 0,
    // Gallery
    galleryPhotos: data.gallery_photos ?? [],
    // Trophies
    trophies: data.trophies ?? [],
  };
}

function buildFirestoreUser(
  data: SignupData,
  providers: AuthProvider[],
): Omit<FirestoreUser, "created_at" | "updated_at"> {
  // Build base object — never pass undefined to Firestore
  const base: Omit<FirestoreUser, "created_at" | "updated_at"> = {
    email: data.email ?? null,
    phone: data.phone ?? null,
    first_name: data.firstName,
    last_name: data.lastName,
    user_type: data.userType,
    location_city: data.locationCity ?? "",
    profile_picture_url: null,
    cover_photo_url: null,
    is_active: true,
    auth_providers: providers,
  };

  if (data.bio) base.bio = data.bio;

  if (data.userType === "player") {
    if (data.position) base.position = data.position;
    if (data.skillLevel) base.skill_level = data.skillLevel;
  }
  if (data.userType === "manager") {
    if (data.teamName) base.team_name = data.teamName;
  }
  if (data.userType === "referee") {
    if (data.licenseNumber) base.license_number = data.licenseNumber;
    if (data.licenseLevel) base.license_level = data.licenseLevel;
    if (data.experienceYears != null) base.experience_years = data.experienceYears;
  }

  return base;
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

  // --- Onboarding (Google/Phone new users) ---

  const completeProfile = useCallback(async (data: SignupData) => {
    if (!auth.currentUser) throw new Error("Non connecté");
    // Derive providers from Firebase auth providerData
    const providerMap: Record<string, AuthProvider> = {
      "google.com": "google",
      "phone": "phone",
      "password": "email",
    };
    const providers: AuthProvider[] = auth.currentUser.providerData
      .map((p) => providerMap[p.providerId])
      .filter((p): p is AuthProvider => !!p);
    if (providers.length === 0) providers.push("email");

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

  const updateProfileFn = useCallback(
    async (data: Partial<FirestoreUser>) => {
      if (!auth.currentUser) throw new Error("Non connecté");
      // Strip undefined values — Firestore rejects them
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
