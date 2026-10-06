"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Mail, Phone, Loader2, Lock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ConfirmationResult } from "firebase/auth";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { CONNEXION_SMS_OUVERTE } from "@/lib/phone";
import FormulaireSms from "@/components/auth/FormulaireSms";
import { versGetStarted } from "@/lib/destination";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import { contexteAuth, lienAuth } from "@/config/auth-contextes";
import MentionConditions from "@/components/auth/MentionConditions";
import {
  EnTeteAuth, Separateur, BoutonGoogle,
  classeChampAuth, classeChampAuthMdp,
  classeEtiquetteAuth, classeIconeChamp, classeBoutonAuth,
} from "@/components/auth/auth-ui";

// ============================================
// Schemas
// ============================================

const emailSchema = yup.object({
  email: yup.string().email("Email invalide").required("Email requis"),
  password: yup.string().required("Mot de passe requis"),
});

// Le numéro et le code ont leurs schémas dans components/auth/FormulaireSms,
// partagé avec /signup.

type EmailForm = yup.InferType<typeof emailSchema>;

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
 * Connexion par SMS ouverte, sauf si le frein d'urgence est tiré : voir
 * CONNEXION_SMS_OUVERTE (lib/phone), que `NEXT_PUBLIC_CONNEXION_SMS=0`
 * referme. Le parcours (numéro, code, renvoi, reCAPTCHA) est celui de
 * components/auth/FormulaireSms, partagé avec /signup ; ici ne reste que la
 * suite d'un code validé.
 *
 * `/login?essai-sms=1` la rouvre pour une seule visite, sans redéployer :
 * la porte d'essai avec un vrai téléphone sur le vrai domaine, le seul où
 * les clés reCAPTCHA et les domaines autorisés de Firebase sont ceux de la
 * production. Rien n'est protégé par là : le formulaire n'appelle que ce que
 * le SDK Firebase expose de toute façon. On cache un onglet qui échoue, pas
 * une fonction.
 *
 * Un premier code reçu sur un numéro inconnu crée le compte, puis mène à
 * /get-started : se connecter par SMS sans compte, c'est s'inscrire.
 */
const ESSAI_SMS = "essai-sms";

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
  const essaiSms = searchParams.get(ESSAI_SMS) === "1";
  const PHONE_LOGIN_ENABLED = CONNEXION_SMS_OUVERTE || essaiSms;
  // Venu pour l'essai : l'onglet téléphone d'emblée.
  const [tab, setTab] = useState<Tab>(essaiSms ? "phone" : "email");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { loginWithEmail, confirmPhoneCode, loginWithGoogle } = useAuth();

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

  // --- Téléphone : la suite d'un code validé ---

  const handleConfirmCode = async (confirmation: ConfirmationResult, code: string) => {
    const { isNewUser } = await confirmPhoneCode(confirmation, code);
    if (isNewUser) {
      // Authenticated but no Firestore profile yet, same path as Google ; la
      // destination (`?next=`) suit jusqu'au bout de /get-started.
      router.push(versGetStarted({ next: searchParams.get("next") }));
      return;
    }
    toast.success("Connexion réussie");
  };

  // --- Google ---

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const { isNewUser } = await loginWithGoogle();
      if (isNewUser) {
        router.push(versGetStarted({ next: searchParams.get("next") }));
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

      {/* Une session fermée par une suspension atterrit ici (contexts/AuthContext). */}
      {searchParams.get("suspendu") && (
        <div role="alert" className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-black text-red-950">Compte suspendu</p>
          <p className="mt-0.5">
            Ce compte ne peut plus se connecter. Si tu penses qu&apos;il s&apos;agit d&apos;une erreur, écris-nous depuis
            la <Link href="/aide" className="font-bold underline">page Aide</Link>.
          </p>
        </div>
      )}

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
          onClick={() => setTab("email")}
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
                  placeholder="ton@email.com"
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
        {PHONE_LOGIN_ENABLED && tab === "phone" && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <FormulaireSms onConfirmer={handleConfirmCode} occupe={submitting} />
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}

      {/* Links */}
      {/* Le lien emporte `?for=` et `?next=` : sans eux, quelqu'un venu par
          « référencer mon terrain » basculait sur une inscription générique et
          retombait sur l'accueil au lieu de sa candidature. */}
      {/* « Continuer avec Google » crée le compte s'il n'existe pas encore. */}
      <MentionConditions className="mt-6 text-center" />

      <div className="mt-6 border-t border-gray-200/70 pt-6 text-center">
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

    </motion.div>
  );
}
