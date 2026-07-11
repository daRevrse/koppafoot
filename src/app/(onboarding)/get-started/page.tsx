"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { SignupData } from "@/types";

// ============================================
// Schema
// ============================================
// Post-pivot: single account type — everyone completes a simple member
// profile (stored as "player"). Organizer / live-ops / superadmin are
// granted by promotion.

const schema = yup.object({
  firstName: yup.string().min(2, "Min. 2 caractères").required("Prénom requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Nom requis"),
  locationCity: yup.string().required("Ville requise"),
});

type FormData = yup.InferType<typeof schema>;

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
        userType: "player",
        locationCity: data.locationCity,
        email: firebaseUser?.email ?? undefined,
        phone: firebaseUser?.phoneNumber ?? undefined,
      };
      await completeProfile(signupData);
      toast.success("Profil créé !");
      router.push("/dashboard");
    } catch (err) {
      console.error("completeProfile error:", err);
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-8 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-semibold text-gray-900">
        Bienvenue !
      </h2>
      <p className="mb-6 text-center text-sm text-gray-500">
        {firebaseUser?.email ?? firebaseUser?.phoneNumber ?? "Complétez votre profil"}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Common fields */}
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
          <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
          <input
            {...register("locationCity")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
          {errors.locationCity && <p className="mt-1 text-xs text-red-600">{errors.locationCity.message}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Continuer
        </button>
      </form>
    </div>
  );
}
