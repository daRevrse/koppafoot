"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Loader2, Lock, Mail, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";

// ============================================
// AuthModal, signing in without leaving the page.
//
// Sending someone to /login threw away what they were doing: the match they
// were reading, the competition they were about to follow, the search they
// had typed. Now the page stays where it is and the sign-in comes to it.
//
// The ONE redirect kept is onboarding: a brand-new Google account has no
// Firestore profile yet, and /get-started is a form, not a dialog.
//
// Google first: one tap, no password to remember. Email and password come
// second, folded away behind one line, because every field shown up front is
// a reason to give up — but a folded field is not a missing one. Accounts
// created by /signup have a password and no Google identity, and this dialog
// is now the front door: offering them Google alone was offering them
// nothing. Phone sign-in still lives on /login only.
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

const inputClass =
  "w-full border border-gray-200/70 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";

function AuthDialog({ reason, onClose }: { reason?: string; onClose: () => void }) {
  const { loginWithGoogle, loginWithEmail } = useAuth();
  const router = useRouter();
  // Quelle voie est en cours, plutot qu'un simple booleen : les deux boutons
  // se desactivent ensemble, mais seul celui sur lequel on a clique tourne.
  const [enCours, setEnCours] = useState<"google" | "email" | null>(null);
  // Le formulaire email reste replie tant qu'on ne le demande pas : le
  // dialogue s'ouvre sur un seul bouton, comme avant.
  const [emailOuvert, setEmailOuvert] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setEnCours("email");
    try {
      await loginWithEmail(email.trim(), password);
      toast.success("Connexion réussie");
      onClose();
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setEnCours(null);
    }
  };

  const handleGoogle = async () => {
    setEnCours("google");
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
      setEnCours(null);
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
          disabled={enCours !== null}
          className="mt-8 flex w-full items-center justify-center gap-3 border border-gray-900 bg-gray-900 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-emerald-700 hover:border-emerald-700 disabled:opacity-50"
        >
          {enCours === "google" ? (
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

        {/* L'email, replie. Le lien tient sur une ligne, le formulaire
            prend sa place au clic : personne ne lit deux champs avant
            d'avoir decide de s'en servir. */}
        {!emailOuvert ? (
          <button
            type="button"
            onClick={() => setEmailOuvert(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 border border-gray-200/70 bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-gray-900 transition-colors hover:bg-gray-50"
          >
            <Mail size={18} />
            Continuer avec un email
          </button>
        ) : (
          <form onSubmit={handleEmail} className="mt-6 space-y-3">
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.com"
                aria-label="Email"
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                aria-label="Mot de passe"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-500"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={enCours !== null || !email.trim() || !password}
              className="flex w-full items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {enCours === "email" && <Loader2 size={16} className="animate-spin" />}
              Se connecter
            </button>
            {/* LES DEUX SORTIES SE FERMENT DERRIÈRE ELLES.
                Le fournisseur vit dans le layout racine : naviguer ne le
                démonte pas, et le dialogue restait posé par-dessus la page
                d'arrivée — on lisait « Mot de passe oublié » sous une modale
                qui redemandait de se connecter, sans savoir quoi fermer. Ces
                deux liens quittent le dialogue, ils le referment donc. */}
            <div className="text-right">
              <Link
                href="/forgot-password"
                onClick={onClose}
                className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700"
              >
                Mot de passe oublié ?
              </Link>
            </div>
          </form>
        )}

        <p className="mt-4 text-center text-xs text-gray-400">
          Pas encore de compte ?{" "}
          <Link href="/signup" onClick={onClose} className="font-bold text-emerald-600 transition-colors hover:text-emerald-700">
            Créer un compte
          </Link>{" "}
          — ou Google en crée un pour toi.
        </p>
      </div>
    </div>
  );
}
