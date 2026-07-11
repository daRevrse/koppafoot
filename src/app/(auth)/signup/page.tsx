"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Mail, Lock, Phone, MapPin, User, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";

// ============================================
// Signup — onboarded wizard, limited to the essentials.
// Step 1 (required): identity + credentials. Step 2 (skippable):
// city/phone — everything optional can be completed later in the
// profile. Single account type ("player" as the technical default);
// organizer / live-ops / superadmin are granted by promotion.
// ============================================

const essentialsSchema = yup.object({
  firstName: yup.string().min(2, "Min. 2 caractères").required("Prénom requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Nom requis"),
  email: yup.string().email("Email invalide").required("Email requis"),
  password: yup.string().min(6, "Min. 6 caractères").required("Mot de passe requis"),
});

const optionalSchema = yup.object({
  locationCity: yup.string().optional(),
  phone: yup.string().optional(),
});

type EssentialsForm = yup.InferType<typeof essentialsSchema>;
type OptionalForm = yup.InferType<typeof optionalSchema>;

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";
const inputClassPassword =
  "w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-11 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";
const labelClass = "mb-1.5 block text-xs font-bold text-gray-600";
const iconClass = "absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300";

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [essentials, setEssentials] = useState<EssentialsForm | null>(null);
  const { signupWithEmail, loginWithGoogle } = useAuth();
  const router = useRouter();

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
      <h2 className="mb-1 text-2xl font-black text-gray-900 font-display">Créer un compte</h2>
      <p className="mb-6 text-sm text-gray-400">
        Suis tes compétitions en direct et rejoins la communauté.
      </p>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex flex-1 flex-col gap-1.5">
            <span
              className={`h-1 rounded-full transition-colors ${
                step >= s ? "bg-emerald-500" : "bg-gray-100"
              }`}
            />
            <span className={`text-[10px] font-black uppercase tracking-wide ${
              step >= s ? "text-emerald-600" : "text-gray-300"
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
                  <p className="mt-1 text-xs text-red-500">{essentialsForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="lastName" className={labelClass}>Nom</label>
                <div className="relative">
                  <User size={15} className={iconClass} />
                  <input id="lastName" {...essentialsForm.register("lastName")} className={inputClass} placeholder="Nom" />
                </div>
                {essentialsForm.formState.errors.lastName && (
                  <p className="mt-1 text-xs text-red-500">{essentialsForm.formState.errors.lastName.message}</p>
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
                <p className="mt-1 text-xs text-red-500">{essentialsForm.formState.errors.email.message}</p>
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
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {essentialsForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-500">{essentialsForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-all"
            >
              Continuer
              <ArrowRight size={16} />
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-[10px] text-gray-300 uppercase tracking-wider">ou</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              <svg viewBox="0 0 24 24" width="16" height="16">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continuer avec Google
            </button>
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
              Ces informations sont optionnelles — tu pourras les compléter à tout
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
                  placeholder="Lomé, Abidjan, Cotonou…"
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
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Créer mon compte
            </button>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={submitting}
                className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeft size={13} />
                Retour
              </button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={submitting}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
              >
                Passer cette étape →
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-8 text-center text-sm">
        <p className="text-gray-400">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
