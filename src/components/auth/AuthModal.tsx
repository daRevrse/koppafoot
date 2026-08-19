"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useRouter } from "next/navigation";
import { X, Loader2, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";

// ============================================
// AuthModal — signing in without leaving the page.
//
// Sending someone to /login threw away what they were doing: the match they
// were reading, the competition they were about to follow, the search they
// had typed. Now the page stays where it is and the sign-in comes to it.
//
// The ONE redirect kept is onboarding: a brand-new Google account has no
// Firestore profile yet, and /get-started is a form, not a dialog.
//
// Only Google is offered here. Email/password and phone still exist on
// /login — this dialog is deliberately one button, because every extra field
// is a reason to give up.
// ============================================

interface AuthModalApi {
  /** Open the dialog. `reason` is shown above the button, if given. */
  open: (reason?: string) => void;
  close: () => void;
  isOpen: boolean;
}

const AuthModalContext = createContext<AuthModalApi | null>(null);

/** Anywhere that used to push("/login") calls `open()` instead. */
export function useAuthModal(): AuthModalApi {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used inside <AuthModalProvider>");
  return ctx;
}

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  // The dialog closes itself the moment the sign-in resolves (see
  // AuthDialog), so there is nothing to watch for here.
  const [state, setState] = useState<{ open: boolean; reason?: string }>({ open: false });

  const open = useCallback((reason?: string) => setState({ open: true, reason }), []);
  const close = useCallback(() => setState({ open: false }), []);

  const api = useMemo<AuthModalApi>(
    () => ({ open, close, isOpen: state.open }),
    [open, close, state.open],
  );

  return (
    <AuthModalContext.Provider value={api}>
      {children}
      {state.open && <AuthDialog reason={state.reason} onClose={close} />}
    </AuthModalContext.Provider>
  );
}

function AuthDialog({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const { loginWithGoogle } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const { isNewUser } = await loginWithGoogle();
      if (isNewUser) {
        // The one allowed redirect: there is no profile to come back to yet.
        onClose();
        router.push("/get-started");
        return;
      }
      toast.success("Connexion réussie");
      onClose();
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Connexion"
        className="relative w-full max-w-md overflow-hidden border border-gray-200/70 bg-white p-8 sm:p-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-5 top-5 text-gray-300 transition-colors hover:text-gray-900"
        >
          <X size={22} />
        </button>

        <Lock size={34} strokeWidth={1.2} className="text-gray-900" />

        <h2 className="mt-7 font-display text-3xl font-black leading-tight tracking-tight text-gray-900">
          Connecte-toi
        </h2>
        <p className="mt-3 text-base leading-relaxed text-gray-500">
          {reason ?? "Un compte suffit pour suivre tes compétitions, ton équipe et tes matchs."}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={submitting}
          className="mt-8 flex w-full items-center justify-center gap-3 border border-gray-900 bg-gray-900 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 size={18} className="animate-spin text-white" />
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          Continuer avec Google
        </button>

        <p className="mt-4 text-center text-xs text-gray-400">
          Pas encore de compte ? Google en crée un pour toi.
        </p>
      </div>
    </div>
  );
}
