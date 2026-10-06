"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Loader2, Lock, Mail, Eye, EyeOff, Phone } from "lucide-react";
import toast from "react-hot-toast";
import type { ConfirmationResult } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import MentionConditions from "@/components/auth/MentionConditions";
import FormulaireSms from "@/components/auth/FormulaireSms";
import { versGetStarted } from "@/lib/destination";
import { CONNEXION_SMS_OUVERTE } from "@/lib/phone";
import {
  BoutonGoogle, Separateur,
  classeBoutonAuth, classeBoutonAuthSecondaire, classeChampAuth, classeChampAuthMdp,
  classeIconeChamp, classePhraseAuth, classeTitreAuth,
} from "@/components/auth/auth-ui";

const T = textes(
  {
    connexionReussie: "Connexion réussie",
    dejaUnCompte: "Ce numéro a déjà un compte : te voilà connecté.",
    fermer: "Fermer",
    connexion: "Connexion",
    titreConnexion: "Connecte-toi",
    titreInscription: "Crée ton compte",
    raisonParDefaut: "Un compte suffit pour suivre tes compétitions, ton équipe et tes matchs.",
    continuerGoogle: "Continuer avec Google",
    continuerEmail: "Continuer avec un e-mail",
    continuerNumero: "Continuer avec mon numéro",
    placeholderEmail: "ton@email.com",
    email: "Email",
    motDePasse: "Mot de passe",
    masquerMdp: "Masquer le mot de passe",
    afficherMdp: "Afficher le mot de passe",
    seConnecter: "Se connecter",
    mdpOublie: "Mot de passe oublié ?",
    pasEncoreDeCompte: "Pas encore de compte ?",
    creerUnCompte: "Créer un compte",
    dejaInscrit: "Déjà un compte ?",
    seConnecterLien: "Se connecter",
  },
  {
    connexionReussie: "Signed in",
    dejaUnCompte: "This number already has an account: you're signed in.",
    fermer: "Close",
    connexion: "Sign in",
    titreConnexion: "Sign in",
    titreInscription: "Create your account",
    raisonParDefaut: "One account is all it takes to follow your competitions, your team and your matches.",
    continuerGoogle: "Continue with Google",
    continuerEmail: "Continue with email",
    continuerNumero: "Continue with my number",
    placeholderEmail: "you@email.com",
    email: "Email",
    motDePasse: "Password",
    masquerMdp: "Hide password",
    afficherMdp: "Show password",
    seConnecter: "Sign in",
    mdpOublie: "Forgot your password?",
    pasEncoreDeCompte: "No account yet?",
    creerUnCompte: "Create one",
    dejaInscrit: "Already have an account?",
    seConnecterLien: "Sign in",
  },
);

// ============================================
// AuthModal, signing in without leaving the page.
//
// Sending someone to /login threw away what they were doing: the match they
// were reading, the competition they were about to follow, the search they
// had typed. Now the page stays where it is and the sign-in comes to it.
//
// The ONE redirect kept is onboarding: a brand-new account has no Firestore
// profile yet, and /get-started is a form, not a dialog. It carries the page
// we were on (`?next=`) and comes back to it once the profile exists.
//
// LA MÊME LANGUE QUE LES PAGES. Cette fenêtre avait ses propres règles :
// Google en aplat noir (là où /login le dessine en contour pour laisser
// l'aplat au geste qui engage), titre en minuscules, champs à fond gris, et
// pas de téléphone. Ouverte depuis une candidature, c'était une troisième
// version de la connexion au moment le plus fragile du tunnel. Elle reprend
// maintenant components/auth/auth-ui et le parcours SMS partagé.
//
// DEUX MODES. « Créer mon compte » ouvrait une fenêtre titrée « Connecte-toi » :
// on croyait s'être trompé de bouton. Le mode `inscription` le dit, et le
// lien du bas bascule d'un mode à l'autre sans quitter la page.
//
// SUR TÉLÉPHONE, UNE FEUILLE qui part du bas, à portée de pouce, plutôt
// qu'une boîte centrée.
// ============================================

export type ModeAuth = "connexion" | "inscription";

interface AuthModalApi {
  /** Open the dialog. `reason` is shown under the title, if given. */
  open: (reason?: string, options?: { mode?: ModeAuth }) => void;
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
  const [state, setState] = useState<{ open: boolean; reason?: string; mode: ModeAuth }>({
    open: false, mode: "connexion",
  });

  const open = useCallback(
    (reason?: string, options?: { mode?: ModeAuth }) =>
      setState({ open: true, reason, mode: options?.mode ?? "connexion" }),
    [],
  );
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const api = useMemo<AuthModalApi>(
    () => ({ open, close, isOpen: state.open }),
    [open, close, state.open],
  );

  return (
    <AuthModalContext.Provider value={api}>
      {children}
      {state.open && <AuthDialog reason={state.reason} modeInitial={state.mode} onClose={close} />}
    </AuthModalContext.Provider>
  );
}

/** La page où l'on est : c'est là qu'on revient, au bout de /get-started s'il le faut. */
function pageCourante(): string {
  return window.location.pathname + window.location.search;
}

function AuthDialog({
  reason, modeInitial, onClose,
}: {
  reason?: string;
  modeInitial: ModeAuth;
  onClose: () => void;
}) {
  const { loginWithGoogle, loginWithEmail, confirmPhoneCode } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<ModeAuth>(modeInitial);
  // Quelle voie est en cours, plutot qu'un simple booleen : les boutons se
  // desactivent ensemble, mais seul celui sur lequel on a clique tourne.
  const [enCours, setEnCours] = useState<"google" | "email" | null>(null);
  // Les voies autres que Google restent repliees tant qu'on ne les demande
  // pas : la fenêtre s'ouvre sur un seul geste.
  const [voie, setVoie] = useState<"email" | "phone" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { langue } = useLangue();
  const t = useTextes(T);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nouveauCompte = () => {
    // The one allowed redirect: there is no profile to come back to yet.
    onClose();
    router.push(versGetStarted({ next: pageCourante() }));
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setEnCours("email");
    try {
      await loginWithEmail(email.trim(), password);
      toast.success(t.connexionReussie);
      onClose();
    } catch (err) {
      toast.error(getAuthErrorMessage(err, langue));
    } finally {
      setEnCours(null);
    }
  };

  const handleGoogle = async () => {
    setEnCours("google");
    try {
      const { isNewUser } = await loginWithGoogle();
      if (isNewUser) {
        nouveauCompte();
        return;
      }
      toast.success(t.connexionReussie);
      onClose();
    } catch (err) {
      toast.error(getAuthErrorMessage(err, langue));
    } finally {
      setEnCours(null);
    }
  };

  // Les erreurs remontent à FormulaireSms, qui les affiche.
  const handleCode = async (confirmation: ConfirmationResult, code: string) => {
    const { isNewUser } = await confirmPhoneCode(confirmation, code);
    if (isNewUser) {
      nouveauCompte();
      return;
    }
    toast.success(mode === "inscription" ? t.dejaUnCompte : t.connexionReussie);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t.fermer}
        onClick={onClose}
        className="apparition-voile absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === "inscription" ? t.titreInscription : t.connexion}
        className="apparition-fenetre relative max-h-[92dvh] w-full overflow-y-auto border-t border-gray-200/70 bg-white px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:max-w-md sm:border sm:p-10"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.fermer}
          className="absolute right-5 top-5 text-gray-300 transition-colors hover:text-gray-900"
        >
          <X size={22} />
        </button>

        <h2 className={`${classeTitreAuth} pr-8`}>
          {mode === "inscription" ? t.titreInscription : t.titreConnexion}
        </h2>
        <p className={classePhraseAuth}>{reason ?? t.raisonParDefaut}</p>

        <div className="mt-8">
          <BoutonGoogle onClick={handleGoogle} disabled={enCours !== null} enCours={enCours === "google"}>
            {t.continuerGoogle}
          </BoutonGoogle>
        </div>

        <Separateur />

        {voie === null && (
          <div className="space-y-3">
            {/* S'inscrire par e-mail demande un nom et un mot de passe à
                choisir : c'est le formulaire de /signup, qui ramène ici. Se
                connecter par e-mail se fait sur place. */}
            {mode === "inscription" ? (
              <Link
                href={`/signup?next=${encodeURIComponent(pageCourante())}`}
                onClick={onClose}
                className={`${classeBoutonAuthSecondaire} w-full`}
              >
                <Mail size={16} />
                {t.continuerEmail}
              </Link>
            ) : (
              <button type="button" onClick={() => setVoie("email")} className={`${classeBoutonAuthSecondaire} w-full`}>
                <Mail size={16} />
                {t.continuerEmail}
              </button>
            )}
            {CONNEXION_SMS_OUVERTE && (
              <button type="button" onClick={() => setVoie("phone")} className={`${classeBoutonAuthSecondaire} w-full`}>
                <Phone size={16} />
                {t.continuerNumero}
              </button>
            )}
          </div>
        )}

        {voie === "email" && (
          <form onSubmit={handleEmail} className="space-y-3">
            <div className="relative">
              <Mail size={15} className={classeIconeChamp} />
              <input
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.placeholderEmail}
                aria-label={t.email}
                className={classeChampAuth}
              />
            </div>
            <div className="relative">
              <Lock size={15} className={classeIconeChamp} />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.motDePasse}
                aria-label={t.motDePasse}
                className={classeChampAuthMdp}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t.masquerMdp : t.afficherMdp}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-900"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={enCours !== null || !email.trim() || !password}
              className={classeBoutonAuth}
            >
              {enCours === "email" && <Loader2 size={16} className="animate-spin" />}
              {t.seConnecter}
            </button>
            {/* LES SORTIES SE FERMENT DERRIÈRE ELLES.
                Le fournisseur vit dans le layout racine : naviguer ne le
                démonte pas, et le dialogue restait posé par-dessus la page
                d'arrivée. Ce lien quitte le dialogue, il le referme donc. */}
            <div className="text-right">
              <Link
                href="/forgot-password"
                onClick={onClose}
                className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
              >
                {t.mdpOublie}
              </Link>
            </div>
          </form>
        )}

        {voie === "phone" && <FormulaireSms onConfirmer={handleCode} occupe={enCours !== null} />}

        <p className="mt-6 text-center text-sm text-gray-500">
          {mode === "inscription" ? t.dejaInscrit : t.pasEncoreDeCompte}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "inscription" ? "connexion" : "inscription");
              setVoie(null);
            }}
            className="font-black text-gray-900 underline underline-offset-4 transition-colors hover:text-emerald-700"
          >
            {mode === "inscription" ? t.seConnecterLien : t.creerUnCompte}
          </button>
        </p>
        <MentionConditions onNavigate={onClose} className="mt-4 text-center" />
      </div>
    </div>
  );
}
