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

const ROLES: { value: SignupRole; label: string; icon: typeof Users; description: string; gradient: string; bgSelected: string; borderSelected: string; iconSelected: string }[] = [
  {
    value: "player",
    label: "Joueur",
    icon: Users,
    description: "Rejoindre des matchs et des équipes",
    gradient: "from-emerald-400 to-emerald-600",
    bgSelected: "bg-emerald-500/15",
    borderSelected: "border-emerald-500/50",
    iconSelected: "text-emerald-400",
  },
  {
    value: "manager",
    label: "Manager",
    icon: Shield,
    description: "Créer et gérer une équipe",
    gradient: "from-blue-400 to-blue-600",
    bgSelected: "bg-blue-500/15",
    borderSelected: "border-blue-500/50",
    iconSelected: "text-blue-400",
  },
  {
    value: "referee",
    label: "Arbitre",
    icon: Award,
    description: "Arbitrer des matchs",
    gradient: "from-purple-400 to-purple-600",
    bgSelected: "bg-purple-500/15",
    borderSelected: "border-purple-500/50",
    iconSelected: "text-purple-400",
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

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all backdrop-blur-sm";
const inputClassNoIcon =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all backdrop-blur-sm";
const selectClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all [&>option]:bg-[#1A1715] [&>option]:text-white";

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
      <h2 className="mb-1 text-2xl font-black text-white font-display">Créer un compte</h2>
      <p className="mb-8 text-sm text-white/40">Rejoins la communauté KOPPAFOOT</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Role selection */}
        <div>
          <label className="mb-3 block text-xs font-medium text-white/50">Je suis...</label>
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
                      : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.05]"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500"
                    >
                      <Check size={12} className="text-white" />
                    </motion.div>
                  )}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${isSelected ? role.bgSelected : "bg-white/[0.06]"}`}>
                    <Icon size={18} className={isSelected ? role.iconSelected : "text-white/30"} />
                  </div>
                  <span className={`text-sm font-semibold ${isSelected ? "text-white" : "text-white/50"}`}>{role.label}</span>
                  <span className="text-[10px] text-white/30 leading-tight">{role.description}</span>
                </motion.button>
              );
            })}
          </div>
          {errors.userType && (
            <p className="mt-1 text-xs text-red-400">{errors.userType.message}</p>
          )}
        </div>

        {/* Common fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className="mb-1.5 block text-xs font-medium text-white/50">Prénom</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                id="firstName"
                {...register("firstName")}
                className={inputClass}
                placeholder="Prénom"
              />
            </div>
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-400">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="lastName" className="mb-1.5 block text-xs font-medium text-white/50">Nom</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                id="lastName"
                {...register("lastName")}
                className={inputClass}
                placeholder="Nom"
              />
            </div>
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-400">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="signupEmail" className="mb-1.5 block text-xs font-medium text-white/50">Email</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
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
            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="signupPhone" className="mb-1.5 block text-xs font-medium text-white/50">
            Téléphone <span className="text-white/20">(optionnel)</span>
          </label>
          <div className="relative">
            <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
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
          <label htmlFor="locationCity" className="mb-1.5 block text-xs font-medium text-white/50">Ville</label>
          <div className="relative">
            <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              id="locationCity"
              {...register("locationCity")}
              className={inputClass}
              placeholder="Paris, Lyon, Marseille..."
            />
          </div>
          {errors.locationCity && (
            <p className="mt-1 text-xs text-red-400">{errors.locationCity.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="signupPassword" className="mb-1.5 block text-xs font-medium text-white/50">Mot de passe</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
            <input
              id="signupPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...register("password")}
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.06] py-3 pl-11 pr-11 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all backdrop-blur-sm"
              placeholder="Min. 6 caractères"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-medium text-white/50">Confirmer le mot de passe</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
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
            <p className="mt-1 text-xs text-red-400">{errors.confirmPassword.message}</p>
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
              <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4">
                <p className="text-sm font-semibold text-emerald-400 font-display">Informations joueur</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="position" className="mb-1.5 block text-xs text-white/40">Poste</label>
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
                    <label htmlFor="skillLevel" className="mb-1.5 block text-xs text-white/40">Niveau</label>
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
              <div className="space-y-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-4">
                <p className="text-sm font-semibold text-blue-400 font-display">Informations manager</p>
                <div>
                  <label htmlFor="teamName" className="mb-1.5 block text-xs text-white/40">Nom de votre équipe</label>
                  <input
                    id="teamName"
                    {...register("teamName")}
                    className={inputClassNoIcon}
                    placeholder="FC Mon Équipe"
                  />
                  {errors.teamName && (
                    <p className="mt-1 text-xs text-red-400">{errors.teamName.message}</p>
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
              <div className="space-y-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.06] p-4">
                <p className="text-sm font-semibold text-purple-400 font-display">Informations arbitre</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="licenseNumber" className="mb-1.5 block text-xs text-white/40">N° licence</label>
                    <input
                      id="licenseNumber"
                      {...register("licenseNumber")}
                      className={inputClassNoIcon}
                      placeholder="Optionnel"
                    />
                  </div>
                  <div>
                    <label htmlFor="licenseLevel" className="mb-1.5 block text-xs text-white/40">Niveau</label>
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
                  <label htmlFor="experienceYears" className="mb-1.5 block text-xs text-white/40">Années d&apos;expérience</label>
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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Créer mon compte
        </button>
      </form>

      <div className="mt-8 space-y-2 text-center text-sm">
        <p className="text-white/30">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-emerald-400/80 hover:text-emerald-400 transition-colors">
            Se connecter
          </Link>
        </p>
        <p className="text-white/30">
          Vous gérez un terrain ?{" "}
          <Link href="/signup/venue-owner" className="font-medium text-emerald-400/80 hover:text-emerald-400 transition-colors">
            Inscription propriétaire
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
