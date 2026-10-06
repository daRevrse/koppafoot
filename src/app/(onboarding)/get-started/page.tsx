"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { nomPersonne, villeRequise } from "@/lib/champs-valides";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ArrowRight, Loader2, Mail, MapPin, Phone, User } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import type { SignupData } from "@/types";
import MentionConditions from "@/components/auth/MentionConditions";
import {
  EnTeteAuth, classeChampAuth, classeEtiquetteAuth, classeIconeChamp, classeBoutonAuth,
} from "@/components/auth/auth-ui";

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

// Les champs, étiquettes et boutons de la connexion et de l'inscription
// (components/auth/auth-ui) : cet écran est la fin du même tunnel.
const classeErreur = "mt-1.5 text-[11px] font-bold text-red-600";

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

  // Le compte qu'on vient d'ouvrir : l'e-mail de Google, ou le numéro du SMS.
  const identifiant = firebaseUser?.email ?? firebaseUser?.phoneNumber ?? null;
  const IconeIdentifiant = firebaseUser?.email ? Mail : Phone;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <EnTeteAuth
        titre="Bienvenue"
        phrase="Encore une étape : ton nom et ta ville, et ton espace est prêt."
      />

      {identifiant && (
        <div className="mb-6 flex items-center gap-3 border border-gray-200/70 px-4 py-3">
          <IconeIdentifiant size={15} className="shrink-0 text-gray-300" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">Connecté avec</p>
            <p className="truncate text-sm font-semibold text-gray-900">{identifiant}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="firstName" className={classeEtiquetteAuth}>Prénom</label>
            <div className="relative">
              <User size={15} className={classeIconeChamp} />
              <input
                id="firstName"
                autoComplete="given-name"
                {...register("firstName")}
                className={classeChampAuth}
                placeholder="Prénom"
              />
            </div>
            {errors.firstName && <p className={classeErreur}>{errors.firstName.message}</p>}
          </div>
          <div>
            <label htmlFor="lastName" className={classeEtiquetteAuth}>Nom</label>
            <div className="relative">
              <User size={15} className={classeIconeChamp} />
              <input
                id="lastName"
                autoComplete="family-name"
                {...register("lastName")}
                className={classeChampAuth}
                placeholder="Nom"
              />
            </div>
            {errors.lastName && <p className={classeErreur}>{errors.lastName.message}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="locationCity" className={classeEtiquetteAuth}>Ville</label>
          <div className="relative">
            <MapPin size={15} className={classeIconeChamp} />
            <input
              id="locationCity"
              autoComplete="address-level2"
              placeholder="Ta ville"
              {...register("locationCity")}
              className={classeChampAuth}
            />
          </div>
          {errors.locationCity && <p className={classeErreur}>{errors.locationCity.message}</p>}
        </div>

        <button type="submit" disabled={submitting} className={classeBoutonAuth}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Créer mon profil
          {!submitting && <ArrowRight size={16} />}
        </button>
      </form>

      <MentionConditions className="mt-6 text-center" />
    </motion.div>
  );
}
