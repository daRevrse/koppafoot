"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Mail, Phone, Loader2, Check, Plus, ShieldCheck, X, Lock } from "lucide-react";
import { type RecaptchaVerifier, type ConfirmationResult } from "firebase/auth";
import { createRecaptchaVerifier } from "@/lib/recaptcha";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import {
  COUNTRY_CODES,
  DEFAULT_DIAL_CODE,
  RESEND_COOLDOWN_S,
  normalizeNational,
  toE164,
} from "@/lib/phone";

// ============================================
// Méthodes de connexion — lists the providers already attached to the
// Firebase account and lets the user add the missing one. Without this a
// user who signed up by email and later signs in by phone lands on a
// second, empty account.
// ============================================

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";

type Panel = "none" | "phone" | "email";

export default function LoginMethodsCard() {
  const { firebaseUser, sendPhoneCode, linkPhone, linkEmail } = useAuth();
  const [panel, setPanel] = useState<Panel>("none");
  const [submitting, setSubmitting] = useState(false);

  // Phone linking
  const [dialCode, setDialCode] = useState<string>(DEFAULT_DIAL_CODE);
  const [national, setNational] = useState("");
  const [code, setCode] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);

  // Email linking
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    return () => {
      recaptchaVerifier.current?.clear();
      recaptchaVerifier.current = null;
    };
  }, []);

  if (!firebaseUser) return null;

  const providerIds = firebaseUser.providerData.map((p) => p.providerId);
  const hasEmail = providerIds.includes("password");
  const hasPhone = providerIds.includes("phone");
  const hasGoogle = providerIds.includes("google.com");

  const closePanel = () => {
    setPanel("none");
    setConfirmation(null);
    setSentTo("");
    setCode("");
    setCooldown(0);
    setPassword("");
    recaptchaVerifier.current?.clear();
    recaptchaVerifier.current = null;
  };

  // Fresh verifier AND fresh container on every attempt — see lib/recaptcha.
  const requestCode = async (e164: string) => {
    if (!recaptchaRef.current) throw new Error("reCAPTCHA indisponible");
    recaptchaVerifier.current = createRecaptchaVerifier(
      recaptchaRef.current,
      recaptchaVerifier.current,
    );
    const result = await sendPhoneCode(e164, recaptchaVerifier.current);
    setConfirmation(result);
    setSentTo(e164);
    setCooldown(RESEND_COOLDOWN_S);
  };

  const handleSendCode = async () => {
    const digits = normalizeNational(national);
    if (digits.length < 6) {
      toast.error("Numéro invalide");
      return;
    }
    setSubmitting(true);
    try {
      await requestCode(toE164(dialCode, national));
      setCode("");
      toast.success("Code envoyé !");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkPhone = async () => {
    if (!confirmation) return;
    setSubmitting(true);
    try {
      await linkPhone(confirmation, code);
      toast.success("Téléphone ajouté à ton compte");
      closePanel();
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLinkEmail = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error("Email et mot de passe (6 caractères min.) requis");
      return;
    }
    setSubmitting(true);
    try {
      await linkEmail(email.trim(), password);
      toast.success("Email ajouté — vérifie ta boîte mail");
      closePanel();
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 md:col-span-3">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <ShieldCheck size={16} className="text-emerald-600" />
        Méthodes de connexion
      </h3>
      <p className="mb-4 text-xs text-gray-500">
        Ajoute une seconde méthode pour retrouver ton compte même si tu changes
        de téléphone ou d&apos;adresse mail.
      </p>

      <div className="divide-y divide-gray-100">
        {/* Email */}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Mail size={16} className="shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">Email</p>
              <p className="truncate text-xs text-gray-500">
                {hasEmail ? firebaseUser.email : "Non lié"}
              </p>
            </div>
          </div>
          {hasEmail ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <Check size={12} /> Actif
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPanel(panel === "email" ? "none" : "email")}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Plus size={13} /> Ajouter
            </button>
          )}
        </div>

        {/* Phone */}
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Phone size={16} className="shrink-0 text-gray-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">Téléphone</p>
              <p className="truncate text-xs text-gray-500">
                {hasPhone ? firebaseUser.phoneNumber : "Non lié"}
              </p>
            </div>
          </div>
          {hasPhone ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <Check size={12} /> Actif
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setPanel(panel === "phone" ? "none" : "phone")}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <Plus size={13} /> Ajouter
            </button>
          )}
        </div>

        {/* Google — linking is a popup flow we don't expose yet */}
        {hasGoogle && (
          <div className="flex items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">Google</p>
                <p className="truncate text-xs text-gray-500">{firebaseUser.email}</p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <Check size={12} /> Actif
            </span>
          </div>
        )}
      </div>

      {/* ── Add phone ───────────────────────────────── */}
      {panel === "phone" && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Ajouter un téléphone
            </p>
            <button type="button" onClick={closePanel} className="text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          </div>

          {!confirmation ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                aria-label="Indicatif pays"
                value={dialCode}
                onChange={(e) => setDialCode(e.target.value)}
                className="w-full shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 focus:border-emerald-400 focus:outline-none sm:w-[7.5rem]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label.slice(0, 2)} {c.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="tel"
                value={national}
                onChange={(e) => setNational(e.target.value)}
                placeholder="90 12 34 56"
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={submitting}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                Envoyer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Code envoyé au <span className="font-semibold text-gray-700">{sentTo}</span>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className={`${inputClass} text-center tracking-[0.3em]`}
                />
                <button
                  type="button"
                  onClick={handleLinkPhone}
                  disabled={submitting || code.length !== 6}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  Vérifier
                </button>
              </div>
              <button
                type="button"
                onClick={() => sentTo && requestCode(sentTo).catch((e) => toast.error(getAuthErrorMessage(e)))}
                disabled={cooldown > 0 || submitting}
                className="text-xs font-semibold text-emerald-600 transition-colors hover:text-emerald-700 disabled:text-gray-300"
              >
                {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : "Renvoyer le code"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Add email ───────────────────────────────── */}
      {panel === "email" && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Ajouter un email
            </p>
            <button type="button" onClick={closePanel} className="text-gray-400 hover:text-gray-600">
              <X size={15} />
            </button>
          </div>
          <div className="space-y-2">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className={inputClass}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe (6 car. min.)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleLinkEmail}
                disabled={submitting}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                Lier
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={recaptchaRef} />
    </div>
  );
}
