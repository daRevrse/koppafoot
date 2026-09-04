"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { nomPersonne, villeRequise } from "@/lib/champs-valides";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { SignupData } from "@/types";

// ============================================
// Schema
// ============================================
// Post-pivot: single account type, everyone completes a simple member
// profile (stored as "player"). Organizer / live-ops / superadmin are
// granted by promotion.

const schema = yup.object({
  firstName: nomPersonne("Prénom"),
  lastName: nomPersonne("Nom"),
  locationCity: villeRequise,
});

type FormData = yup.InferType<typeof schema>;

// Same field styling as the (auth) pages, this screen is the tail of the
// same funnel and must not read as a different product.
const inputClass =
  "w-full border border-gray-200/70 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-all";
const labelClass = "mb-1.5 block text-xs font-bold text-gray-600";
const errorClass = "mt-1 text-xs text-red-400";

export default function GetStartedPage() {
  const [submitting, setSubmitting] = useState(false);
  const { firebaseUser, completeProfile } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const signupData: SignupData = {
        firstName: data.firstName,
        lastName: data.lastName,
        // Spectateur par defaut : on n'est joueur que si on l'a choisi dans
        // Evolution. Tout compte naissait « player », ce qui etiquetait la
        // moitie des inscrits en joueurs sans qu'ils l'aient jamais decide.
        userType: "user",
        locationCity: data.locationCity,
        email: firebaseUser?.email ?? undefined,
        phone: firebaseUser?.phoneNumber ?? undefined,
      };
      await completeProfile(signupData);
      toast.success("Profil créé !");
      router.push("/");
    } catch (err) {
      console.error("completeProfile error:", err);
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h2 className="mb-1 font-display text-2xl font-black text-gray-900">
        Bienvenue !
      </h2>
      <p className="mb-8 text-sm text-gray-400">
        {firebaseUser?.email ?? firebaseUser?.phoneNumber ?? "Complète ton profil pour continuer"}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className={labelClass}>Prénom</label>
            <input id="firstName" autoComplete="given-name" {...register("firstName")} className={inputClass} />
            {errors.firstName && <p className={errorClass}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="lastName" className={labelClass}>Nom</label>
            <input id="lastName" autoComplete="family-name" {...register("lastName")} className={inputClass} />
            {errors.lastName && <p className={errorClass}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="locationCity" className={labelClass}>Ta ville</label>
          <input
            id="locationCity"
            autoComplete="address-level2"
            placeholder="Ta ville"
            {...register("locationCity")}
            className={inputClass}
          />
          {errors.locationCity && <p className={errorClass}>{errors.locationCity.message}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 bg-emerald-500 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Continuer
        </button>
      </form>
    </>
  );
}
