"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, ChevronLeft, ChevronRight, Check, User, Mail, Phone, Lock, MapPin, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";

// ============================================
// Schema
// ============================================

const schema = yup.object({
  // Step 1 — Personal
  firstName: yup.string().min(2, "Min. 2 caractères").required("Prénom requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Nom requis"),
  email: yup.string().email("Email invalide").required("Email requis"),
  phone: yup.string().required("Téléphone requis"),
  password: yup.string().min(6, "Min. 6 caractères").required("Mot de passe requis"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Les mots de passe ne correspondent pas")
    .required("Confirmation requise"),
  // Step 2 — Venue
  venueName: yup.string().min(3, "Min. 3 caractères").required("Nom du terrain requis"),
  venueAddress: yup.string().required("Adresse requise"),
  venueCity: yup.string().required("Ville requise"),
  fieldType: yup.string().oneOf(["outdoor", "indoor", "hybrid"]).required("Type requis"),
  fieldSurface: yup
    .string()
    .oneOf(["natural_grass", "synthetic", "hybrid", "indoor"])
    .required("Surface requise"),
  fieldSize: yup.string().oneOf(["5v5", "7v7", "11v11", "futsal"]).required("Taille requise"),
  // Step 3
  acceptTerms: yup
    .boolean()
    .oneOf([true], "Vous devez accepter les conditions")
    .required(),
});

type FormData = yup.InferType<typeof schema>;

const STEPS = [
  { label: "Vos infos", shortLabel: "Infos" },
  { label: "Votre terrain", shortLabel: "Terrain" },
  { label: "Confirmation", shortLabel: "Confirmer" },
];
const STEP_FIELDS: (keyof FormData)[][] = [
  ["firstName", "lastName", "email", "phone", "password", "confirmPassword"],
  ["venueName", "venueAddress", "venueCity", "fieldType", "fieldSurface", "fieldSize"],
  ["acceptTerms"],
];

const inputClass = "w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]";
const inputClassNoIcon = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]";
const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600";

export default function VenueOwnerSignupPage() {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signupWithEmail } = useAuth();

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      fieldType: "outdoor",
      fieldSurface: "synthetic",
      fieldSize: "5v5",
      acceptTerms: false,
    },
  });

  const values = watch();

  const nextStep = async () => {
    const valid = await trigger(STEP_FIELDS[step]);
    if (valid) setStep(step + 1);
  };

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await signupWithEmail({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        userType: "venue_owner",
        locationCity: data.venueCity,
        phone: data.phone,
      });

      // Create venue document
      const { currentUser } = await import("firebase/auth").then((m) => m.getAuth());
      if (currentUser) {
        await setDoc(doc(db, "venues", `${currentUser.uid}_${Date.now()}`), {
          name: data.venueName,
          address: data.venueAddress,
          city: data.venueCity,
          owner_id: currentUser.uid,
          field_type: data.fieldType,
          field_surface: data.fieldSurface,
          field_size: data.fieldSize,
          status: "active",
          latitude: 0,
          longitude: 0,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      }

      toast.success("Compte créé ! Vérifiez votre email.");
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
      <h2 className="mb-2 text-2xl font-bold text-gray-900 font-display">Inscription Propriétaire</h2>
      <p className="mb-6 text-sm text-gray-500">Proposez votre terrain sur KOPPAFOOT</p>

      {/* Stepper */}
      <div className="mb-8 flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  i < step
                    ? "bg-primary-600 text-white"
                    : i === step
                      ? "bg-primary-600 text-white ring-4 ring-primary-100"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {i < step ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${i <= step ? "text-primary-700" : "text-gray-400"}`}>
                {s.shortLabel}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="mx-2 mt-[-18px] h-0.5 flex-1">
                <div
                  className={`h-full rounded-full transition-colors ${
                    i < step ? "bg-primary-600" : "bg-gray-200"
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AnimatePresence mode="wait">
          {/* Step 1 — Personal */}
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input {...register("firstName")} className={inputClass} placeholder="Prénom" />
                  </div>
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input {...register("lastName")} className={inputClass} placeholder="Nom" />
                  </div>
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" {...register("email")} className={inputClass} placeholder="votre@email.com" />
                </div>
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" {...register("phone")} placeholder="+33612345678" className={inputClass} />
                </div>
                {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
                    placeholder="Min. 6 caractères"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Confirmer</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    {...register("confirmPassword")}
                    className={inputClass}
                    placeholder="Confirmer le mot de passe"
                  />
                </div>
                {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
              </div>
            </motion.div>
          )}

          {/* Step 2 — Venue */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nom du terrain</label>
                <div className="relative">
                  <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input {...register("venueName")} className={inputClass} placeholder="Stade Municipal..." />
                </div>
                {errors.venueName && <p className="mt-1 text-xs text-red-600">{errors.venueName.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Adresse</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input {...register("venueAddress")} className={inputClass} placeholder="123 rue du Sport" />
                </div>
                {errors.venueAddress && <p className="mt-1 text-xs text-red-600">{errors.venueAddress.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
                <div className="relative">
                  <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input {...register("venueCity")} className={inputClass} placeholder="Paris" />
                </div>
                {errors.venueCity && <p className="mt-1 text-xs text-red-600">{errors.venueCity.message}</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                  <select {...register("fieldType")} className={selectClass}>
                    <option value="outdoor">Extérieur</option>
                    <option value="indoor">Intérieur</option>
                    <option value="hybrid">Hybride</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Surface</label>
                  <select {...register("fieldSurface")} className={selectClass}>
                    <option value="natural_grass">Naturel</option>
                    <option value="synthetic">Synthétique</option>
                    <option value="hybrid">Hybride</option>
                    <option value="indoor">Indoor</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Format</label>
                  <select {...register("fieldSize")} className={selectClass}>
                    <option value="5v5">5v5</option>
                    <option value="7v7">7v7</option>
                    <option value="11v11">11v11</option>
                    <option value="futsal">Futsal</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3 — Confirm */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="rounded-xl border-2 border-primary-200 bg-primary-50/50 p-5">
                <p className="mb-3 text-sm font-bold text-gray-900 font-display">Récapitulatif</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-primary-100 pb-2">
                    <span className="text-gray-500">Nom</span>
                    <span className="font-medium text-gray-900">{values.firstName} {values.lastName}</span>
                  </div>
                  <div className="flex justify-between border-b border-primary-100 pb-2">
                    <span className="text-gray-500">Email</span>
                    <span className="font-medium text-gray-900">{values.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-primary-100 pb-2">
                    <span className="text-gray-500">Terrain</span>
                    <span className="font-medium text-gray-900">{values.venueName}</span>
                  </div>
                  <div className="flex justify-between border-b border-primary-100 pb-2">
                    <span className="text-gray-500">Ville</span>
                    <span className="font-medium text-gray-900">{values.venueCity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Format</span>
                    <span className="font-medium text-gray-900">{values.fieldSize}</span>
                  </div>
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  {...register("acceptTerms")}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-600"
                />
                <span className="text-sm text-gray-600">
                  J&apos;accepte les conditions d&apos;utilisation et la politique de confidentialité.
                </span>
              </label>
              {errors.acceptTerms && <p className="text-xs text-red-600">{errors.acceptTerms.message}</p>}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={16} /> Retour
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
            >
              Suivant <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Créer mon compte
            </button>
          )}
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
          Se connecter
        </Link>
      </p>
    </motion.div>
  );
}
