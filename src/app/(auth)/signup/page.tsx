"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  nomPersonne, telephoneOptionnel, villeOptionnelle,
} from "@/lib/champs-valides";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Mail, Lock, Phone, MapPin, User, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { roleDepuisURL } from "@/lib/onboarding";
import type { EvolutionRole } from "@/types";
import { contexteAuth, lienAuth } from "@/config/auth-contextes";
import {
  EnTeteAuth, Separateur, BoutonGoogle,
  classeChampAuth, classeChampAuthMdp, classeEtiquetteAuth, classeIconeChamp,
  classeBoutonAuth,
} from "@/components/auth/auth-ui";

// ============================================
// Signup, onboarded wizard, limited to the essentials.
// Step 1 (required): identity + credentials. Step 2 (skippable):
// city/phone, everything optional can be completed later in the
// profile. Single account type ("player" as the technical default);
// organizer / live-ops / superadmin are granted by promotion.
// ============================================

const essentialsSchema = yup.object({
  firstName: nomPersonne("Prénom"),
  lastName: nomPersonne("Nom"),
  email: yup.string().email("Email invalide").required("Email requis"),
  password: yup.string().min(6, "Min. 6 caractères").required("Mot de passe requis"),
});

const optionalSchema = yup.object({
  locationCity: villeOptionnelle,
  phone: telephoneOptionnel,
});

type EssentialsForm = yup.InferType<typeof essentialsSchema>;
type OptionalForm = yup.InferType<typeof optionalSchema>;

// Meme vocabulaire que la connexion, et que le reste du produit.
const inputClass = classeChampAuth;
const inputClassPassword = classeChampAuthMdp;
const labelClass = classeEtiquetteAuth;
const iconClass = classeIconeChamp;

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [essentials, setEssentials] = useState<EssentialsForm | null>(null);
  /**
   * Le role choisi sur /roles, arrive en `?role=`.
   *
   * Lu apres le montage : `window` n'existe pas au rendu serveur, et le lire
   * dans l'initialiseur d'etat ferait diverger les deux rendus.
   */
  const [roleChoisi, setRoleChoisi] = useState<EvolutionRole | null>(null);
  useEffect(() => setRoleChoisi(roleDepuisURL()), []);
  const { signupWithEmail, loginWithGoogle } = useAuth();
  const router = useRouter();
  // La provenance, transmise par /login : l'inscription doit promettre la
  // meme chose que la porte par laquelle on est entre.
  const searchParams = useSearchParams();
  const contexte = contexteAuth(searchParams.get("for"));

  const essentialsForm = useForm<EssentialsForm>({
    resolver: yupResolver(essentialsSchema),
  });
  const optionalForm = useForm<OptionalForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(optionalSchema) as any,
  });

  const goToStep2 = (data: EssentialsForm) => {
    setEssentials(data);
    setStep(2);
  };

  const createAccount = async (optional: OptionalForm) => {
    if (!essentials) return;
    setSubmitting(true);
    try {
      await signupWithEmail({
        email: essentials.email,
        password: essentials.password,
        firstName: essentials.firstName,
        lastName: essentials.lastName,
        userType: "player",
        locationCity: optional.locationCity ?? "",
        phone: optional.phone,
        // Le compte nait avec le role qu'on venait de choisir, plutot que de
        // renvoyer vers un ecran qui repose la meme question.
        ...(roleChoisi ? { evolutionRole: roleChoisi } : {}),
      });
      toast.success("Compte créé ! Vérifiez votre email.");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => createAccount({});

  const handleGoogle = async () => {
    setSubmitting(true);
    try {
      const { isNewUser } = await loginWithGoogle();
      if (isNewUser) {
        // Google cree le compte sans passer par notre formulaire : le role ne
        // peut pas y etre pose. On le transporte jusqu'a l'ecran qui sait
        // l'activer, qui l'appliquera sans reposer la question.
        router.push(roleChoisi ? `/evolution?role=${roleChoisi}` : "/get-started");
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
      <EnTeteAuth titre={contexte.titreInscription} phrase={contexte.phraseInscription} />

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1 transition-colors ${
                step >= s ? "bg-gray-900" : "bg-gray-200"
              }`}
            />
            <span className={`text-[10px] font-black uppercase tracking-[0.12em] ${
              step >= s ? "text-gray-900" : "text-gray-300"
            }`}>
              {s === 1 ? "L'essentiel" : "Ton profil (optionnel)"}
            </span>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.form
            key="step1"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={essentialsForm.handleSubmit(goToStep2)}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className={labelClass}>Prénom</label>
                <div className="relative">
                  <User size={15} className={iconClass} />
                  <input id="firstName" {...essentialsForm.register("firstName")} className={inputClass} placeholder="Prénom" />
                </div>
                {essentialsForm.formState.errors.firstName && (
                  <p className="mt-1.5 text-[11px] font-bold text-red-600">{essentialsForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>Nom</label>
                <div className="relative">
                  <User size={15} className={iconClass} />
                  <input id="lastName" {...essentialsForm.register("lastName")} className={inputClass} placeholder="Nom" />
                </div>
                {essentialsForm.formState.errors.lastName && (
                  <p className="mt-1.5 text-[11px] font-bold text-red-600">{essentialsForm.formState.errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="signupEmail" className={labelClass}>Email</label>
              <div className="relative">
                <Mail size={15} className={iconClass} />
                <input
                  id="signupEmail"
                  type="email"
                  autoComplete="email"
                  {...essentialsForm.register("email")}
                  className={inputClass}
                  placeholder="votre@email.com"
                />
              </div>
              {essentialsForm.formState.errors.email && (
                <p className="mt-1.5 text-[11px] font-bold text-red-600">{essentialsForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="signupPassword" className={labelClass}>Mot de passe</label>
              <div className="relative">
                <Lock size={15} className={iconClass} />
                <input
                  id="signupPassword"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  {...essentialsForm.register("password")}
                  className={inputClassPassword}
                  placeholder="Min. 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 transition-colors hover:text-gray-900"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {essentialsForm.formState.errors.password && (
                <p className="mt-1.5 text-[11px] font-bold text-red-600">{essentialsForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              className={classeBoutonAuth}
            >
              Continuer
              <ArrowRight size={16} />
            </button>

            <Separateur />

            <BoutonGoogle onClick={handleGoogle} disabled={submitting}>
              Continuer avec Google
            </BoutonGoogle>
          </motion.form>
        )}

        {step === 2 && (
          <motion.form
            key="step2"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            onSubmit={optionalForm.handleSubmit(createAccount)}
            className="space-y-4"
          >
            <p className="text-xs leading-relaxed text-gray-400">
              Ces informations sont optionnelles, tu pourras les compléter à tout
              moment dans ton profil.
            </p>

            <div>
              <label htmlFor="locationCity" className={labelClass}>
                Ville <span className="font-semibold text-gray-300">(optionnel)</span>
              </label>
              <div className="relative">
                <MapPin size={15} className={iconClass} />
                <input
                  id="locationCity"
                  {...optionalForm.register("locationCity")}
                  className={inputClass}
                  placeholder="Ta ville"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signupPhone" className={labelClass}>
                Téléphone <span className="font-semibold text-gray-300">(optionnel)</span>
              </label>
              <div className="relative">
                <Phone size={15} className={iconClass} />
                <input
                  id="signupPhone"
                  type="tel"
                  {...optionalForm.register("phone")}
                  className={inputClass}
                  placeholder="+22890123456"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={classeBoutonAuth}
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Créer mon compte
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-gray-900"
              >
                <ArrowLeft size={13} />
                Retour
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={submitting}
                className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-emerald-700"
              >
                Passer cette étape →
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-8 border-t border-gray-200/70 pt-6 text-center">
        <p className="text-sm text-gray-500">
          Déjà un compte ?{" "}
          <Link
            href={lienAuth("/login", searchParams)}
            className="font-black text-gray-900 underline underline-offset-4 transition-colors hover:text-emerald-700"
          >
            Se connecter
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
