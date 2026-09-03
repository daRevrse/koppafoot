"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Mail, Phone, Loader2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { createRecaptchaVerifier } from "@/lib/recaptcha";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import {
  COUNTRY_CODES,
  DEFAULT_DIAL_CODE,
  RESEND_COOLDOWN_S,
  normalizeNational,
  toE164 as joinE164,
} from "@/lib/phone";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";

// ============================================
// Schemas
// ============================================

const emailSchema = yup.object({
  email: yup.string().email("Email invalide").required("Email requis"),
  password: yup.string().required("Mot de passe requis"),
});

// The national part only, the country code comes from the picker and the
// two are joined into E.164 before hitting Firebase. Users type their number
// the way they say it ("90 12 34 56"), spaces and leading 0 included.
const phoneSchema = yup.object({
  phone: yup
    .string()
    .transform((v: string) => normalizeNational(v))
    .matches(/^\d{6,14}$/, "Numéro invalide")
    .required("Numéro requis"),
});

const codeSchema = yup.object({
  code: yup
    .string()
    .matches(/^\d{6}$/, "Code à 6 chiffres")
    .required("Code requis"),
});

type EmailForm = yup.InferType<typeof emailSchema>;
type PhoneForm = yup.InferType<typeof phoneSchema>;
type CodeForm = yup.InferType<typeof codeSchema>;

// ============================================
// Shared styles
// ============================================

const inputClass =
  "w-full border border-gray-200/70 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";
const inputClassPassword =
  "w-full border border-gray-200/70 bg-gray-50 py-3 pl-11 pr-11 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";

// ============================================
// Tabs
// ============================================

type Tab = "email" | "phone";

/**
 * Connexion par SMS masquée, temporairement.
 *
 * L'envoi de SMS réels est toujours refusé côté Firebase, donc l'onglet ne
 * menait qu'à une erreur. Tout le circuit (schéma, formulaires, reCAPTCHA,
 * renvoi du code) est conservé et reste compilé : repasser à `true` suffit à
 * le remettre en ligne le jour où les SMS partent.
 *
 * L'inscription n'est pas concernée : elle n'a jamais proposé le téléphone
 * comme moyen d'authentification, seulement comme champ de profil facultatif.
 */
const PHONE_LOGIN_ENABLED = false;

/**
 * L'EMAIL + MOT DE PASSE EST DE RETOUR, à côté de Google.
 *
 * Il avait été masqué au profit de Google seul : un tap, aucun mot de passe à
 * retrouver. Mais l'inscription, elle, n'a jamais cessé de créer des comptes
 * par email (voir /signup) — et ces comptes-là n'avaient plus de porte. Un
 * mot de passe se saisit aussi là où le compte Google n'existe pas : un
 * téléphone partagé, un navigateur où personne n'est connecté.
 *
 * Google reste en tête : c'est le chemin le plus court, pas le seul.
 */
const EMAIL_LOGIN_ENABLED = true;

/**
 * De quelle fonction vient-on, et que lui promet-on.
 *
 * Une même page de connexion, un en-tête qui change : arriver ici depuis
 * « référencer mon terrain » et lire « Connecte-toi pour accéder à ton
 * espace » fait douter d'avoir cliqué au bon endroit. Le `?for=` porte cette
 * provenance, le `?next=` ramène au bon endroit après coup.
 */
const CONTEXTES: Record<string, { titre: string; phrase: string }> = {
  organisateur: {
    titre: "Organiser une compétition",
    phrase: "Un compte d'abord, ta candidature d'organisateur se dépose ensuite.",
  },
  terrain: {
    titre: "Référencer un terrain",
    phrase: "Un compte d'abord, la fiche de ton terrain se saisit ensuite.",
  },
};

const CONTEXTE_DEFAUT = {
  titre: "Connexion",
  phrase: "Connecte-toi pour accéder à ton espace",
};

export default function LoginPage() {
  const searchParams = useSearchParams();
  const contexte = CONTEXTES[searchParams.get("for") ?? ""] ?? CONTEXTE_DEFAUT;
  const [tab, setTab] = useState<Tab>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"number" | "code">("number");
  const [dialCode, setDialCode] = useState<string>(DEFAULT_DIAL_CODE);
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const router = useRouter();
  const { loginWithEmail, sendPhoneCode, confirmPhoneCode, loginWithGoogle } = useAuth();

  // Fresh verifier AND fresh container on every attempt, see lib/recaptcha.
  const buildRecaptcha = (): RecaptchaVerifier => {
    if (!recaptchaRef.current) throw new Error("reCAPTCHA indisponible");
    const verifier = createRecaptchaVerifier(recaptchaRef.current, recaptchaVerifier.current);
    recaptchaVerifier.current = verifier;
    return verifier;
  };

  // The verifier is built on demand by requestCode (Firebase consumes it on
  // every attempt), so here we only tear it down, on unmount and whenever
  // the user leaves the phone tab.
  useEffect(() => {
    return () => {
      recaptchaVerifier.current?.clear();
      recaptchaVerifier.current = null;
    };
  }, [tab]);

  // Resend countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // --- Email form ---

  const emailForm = useForm<EmailForm>({
    resolver: yupResolver(emailSchema),
  });

  const handleEmailLogin = async (data: EmailForm) => {
    setSubmitting(true);
    try {
      await loginWithEmail(data.email, data.password);
      toast.success("Connexion réussie");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Phone form ---

  const phoneForm = useForm<PhoneForm>({
    resolver: yupResolver(phoneSchema),
  });

  const codeForm = useForm<CodeForm>({
    resolver: yupResolver(codeSchema),
  });

  // Sends (or resends) the SMS. Firebase consumes the verifier on every
  // attempt, successful or not, so a fresh one is built each time.
  const requestCode = async (e164: string) => {
    const result = await sendPhoneCode(e164, buildRecaptcha());
    setConfirmation(result);
    setSentTo(e164);
    setCooldown(RESEND_COOLDOWN_S);
  };

  const handleSendCode = async (data: PhoneForm) => {
    setSubmitting(true);
    try {
      await requestCode(joinE164(dialCode, data.phone));
      setPhoneStep("code");
      codeForm.reset();
      toast.success("Code envoyé !");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || !sentTo) return;
    setSubmitting(true);
    try {
      await requestCode(sentTo);
      codeForm.reset();
      toast.success("Nouveau code envoyé !");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeNumber = () => {
    setPhoneStep("number");
    setConfirmation(null);
    setSentTo("");
    setCooldown(0);
    codeForm.reset();
    // No need to rebuild the verifier here: requestCode builds a fresh one
    // (and a fresh container) on every send.
  };

  const handleConfirmCode = async (data: CodeForm) => {
    setSubmitting(true);
    try {
      if (!confirmation) throw new Error("Pas de confirmation en cours");
      const { isNewUser } = await confirmPhoneCode(confirmation, data.code);
      if (isNewUser) {
        // Authenticated but no Firestore profile yet, same path as Google.
        router.push("/get-started");
        return;
      }
      toast.success("Connexion réussie");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  // --- Google ---

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const { isNewUser } = await loginWithGoogle();
      if (isNewUser) {
        router.push("/get-started");
        return;
      }
      toast.success("Connexion réussie");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <h2 className="mb-1 font-display text-2xl font-black uppercase tracking-tight text-gray-900">
        {contexte.titre}
      </h2>
      <p className="mb-6 text-sm text-gray-400">{contexte.phrase}</p>

      {/* Google en tête : c'est le chemin le plus court (un tap, pas de mot de
          passe à retrouver), donc il passe avant le formulaire email. */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-3 border border-gray-200/70 bg-white px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continuer avec Google
      </button>

      {EMAIL_LOGIN_ENABLED && (
      <>
      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-100" />
        <span className="text-[10px] text-gray-300 uppercase tracking-wider">ou</span>
        <div className="h-px flex-1 bg-gray-100" />
      </div>

      {/* Tabs, un seul onglet ne se dessine pas : sans le téléphone, le
          formulaire email prend toute la place. */}
      {PHONE_LOGIN_ENABLED && (
      <div className="mb-6 flex bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => { setTab("email"); setPhoneStep("number"); }}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
            tab === "email"
              ? "bg-white text-emerald-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Mail size={14} /> Email
        </button>
        <button
          type="button"
          onClick={() => setTab("phone")}
          className={`flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all ${
            tab === "phone"
              ? "bg-white text-emerald-600"
              : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Phone size={14} /> Téléphone
        </button>
      </div>
      )}

      <AnimatePresence mode="wait">
        {/* Email Tab */}
        {tab === "email" && (
          <motion.form
            key="email"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={emailForm.handleSubmit(handleEmailLogin)}
            className="space-y-4"
          >
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-gray-600">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...emailForm.register("email")}
                  className={inputClass}
                  placeholder="votre@email.com"
                />
              </div>
              {emailForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-400">{emailForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-gray-600">Mot de passe</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...emailForm.register("password")}
                  className={inputClassPassword}
                  placeholder="Mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {emailForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-400">{emailForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Se connecter
            </button>
          </motion.form>
        )}

        {/* Phone Tab */}
        {PHONE_LOGIN_ENABLED && tab === "phone" && phoneStep === "number" && (
          <motion.form
            key="phone"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={phoneForm.handleSubmit(handleSendCode)}
            className="space-y-4"
          >
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-xs font-bold text-gray-600">Numéro de téléphone</label>
              <div className="flex gap-2">
                <select
                  aria-label="Indicatif pays"
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                  className="w-[7.5rem] shrink-0 border border-gray-200/70 bg-gray-50 py-3 pl-3 pr-2 text-sm font-semibold text-gray-900 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label.slice(0, 2)} {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="tel"
                    {...phoneForm.register("phone")}
                    className={inputClass}
                    placeholder="90 12 34 56"
                  />
                </div>
              </div>
              {phoneForm.formState.errors.phone && (
                <p className="mt-1 text-xs text-red-400">{phoneForm.formState.errors.phone.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Envoyer le code
            </button>
          </motion.form>
        )}

        {PHONE_LOGIN_ENABLED && tab === "phone" && phoneStep === "code" && (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={codeForm.handleSubmit(handleConfirmCode)}
            className="space-y-4"
          >
            <p className="text-sm text-gray-500">
              Un code à 6 chiffres a été envoyé au{" "}
              <span className="font-semibold text-gray-700">{sentTo}</span>.
            </p>
            <div>
              <label htmlFor="code" className="mb-1.5 block text-xs font-bold text-gray-600">Code de vérification</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                {...codeForm.register("code")}
                className="w-full border border-gray-200/70 bg-gray-50 px-4 py-3 text-center text-lg tracking-[0.3em] text-gray-900 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all placeholder:text-gray-300"
                placeholder="000000"
              />
              {codeForm.formState.errors.code && (
                <p className="mt-1 text-xs text-red-400">{codeForm.formState.errors.code.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Vérifier
            </button>

            <div className="flex items-center justify-between gap-3 text-xs font-semibold">
              <button
                type="button"
                onClick={handleChangeNumber}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                Changer de numéro
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || submitting}
                className="text-emerald-600 hover:text-emerald-700 disabled:text-gray-300 disabled:hover:text-gray-300 transition-colors"
              >
                {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : "Renvoyer le code"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
      </>
      )}

      {/* Links */}
      <div className="mt-8 space-y-2 text-center text-sm">
        <p className="text-gray-400">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
            Créer un compte
          </Link>
        </p>
      </div>

      <PWAInstallPrompt />

      {/* reCAPTCHA container, seul le SMS s'en sert */}
      {PHONE_LOGIN_ENABLED && <div ref={recaptchaRef} />}
    </motion.div>
  );
}
