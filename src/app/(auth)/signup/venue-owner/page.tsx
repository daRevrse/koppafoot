"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, ChevronLeft, ChevronRight, Check } from "lucide-react";
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

const STEPS = ["Informations personnelles", "Votre terrain", "Confirmation"];
const STEP_FIELDS: (keyof FormData)[][] = [
  ["firstName", "lastName", "email", "phone", "password", "confirmPassword"],
  ["venueName", "venueAddress", "venueCity", "fieldType", "fieldSurface", "fieldSize"],
  ["acceptTerms"],
];

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
    <div className="rounded-xl bg-white p-8 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-semibold text-gray-900">
        Inscription Propriétaire
      </h2>

      {/* Progress */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                i < step
                  ? "bg-primary-600 text-white"
                  : i === step
                    ? "bg-primary-100 text-primary-700 ring-2 ring-primary-600"
                    : "bg-gray-100 text-gray-400"
              }`}
            >
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-8 ${i < step ? "bg-primary-600" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>
      <p className="mb-6 text-center text-sm text-gray-500">{STEPS[step]}</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Step 1 — Personal */}
        {step === 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
                <input
                  {...register("firstName")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                <input
                  {...register("lastName")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                {...register("email")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
              <input
                type="tel"
                {...register("phone")}
                placeholder="+33612345678"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Confirmer</label>
              <input
                type={showPassword ? "text" : "password"}
                {...register("confirmPassword")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
            </div>
          </>
        )}

        {/* Step 2 — Venue */}
        {step === 1 && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nom du terrain</label>
              <input
                {...register("venueName")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.venueName && <p className="mt-1 text-xs text-red-600">{errors.venueName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Adresse</label>
              <input
                {...register("venueAddress")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.venueAddress && <p className="mt-1 text-xs text-red-600">{errors.venueAddress.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
              <input
                {...register("venueCity")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.venueCity && <p className="mt-1 text-xs text-red-600">{errors.venueCity.message}</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                <select
                  {...register("fieldType")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                >
                  <option value="outdoor">Extérieur</option>
                  <option value="indoor">Intérieur</option>
                  <option value="hybrid">Hybride</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Surface</label>
                <select
                  {...register("fieldSurface")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                >
                  <option value="natural_grass">Naturel</option>
                  <option value="synthetic">Synthétique</option>
                  <option value="hybrid">Hybride</option>
                  <option value="indoor">Indoor</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Format</label>
                <select
                  {...register("fieldSize")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                >
                  <option value="5v5">5v5</option>
                  <option value="7v7">7v7</option>
                  <option value="11v11">11v11</option>
                  <option value="futsal">Futsal</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Step 3 — Confirm */}
        {step === 2 && (
          <>
            <div className="space-y-3 rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-medium text-gray-900">Récapitulatif</p>
              <div className="grid grid-cols-2 gap-2 text-gray-600">
                <span>Nom :</span>
                <span className="font-medium text-gray-900">{values.firstName} {values.lastName}</span>
                <span>Email :</span>
                <span className="font-medium text-gray-900">{values.email}</span>
                <span>Terrain :</span>
                <span className="font-medium text-gray-900">{values.venueName}</span>
                <span>Ville :</span>
                <span className="font-medium text-gray-900">{values.venueCity}</span>
                <span>Format :</span>
                <span className="font-medium text-gray-900">{values.fieldSize}</span>
              </div>
            </div>
            <label className="flex items-start gap-2">
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
          </>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ChevronLeft size={16} /> Retour
            </button>
          )}
          {step < 2 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              Suivant <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Créer mon compte
            </button>
          )}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
