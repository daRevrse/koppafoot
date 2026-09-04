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
import { contexteAuth, lienAuth } from "@/config/auth-contextes";
import {
  EnTeteAuth, Separateur, BoutonGoogle,
  classeChampAuth, classeChampAuthMdp, classeChampAuthNu,
  classeEtiquetteAuth, classeIconeChamp, classeBoutonAuth,
} from "@/components/auth/auth-ui";

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

// Les champs viennent de components/auth/auth-ui : ils portaient ici un fond
// gris et un anneau vert au focus, quand tout le reste du produit a un fond
// blanc et une bordure qui noircit. C'est le premier ecran qu'on voit, il ne
// peut pas etre le seul a parler une autre langue.
const inputClass = classeChampAuth;
const inputClassPassword = classeChampAuthMdp;

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
// Les contextes vivent dans config/auth-contextes : /signup et le panneau de
// gauche lisent la meme table, sans quoi la connexion et l'inscription
// promettaient deux choses differentes a qui passait de l'une a l'autre.

export default function LoginPage() {
  const searchParams = useSearchParams();
  const contexte = contexteAuth(searchParams.get("for"));
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
      <EnTeteAuth titre={contexte.titreConnexion} phrase={contexte.phraseConnexion} />

      {/* Google en tête : c'est le chemin le plus court (un tap, pas de mot de
          passe à retrouver), donc il passe avant le formulaire email. */}
      <BoutonGoogle onClick={handleGoogle} disabled={submitting}>
        Continuer avec Google
      </BoutonGoogle>

      {EMAIL_LOGIN_ENABLED && (
      <>
      <Separateur />

      {/* Tabs, un seul onglet ne se dessine pas : sans le téléphone, le
          formulaire email prend toute la place. */}
      {PHONE_LOGIN_ENABLED && (
      <div className="mb-6 grid grid-cols-2 border border-gray-200/70">
        <button
          type="button"
          onClick={() => { setTab("email"); setPhoneStep("number"); }}
          className={`flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
            tab === "email"
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <Mail size={14} /> Email
        </button>
        <button
          type="button"
          onClick={() => setTab("phone")}
          className={`flex items-center justify-center gap-2 py-3 text-[10px] font-black uppercase tracking-[0.12em] transition-colors ${
            tab === "phone"
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-900"
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
              <label htmlFor="email" className={classeEtiquetteAuth}>Email</label>
              <div className="relative">
                <Mail size={15} className={classeIconeChamp} />
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
                <p className="mt-1.5 text-[11px] font-bold text-red-600">{emailForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className={classeEtiquetteAuth}>Mot de passe</label>
              <div className="relative">
                <Lock size={15} className={classeIconeChamp} />
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-900"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {emailForm.formState.errors.password && (
                <p className="mt-1.5 text-[11px] font-bold text-red-600">{emailForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={classeBoutonAuth}
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
              <label htmlFor="phone" className={classeEtiquetteAuth}>Numéro de téléphone</label>
              <div className="flex gap-2">
                <select
                  aria-label="Indicatif pays"
                  value={dialCode}
                  onChange={(e) => setDialCode(e.target.value)}
                  className={`w-[7.5rem] shrink-0 ${classeChampAuthNu} px-3`}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label.slice(0, 2)} {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Phone size={15} className={classeIconeChamp} />
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
                <p className="mt-1.5 text-[11px] font-bold text-red-600">{phoneForm.formState.errors.phone.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={classeBoutonAuth}
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
              <label htmlFor="code" className={classeEtiquetteAuth}>Code de vérification</label>
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
                <p className="mt-1.5 text-[11px] font-bold text-red-600">{codeForm.formState.errors.code.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={classeBoutonAuth}
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
      {/* Le lien emporte `?for=` et `?next=` : sans eux, quelqu'un venu par
          « référencer mon terrain » basculait sur une inscription générique et
          retombait sur l'accueil au lieu de sa candidature. */}
      <div className="mt-8 border-t border-gray-200/70 pt-6 text-center">
        <p className="text-sm text-gray-500">
          Pas encore de compte ?{" "}
          <Link
            href={lienAuth("/signup", searchParams)}
            className="font-black text-gray-900 underline underline-offset-4 transition-colors hover:text-emerald-700"
          >
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
