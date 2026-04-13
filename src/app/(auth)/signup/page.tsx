"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Users, Shield, Award } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { UserRole, SignupData } from "@/types";

// ============================================
// Role cards config
// ============================================

type SignupRole = "player" | "manager" | "referee";

const ROLES: { value: SignupRole; label: string; icon: typeof Users; description: string }[] = [
  {
    value: "player",
    label: "Joueur",
    icon: Users,
    description: "Rejoindre des matchs et des équipes",
  },
  {
    value: "manager",
    label: "Manager",
    icon: Shield,
    description: "Créer et gérer une équipe",
  },
  {
    value: "referee",
    label: "Arbitre",
    icon: Award,
    description: "Arbitrer des matchs",
  },
];

// ============================================
// Validation schema
// ============================================

const schema = yup.object({
  userType: yup
    .string()
    .oneOf(["player", "manager", "referee"] as const, "Choisissez un rôle")
    .required("Choisissez un rôle"),
  firstName: yup.string().min(2, "Min. 2 caractères").required("Prénom requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Nom requis"),
  email: yup.string().email("Email invalide").required("Email requis"),
  phone: yup.string().optional(),
  password: yup.string().min(6, "Min. 6 caractères").required("Mot de passe requis"),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref("password")], "Les mots de passe ne correspondent pas")
    .required("Confirmation requise"),
  locationCity: yup.string().required("Ville requise"),
  // Player
  position: yup.string().when("userType", {
    is: "player",
    then: (s) => s.optional(),
    otherwise: (s) => s.strip(),
  }),
  skillLevel: yup.string().when("userType", {
    is: "player",
    then: (s) => s.optional(),
    otherwise: (s) => s.strip(),
  }),
  // Manager
  teamName: yup.string().when("userType", {
    is: "manager",
    then: (s) => s.min(3, "Min. 3 caractères").required("Nom d'équipe requis"),
    otherwise: (s) => s.strip(),
  }),
  // Referee
  licenseNumber: yup.string().when("userType", {
    is: "referee",
    then: (s) => s.optional(),
    otherwise: (s) => s.strip(),
  }),
  licenseLevel: yup.string().when("userType", {
    is: "referee",
    then: (s) => s.optional(),
    otherwise: (s) => s.strip(),
  }),
  experienceYears: yup.number().when("userType", {
    is: "referee",
    then: (s) => s.min(0).optional(),
    otherwise: (s) => s.strip(),
  }),
});

type FormData = yup.InferType<typeof schema>;

// ============================================
// Component
// ============================================

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signupWithEmail } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormData>({
    resolver: yupResolver(schema) as any,
    defaultValues: { userType: undefined },
  });

  const selectedRole = watch("userType");

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await signupWithEmail({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        userType: data.userType as UserRole,
        locationCity: data.locationCity,
        phone: data.phone,
        position: data.position as SignupData["position"],
        skillLevel: data.skillLevel as SignupData["skillLevel"],
        teamName: data.teamName,
        licenseNumber: data.licenseNumber,
        licenseLevel: data.licenseLevel as SignupData["licenseLevel"],
        experienceYears: data.experienceYears,
      });
      toast.success("Compte créé ! Vérifiez votre email.");
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-8 shadow-md">
      <h2 className="mb-6 text-center text-2xl font-semibold text-gray-900">Créer un compte</h2>

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
          {errors.userType && (
            <p className="mt-1 text-xs text-red-600">{errors.userType.message}</p>
          )}
        </div>

        {/* Common fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">
              Prénom
            </label>
            <input
              id="firstName"
              {...register("firstName")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">
              Nom
            </label>
            <input
              id="lastName"
              {...register("lastName")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="signupEmail" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="signupEmail"
            type="email"
            autoComplete="email"
            {...register("email")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="signupPhone" className="mb-1 block text-sm font-medium text-gray-700">
            Téléphone <span className="text-gray-400">(optionnel)</span>
          </label>
          <input
            id="signupPhone"
            type="tel"
            {...register("phone")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            placeholder="+33612345678"
          />
        </div>

        <div>
          <label htmlFor="locationCity" className="mb-1 block text-sm font-medium text-gray-700">
            Ville
          </label>
          <input
            id="locationCity"
            {...register("locationCity")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
          {errors.locationCity && (
            <p className="mt-1 text-xs text-red-600">{errors.locationCity.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signupPassword" className="mb-1 block text-sm font-medium text-gray-700">
            Mot de passe
          </label>
          <div className="relative">
            <input
              id="signupPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("password")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            {...register("confirmPassword")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
          />
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Role-specific fields */}
        {selectedRole === "player" && (
          <div className="space-y-3 rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">Informations joueur</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="position" className="mb-1 block text-sm text-gray-700">Poste</label>
                <select
                  id="position"
                  {...register("position")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                >
                  <option value="">Non spécifié</option>
                  <option value="goalkeeper">Gardien</option>
                  <option value="defender">Défenseur</option>
                  <option value="midfielder">Milieu</option>
                  <option value="forward">Attaquant</option>
                  <option value="any">Polyvalent</option>
                </select>
              </div>
              <div>
                <label htmlFor="skillLevel" className="mb-1 block text-sm text-gray-700">Niveau</label>
                <select
                  id="skillLevel"
                  {...register("skillLevel")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                >
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
              <label htmlFor="teamName" className="mb-1 block text-sm text-gray-700">
                Nom de votre équipe
              </label>
              <input
                id="teamName"
                {...register("teamName")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
              {errors.teamName && (
                <p className="mt-1 text-xs text-red-600">{errors.teamName.message}</p>
              )}
            </div>
          </div>
        )}

        {selectedRole === "referee" && (
          <div className="space-y-3 rounded-lg bg-purple-50 p-4">
            <p className="text-sm font-medium text-purple-800">Informations arbitre</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="licenseNumber" className="mb-1 block text-sm text-gray-700">N° licence</label>
                <input
                  id="licenseNumber"
                  {...register("licenseNumber")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="licenseLevel" className="mb-1 block text-sm text-gray-700">Niveau</label>
                <select
                  id="licenseLevel"
                  {...register("licenseLevel")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                >
                  <option value="">Non spécifié</option>
                  <option value="trainee">Stagiaire</option>
                  <option value="regional">Régional</option>
                  <option value="national">National</option>
                  <option value="international">International</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="experienceYears" className="mb-1 block text-sm text-gray-700">
                Années d&apos;expérience
              </label>
              <input
                id="experienceYears"
                type="number"
                min="0"
                {...register("experienceYears")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
              />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Créer mon compte
        </button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm">
        <p className="text-gray-600">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-primary-600 hover:text-primary-700">
            Se connecter
          </Link>
        </p>
        <p className="text-gray-600">
          Vous gérez un terrain ?{" "}
          <Link href="/signup/venue-owner" className="font-medium text-primary-600 hover:text-primary-700">
            Inscription propriétaire
          </Link>
        </p>
      </div>
    </div>
  );
}
