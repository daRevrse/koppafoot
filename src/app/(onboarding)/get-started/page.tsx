"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Users, Shield, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { ROLE_REDIRECTS } from "@/types";
import type { UserRole, SignupData } from "@/types";

// ============================================
// Role cards
// ============================================

type SignupRole = "player" | "manager" | "referee";

const ROLES: { value: SignupRole; label: string; icon: typeof Users; description: string }[] = [
  { value: "player", label: "Joueur", icon: Users, description: "Rejoindre des matchs et des équipes" },
  { value: "manager", label: "Manager", icon: Shield, description: "Créer et gérer une équipe" },
  { value: "referee", label: "Arbitre", icon: Award, description: "Arbitrer des matchs" },
];

// ============================================
// Schema
// ============================================

const schema = yup.object({
  userType: yup.string().oneOf(["player", "manager", "referee"] as const).required("Choisissez un rôle"),
  firstName: yup.string().min(2, "Min. 2 caractères").required("Prénom requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Nom requis"),
  locationCity: yup.string().required("Ville requise"),
  position: yup.string().optional(),
  skillLevel: yup.string().optional(),
  teamName: yup.string().when("userType", {
    is: "manager",
    then: (s) => s.min(3, "Min. 3 caractères").required("Nom d'équipe requis"),
    otherwise: (s) => s.strip(),
  }),
  licenseNumber: yup.string().optional(),
  licenseLevel: yup.string().optional(),
  experienceYears: yup.number().min(0).optional(),
});

type FormData = yup.InferType<typeof schema>;

export default function GetStartedPage() {
  const [submitting, setSubmitting] = useState(false);
  const { firebaseUser, completeProfile } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormData>({ resolver: yupResolver(schema) as any });

  const selectedRole = watch("userType");

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      const signupData: SignupData = {
        firstName: data.firstName,
        lastName: data.lastName,
        userType: data.userType as UserRole,
        locationCity: data.locationCity,
        email: firebaseUser?.email ?? undefined,
        phone: firebaseUser?.phoneNumber ?? undefined,
        position: data.position as SignupData["position"],
        skillLevel: data.skillLevel as SignupData["skillLevel"],
        teamName: data.teamName,
        licenseNumber: data.licenseNumber,
        licenseLevel: data.licenseLevel as SignupData["licenseLevel"],
        experienceYears: data.experienceYears,
      };
      await completeProfile(signupData);
      toast.success("Profil créé !");
      router.push(ROLE_REDIRECTS[signupData.userType] ?? "/dashboard");
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
        {/* Role selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Je suis...</label>
          <div className="grid grid-cols-3 gap-3">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.value;
              return (
                <button
                  key={role.value}
                  type="button"
                  onClick={() => setValue("userType", role.value, { shouldValidate: true })}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-center transition-all ${
                    isSelected
                      ? "border-primary-600 bg-primary-50 text-primary-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon size={24} className={isSelected ? "text-primary-600" : "text-gray-400"} />
                  <span className="text-sm font-medium">{role.label}</span>
                </button>
              );
            })}
          </div>
          {errors.userType && <p className="mt-1 text-xs text-red-600">{errors.userType.message}</p>}
        </div>

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

        {/* Role-specific fields */}
        {selectedRole === "player" && (
          <div className="space-y-3 rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">Informations joueur</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-700">Poste</label>
                <select {...register("position")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                  <option value="">Non spécifié</option>
                  <option value="goalkeeper">Gardien</option>
                  <option value="defender">Défenseur</option>
                  <option value="midfielder">Milieu</option>
                  <option value="forward">Attaquant</option>
                  <option value="any">Polyvalent</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Niveau</label>
                <select {...register("skillLevel")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                  <option value="">Non spécifié</option>
                  <option value="beginner">Débutant</option>
                  <option value="amateur">Amateur</option>
                  <option value="intermediate">Intermédiaire</option>
                  <option value="advanced">Avancé</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {selectedRole === "manager" && (
          <div className="space-y-3 rounded-lg bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">Informations manager</p>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Nom de votre équipe</label>
              <input {...register("teamName")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
              {errors.teamName && <p className="mt-1 text-xs text-red-600">{errors.teamName.message}</p>}
            </div>
          </div>
        )}

        {selectedRole === "referee" && (
          <div className="space-y-3 rounded-lg bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-800">Informations arbitre</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-700">N° licence</label>
                <input {...register("licenseNumber")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-700">Niveau</label>
                <select {...register("licenseLevel")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                  <option value="">Non spécifié</option>
                  <option value="trainee">Stagiaire</option>
                  <option value="regional">Régional</option>
                  <option value="national">National</option>
                  <option value="international">International</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-700">Années d&apos;expérience</label>
              <input type="number" min="0" {...register("experienceYears")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Continuer
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Vous gérez un terrain ?{" "}
        <Link href="/signup/venue-owner" className="font-medium text-primary-600 hover:text-primary-700">
          Inscription propriétaire
        </Link>
      </p>
    </div>
  );
}
