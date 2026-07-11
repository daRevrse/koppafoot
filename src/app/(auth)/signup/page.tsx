"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2, Mail, Lock, Phone, MapPin, User } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";

// ============================================
// Validation schema
// ============================================
// Post-pivot: single account type. Everyone signs up as a simple member
// (stored as "player" — the technical default); organizer / live-ops /
// superadmin are granted by promotion.

const schema = yup.object({
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
});

type FormData = yup.InferType<typeof schema>;

// ============================================
// Input styling
// ============================================

const inputClass =
  "w-full rounded-xl border border-white/[0.1] bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all backdrop-blur-sm";

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
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await signupWithEmail({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        userType: "player",
        locationCity: data.locationCity,
        phone: data.phone,
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
      <p className="mb-8 text-sm text-white/40">
        Suis tes compétitions en direct et rejoins la communauté KOPPAFOOT
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
              placeholder="+22890123456"
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
              placeholder="Lomé, Abidjan, Cotonou..."
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

        <button
          type="submit"
          disabled={submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-400 disabled:opacity-50 transition-all hover:shadow-[0_0_24px_rgba(16,185,129,0.25)]"
        >
          {submitting && <Loader2 size={16} className="animate-spin" />}
          Créer mon compte
        </button>
      </form>

      <div className="mt-8 text-center text-sm">
        <p className="text-white/30">
          Déjà un compte ?{" "}
          <Link href="/login" className="font-medium text-emerald-400/80 hover:text-emerald-400 transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
