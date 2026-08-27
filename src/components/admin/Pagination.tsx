"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// ============================================
// La pagination des listes de l'administration.
//
// Les tableaux rendaient d'un bloc tout ce que la requête ramenait : trois
// cents équipes, deux cents comptes, autant de lignes dans le DOM et un
// défilement sans fin pour atteindre la dernière. Le découpage est local — les
// données sont déjà chargées, on ne change que ce qui est peint.
//
// CE QUE ÇA NE RÉSOUT PAS, et il vaut mieux le dire ici que le découvrir : le
// plafond de la requête reste. Au-delà, la page ne montre rien parce que rien
// n'a été lu, pas parce que la pagination s'arrête. Le jour où la plateforme
// dépassera ces volumes, il faudra des curseurs Firestore, pas un découpage
// plus fin.
// ============================================

/** Découpe une liste et rend la tranche courante, avec le pied de page. */
export function usePagination<T>(items: T[], parPage = 25) {
  const [pageChoisie, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / parPage));

  // Un filtre qui raccourcit la liste peut laisser la page choisie au-delà de
  // la fin : on affiche alors du vide, sans rien pour en sortir. On la ramène
  // AU CALCUL et non depuis un effet — corriger après coup provoque un rendu
  // en cascade, et l'éclair de liste vide qui va avec.
  const page = Math.min(pageChoisie, pages);

  const tranche = useMemo(
    () => items.slice((page - 1) * parPage, page * parPage),
    [items, page, parPage],
  );

  return { page, setPage, pages, tranche, total: items.length, parPage };
}

interface Props {
  page: number;
  pages: number;
  total: number;
  parPage: number;
  onPage: (p: number) => void;
  /** Ce qu'on compte, au singulier : « équipe », « compte », « match ». */
  nom: string;
}

export default function Pagination({ page, pages, total, parPage, onPage, nom }: Props) {
  if (total === 0) return null;

  const premier = (page - 1) * parPage + 1;
  const dernier = Math.min(page * parPage, total);

  // Une fenêtre de pages autour de la courante : au-delà d'une dizaine, une
  // rangée de boutons numérotés devient elle-même illisible.
  const fenetre: number[] = [];
  const debut = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = debut; i <= Math.min(pages, debut + 4); i++) fenetre.push(i);

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200/70 px-4 py-3 sm:flex-row">
      <p className="text-xs font-medium text-gray-500">
        {premier}–{dernier} sur {total} {nom}{total > 1 ? "s" : ""}
      </p>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            aria-label="Page précédente"
            className="flex h-8 w-8 items-center justify-center border border-gray-200/70 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft size={15} />
          </button>

          {debut > 1 && <span className="px-1 text-xs text-gray-300">…</span>}

          {fenetre.map((p) => (
            <button
              key={p}
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={`h-8 min-w-8 px-2 text-xs font-bold transition-colors ${
                p === page
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200/70 text-gray-500 hover:bg-gray-50"
              }`}
            >
              {p}
            </button>
          ))}

          {debut + 4 < pages && <span className="px-1 text-xs text-gray-300">…</span>}

          <button
            onClick={() => onPage(page + 1)}
            disabled={page === pages}
            aria-label="Page suivante"
            className="flex h-8 w-8 items-center justify-center border border-gray-200/70 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
