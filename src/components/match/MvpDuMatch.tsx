import { Trophy } from "lucide-react";

/**
 * L'homme du match, quand le scoreur en a désigné un.
 *
 * Un seul composant pour les deux fiches — amical et compétition — parce que
 * c'est la même distinction et qu'elle se lit pareil. Ce qui diffère entre les
 * deux vit dans la collection, pas à l'écran. Et pour le meilleur joueur d'un
 * tournoi, qui est le même objet une échelle au-dessus : seul le libellé
 * change.
 *
 * RIEN QUAND IL N'Y EN A PAS. Un match sans homme du match est un cas normal :
 * le scoreur peut siffler la fin sans désigner, et un bandeau vide annoncerait
 * un manque là où il n'y a qu'une absence de geste.
 */
export default function MvpDuMatch({
  name,
  teamName,
  label = "Homme du match",
}: {
  name: string | null | undefined;
  teamName: string | null | undefined;
  /** « Meilleur joueur du tournoi » à l'échelle d'une compétition. */
  label?: string;
}) {
  if (!name) return null;

  return (
    <div className="flex items-center gap-4 border border-amber-200/70 bg-amber-50/40 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-amber-400 text-white">
        <Trophy size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-600">
          {label}
        </p>
        <p className="mt-0.5 truncate font-display text-lg font-black text-gray-900">{name}</p>
        {teamName && (
          <p className="truncate text-xs font-semibold text-gray-500">{teamName}</p>
        )}
      </div>
    </div>
  );
}
