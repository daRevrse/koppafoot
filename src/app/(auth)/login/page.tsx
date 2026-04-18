"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Mail, Phone, Loader2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";

// ============================================
// Schemas
// ============================================

const emailSchema = yup.object({
  email: yup.string().email("Email invalide").required("Email requis"),
  password: yup.string().required("Mot de passe requis"),
});

const phoneSchema = yup.object({
  phone: yup
    .string()
    .matches(/^\+[1-9]\d{6,14}$/, "Format international requis (ex: +33612345678)")
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
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all backdrop-blur-sm";
const inputClassPassword =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.06] py-3 pl-11 pr-11 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all backdrop-blur-sm";

// ============================================
// Tabs
// ============================================

type Tab = "email" | "phone";

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("email");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"number" | "code">("number");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
  const router = useRouter();
  const { loginWithEmail, sendPhoneCode, confirmPhoneCode, loginWithGoogle } = useAuth();

  // Setup reCAPTCHA
  useEffect(() => {
    if (tab === "phone" && recaptchaRef.current && !recaptchaVerifier.current) {
      recaptchaVerifier.current = new RecaptchaVerifier(auth, recaptchaRef.current, {
        size: "invisible",
      });
    }
  }, [tab]);

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

  const handleSendCode = async (data: PhoneForm) => {
    setSubmitting(true);
    try {
      if (!recaptchaVerifier.current) throw new Error("reCAPTCHA non initialisé");
      const result = await sendPhoneCode(data.phone, recaptchaVerifier.current);
      setConfirmation(result);
      setPhoneStep("code");
      toast.success("Code envoyé !");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCode = async (data: CodeForm) => {
    setSubmitting(true);
    try {
      if (!confirmation) throw new Error("Pas de confirmation en cours");
      await confirmPhoneCode(confirmation, data.code);
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
      <h2 className="mb-1 text-2xl font-black text-white font-display">Connexion</h2>
      <p className="mb-8 text-sm text-white/40">Connecte-toi pour accéder à ton espace</p>

      {/* Tabs */}
      <div className="mb-6 flex rounded-xl bg-white/[0.04] p-1">
        <button
          type="button"
          onClick={() => { setTab("email"); setPhoneStep("number"); }}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
            tab === "email"
              ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          <Mail size={14} /> Email
        </button>
        <button
          type="button"
          onClick={() => setTab("phone")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${
            tab === "phone"
              ? "bg-emerald-500/20 text-emerald-400 shadow-sm"
              : "text-white/30 hover:text-white/50"
          }`}
        >
          <Phone size={14} /> Téléphone
        </button>
      </div>

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
              <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-white/50">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
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
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-white/50">Mot de passe</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {emailForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-400">{emailForm.formState.errors.password.message}</p>
              )}
            </div>

            <div className="text-right">
              <Link href="/forgot-password" className="text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors">
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Se connecter
            </button>
          </motion.form>
        )}

        {/* Phone Tab */}
        {tab === "phone" && phoneStep === "number" && (
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
              <label htmlFor="phone" className="mb-1.5 block text-xs font-medium text-white/50">Numéro de téléphone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
                <input
                  id="phone"
                  type="tel"
                  {...phoneForm.register("phone")}
                  className={inputClass}
                  placeholder="+33612345678"
                />
              </div>
              {phoneForm.formState.errors.phone && (
                <p className="mt-1 text-xs text-red-400">{phoneForm.formState.errors.phone.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Envoyer le code
            </button>
          </motion.form>
        )}

        {tab === "phone" && phoneStep === "code" && (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={codeForm.handleSubmit(handleConfirmCode)}
            className="space-y-4"
          >
            <p className="text-sm text-white/40">Un code à 6 chiffres a été envoyé à votre numéro.</p>
            <div>
              <label htmlFor="code" className="mb-1.5 block text-xs font-medium text-white/50">Code de vérification</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                {...codeForm.register("code")}
                className="w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-center text-lg tracking-[0.3em] text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all placeholder:text-white/20"
                placeholder="000000"
              />
              {codeForm.formState.errors.code && (
                <p className="mt-1 text-xs text-red-400">{codeForm.formState.errors.code.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Vérifier
            </button>

            <button
              type="button"
              onClick={() => { setPhoneStep("number"); setConfirmation(null); }}
              className="w-full text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Changer de numéro
            </button>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/[0.08]" />
        <span className="text-[10px] text-white/20 uppercase tracking-wider">ou</span>
        <div className="h-px flex-1 bg-white/[0.08]" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-50 transition-all backdrop-blur-sm"
      >
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continuer avec Google
      </button>

      {/* Links */}
      <div className="mt-8 space-y-2 text-center text-sm">
        <p className="text-white/30">
          Pas encore de compte ?{" "}
          <Link href="/signup" className="font-medium text-emerald-400/80 hover:text-emerald-400 transition-colors">
            Créer un compte
          </Link>
        </p>
        <p className="text-white/30">
          Vous gérez un terrain ?{" "}
          <Link href="/signup/venue-owner" className="font-medium text-emerald-400/80 hover:text-emerald-400 transition-colors">
            Inscription propriétaire
          </Link>
        </p>
      </div>

      {/* reCAPTCHA container */}
      <div ref={recaptchaRef} />
    </motion.div>
  );
}
