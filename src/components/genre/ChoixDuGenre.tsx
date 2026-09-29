"use client";

import { useLangue } from "@/i18n";
import { GENRES, LIBELLES_GENRE, type Genre } from "@/lib/genre";

// ============================================
// « Tu es : Homme / Femme », en deux pastilles.
//
// Le même geste partout où on le demande — activation d'un rôle,
// inscription, profil, rappel aux comptes à rôle — pour qu'il se reconnaisse
// d'un écran à l'autre. Deux boutons plutôt qu'une liste : il n'y a que deux
// réponses, et un menu déroulant cache celle qu'on cherche.
// ============================================

export default function ChoixDuGenre({
  valeur,
  onChange,
  erreur = false,
  sombre = false,
}: {
  valeur: Genre | null | undefined;
  onChange: (g: Genre) => void;
  /** Rouge autour des deux : on a essayé de valider sans répondre. */
  erreur?: boolean;
  sombre?: boolean;
}) {
  const { langue } = useLangue();
  return (
    <div role="radiogroup" className="flex gap-2">
      {GENRES.map((g) => {
        const actif = valeur === g;
        return (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(g)}
            className={`flex-1 border px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition-colors ${
              actif
                ? sombre
                  ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                  : "border-gray-900 bg-gray-900 text-white"
                : erreur
                  ? "border-red-300 text-gray-600 hover:border-gray-900 hover:text-gray-900"
                  : sombre
                    ? "border-white/15 text-white/70 hover:border-white hover:text-white"
                    : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
            }`}
          >
            {LIBELLES_GENRE[langue][g]}
          </button>
        );
      })}
    </div>
  );
}
