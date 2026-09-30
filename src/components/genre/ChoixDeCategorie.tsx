"use client";

import { CATEGORIES, LIBELLES_CATEGORIE, type Categorie } from "@/lib/genre";

// ============================================
// Masculin / Féminin / Mixte, pour une équipe ou une compétition.
//
// Trois pastilles, comme le genre d'une personne : il n'y a que trois
// réponses, et on doit les voir toutes pour choisir la bonne.
// ============================================

export default function ChoixDeCategorie({
  valeur,
  onChange,
}: {
  valeur: Categorie | null | undefined;
  onChange: (c: Categorie) => void;
}) {
  return (
    <div role="radiogroup" className="flex gap-2">
      {CATEGORIES.map((c) => {
        const actif = valeur === c;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={actif}
            onClick={() => onChange(c)}
            className={`flex-1 border px-3 py-2.5 text-[11px] font-black uppercase tracking-[0.1em] transition-colors ${
              actif
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
            }`}
          >
            {LIBELLES_CATEGORIE.fr[c]}
          </button>
        );
      })}
    </div>
  );
}
