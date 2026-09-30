"use client";

import { useLangue } from "@/i18n";
import { categorieAffichee, LIBELLES_CATEGORIE, type Categorie } from "@/lib/genre";

// ============================================
// « Féminin », « Mixte » à côté d'un nom d'équipe ou de compétition.
//
// Rien pour une catégorie masculine ni pour une catégorie inconnue : c'est ce
// que tout le monde suppose, et un badge sur presque toutes les équipes ne
// distinguerait plus rien (voir `categorieAffichee`).
// ============================================

export default function BadgeCategorie({
  categorie,
  sombre = false,
  className = "",
}: {
  categorie: Categorie | null | undefined;
  /** Sur un bandeau noir ou vert nuit. */
  sombre?: boolean;
  className?: string;
}) {
  const { langue } = useLangue();
  if (!categorieAffichee(categorie)) return null;
  const ton = categorie === "women"
    ? sombre ? "border-pink-300/40 text-pink-200" : "border-pink-200 bg-pink-50 text-pink-700"
    : sombre ? "border-white/25 text-white/80" : "border-violet-200 bg-violet-50 text-violet-700";
  return (
    <span
      className={`inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] ${ton} ${className}`}
    >
      {LIBELLES_CATEGORIE[langue][categorie]}
    </span>
  );
}
