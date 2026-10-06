"use client";

import { useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { ErreurLimiteOffre, type CleLimite } from "@/lib/offre";

// ============================================
// Le message d'une création refusée par une limite de l'offre gratuite.
//
// Le serveur dit quelle limite (et son plafond), l'écran le dit dans la
// langue de la personne, et propose « Mon offre » : ce qu'elle a, ce que le
// Pro lève. Pas de « Payer » : rien ne s'achète encore.
// ============================================

const T = textes(
  {
    equipes: (max: number) => `Tu gères déjà ${max} équipe${max > 1 ? "s" : ""}, le maximum de l'offre gratuite.`,
    terrains: (max: number) =>
      `Tu as déjà ${max} terrain${max > 1 ? "s" : ""} référencé${max > 1 ? "s" : ""}, le maximum de l'offre gratuite.`,
    competitions: (max: number) =>
      `Tu as déjà ${max} compétition${max > 1 ? "s" : ""} en cours, le maximum de l'offre gratuite. Termine-la ou supprime un brouillon.`,
    equipesParCompetition: (max: number) => `Avec l'offre gratuite, une compétition compte au plus ${max} équipes.`,
    leve: "KoppaFoot Pro lève cette limite.",
    voir: "Voir mon offre",
  },
  {
    equipes: (max: number) => `You already manage ${max} team${max > 1 ? "s" : ""}, the free plan's maximum.`,
    terrains: (max: number) => `You already list ${max} venue${max > 1 ? "s" : ""}, the free plan's maximum.`,
    competitions: (max: number) =>
      `You already run ${max} competition${max > 1 ? "s" : ""}, the free plan's maximum. Finish it or delete a draft.`,
    equipesParCompetition: (max: number) => `On the free plan, a competition has at most ${max} teams.`,
    leve: "KoppaFoot Pro removes this limit.",
    voir: "See my plan",
  },
);

/**
 * `signaler(err)` : si l'erreur est une limite de l'offre, l'annonce et rend
 * `true` ; sinon rend `false`, et l'écran affiche son message habituel.
 */
export function useSignalerLimite(): (err: unknown) => boolean {
  const t = useTextes(T);
  return useCallback((err: unknown) => {
    if (!(err instanceof ErreurLimiteOffre)) return false;
    const phrase = (t[err.cle as CleLimite] as (max: number) => string)(err.max);
    toast.error(
      (toastCourant) => (
        <span className="text-sm">
          {phrase} {t.leve}{" "}
          <Link href="/offre" onClick={() => toast.dismiss(toastCourant.id)} className="font-bold underline">
            {t.voir}
          </Link>
        </span>
      ),
      { duration: 9000 },
    );
    return true;
  }, [t]);
}
