"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Users, Shield, Award, Mail, Lock, Phone, MapPin, User, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { UserRole, SignupData } from "@/types";

// ============================================
// Role cards config
// ============================================

type SignupRole = "player" | "manager" | "referee";

const ROLES: { value: SignupRole; label: string; icon: typeof Users; description: string; color: string; bgSelected: string; borderSelected: string; iconSelected: string }[] = [
  {
    value: "player",
    label: "Joueur",
    icon: Users,
    description: "Rejoindre des matchs et des équipes",
    color: "emerald",
    bgSelected: "bg-emerald-50",
    borderSelected: "border-emerald-500",
    iconSelected: "text-emerald-600",
  },
  {
    value: "manager",
    label: "Manager",
    icon: Shield,
    description: "Créer et gérer une équipe",
    color: "blue",
    bgSelected: "bg-blue-50",
    borderSelected: "border-blue-500",
    iconSelected: "text-blue-600",
  },
  {
    value: "referee",
    label: "Arbitre",
    icon: Award,
    description: "Arbitrer des matchs",
    color: "purple",
    bgSelected: "bg-purple-50",
    borderSelected: "border-purple-500",
    iconSelected: "text-purple-600",
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
// Input styling
// ============================================

const inputClass = "w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]";
const inputClassNoIcon = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]";
const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600";

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <h2 className="mb-2 text-2xl font-bold text-gray-900 font-display">Créer un compte</h2>
      <p className="mb-8 text-sm text-gray-500">Rejoins la communauté KOPPAFOOT</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Role selection */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">Je suis...</label>
          <div className="grid grid-cols-3 gap-3">
            {ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.value;
              return (
                <motion.button
                  key={role.value}
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setValue("userType", role.value, { shouldValidate: true })}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
                    isSelected
                      ? `${role.borderSelected} ${role.bgSelected}`
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600"
                    >
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? role.bgSelected : "bg-gray-100"}`}>
                    <Icon size={20} className={isSelected ? role.iconSelected : "text-gray-400"} />
                  </div>
                  <span className="text-sm font-semibold">{role.label}</span>
                  <span className="text-xs text-gray-500 leading-tight">{role.description}</span>
                </motion.button>
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
            <label htmlFor="firstName" className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="firstName"
                {...register("firstName")}
                className={inputClass}
                placeholder="Prénom"
              />
            </div>
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="lastName"
                {...register("lastName")}
                className={inputClass}
                placeholder="Nom"
              />
            </div>
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="signupEmail" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="signupEmail"
              type="email"
              autoComplete="email"
              {...register("email")}
              className={inputClass}
              placeholder="votre@email.com"
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="signupPhone" className="mb-1 block text-sm font-medium text-gray-700">
            Téléphone <span className="text-gray-400">(optionnel)</span>
          </label>
          <div className="relative">
            <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="signupPhone"
              type="tel"
              {...register("phone")}
              className={inputClass}
              placeholder="+33612345678"
            />
          </div>
        </div>

        <div>
          <label htmlFor="locationCity" className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
          <div className="relative">
            <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="locationCity"
              {...register("locationCity")}
              className={inputClass}
              placeholder="Paris, Lyon, Marseille..."
            />
          </div>
          {errors.locationCity && (
            <p className="mt-1 text-xs text-red-600">{errors.locationCity.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signupPassword" className="mb-1 block text-sm font-medium text-gray-700">Mot de passe</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="signupPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("password")}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-10 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
              placeholder="Min. 6 caractères"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("confirmPassword")}
              className={inputClass}
              placeholder="Confirmer le mot de passe"
            />
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Role-specific fields with AnimatePresence */}
        <AnimatePresence mode="wait">
          {selectedRole === "player" && (
            <motion.div
              key="player-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800 font-display">Informations joueur</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="position" className="mb-1 block text-sm text-gray-700">Poste</label>
                    <select id="position" {...register("position")} className={selectClass}>
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
                    <select id="skillLevel" {...register("skillLevel")} className={selectClass}>
                      <option value="">Non spécifié</option>
                      <option value="beginner">Débutant</option>
                      <option value="amateur">Amateur</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {selectedRole === "manager" && (
            <motion.div
              key="manager-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-800 font-display">Informations manager</p>
                <div>
                  <label htmlFor="teamName" className="mb-1 block text-sm text-gray-700">Nom de votre équipe</label>
                  <input
                    id="teamName"
                    {...register("teamName")}
                    className={inputClassNoIcon}
                    placeholder="FC Mon Équipe"
                  />
                  {errors.teamName && (
                    <p className="mt-1 text-xs text-red-600">{errors.teamName.message}</p>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {selectedRole === "referee" && (
            <motion.div
              key="referee-fields"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl border-2 border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-semibold text-purple-800 font-display">Informations arbitre</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="licenseNumber" className="mb-1 block text-sm text-gray-700">N° licence</label>
                    <input
                      id="licenseNumber"
                      {...register("licenseNumber")}
                      className={inputClassNoIcon}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div>
                    <label htmlFor="licenseLevel" className="mb-1 block text-sm text-gray-700">Niveau</label>
                    <select id="licenseLevel" {...register("licenseLevel")} className={selectClass}>
                      <option value="">Non spécifié</option>
                      <option value="trainee">Stagiaire</option>
                      <option value="regional">Régional</option>
                      <option value="national">National</option>
                      <option value="international">International</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="experienceYears" className="mb-1 block text-sm text-gray-700">Années d&apos;expérience</label>
                  <input
                    id="experienceYears"
                    type="number"
                    min="0"
                    {...register("experienceYears")}
                    className={inputClassNoIcon}
                    placeholder="0"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Créer mon compte
        </button>
      </form>

      <div className="mt-8 space-y-2 text-center text-sm">
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
    </motion.div>
  );
}
