import Link from "next/link";
import { Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { PastilleNote } from "@/components/classement/LigneDeClassement";

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
 *
 * SUR UNE FICHE DE MATCH, UN VISAGE ET UNE NOTE. Le bandeau n'avait qu'un nom
 * sous un trophée, alors que le produit connaît la photo du joueur et calcule
 * sa note du match : les deux disent pourquoi c'est lui, en un coup d'œil. La
 * note vient avec le nombre de faits qui la fondent, jamais seule (voir
 * lib/notes). Sans `photo` — le meilleur joueur d'un tournoi —, le trophée
 * garde sa place.
 */
export default function MvpDuMatch({
  name,
  teamName,
  label = "Homme du match",
  photo,
  motif,
  note,
  href,
}: {
  name: string | null | undefined;
  teamName: string | null | undefined;
  /** « Meilleur joueur du tournoi » à l'échelle d'une compétition. */
  label?: string;
  /**
   * Le visage du joueur. `null` : on n'en a pas, et ses initiales le
   * remplacent. Absent : ce n'est pas une fiche de match, le trophée reste.
   */
  photo?: string | null;
  /** « 2 buts · 1 passe », à la suite de l'équipe. */
  motif?: string | null;
  /** Sa note du match, et combien de faits la fondent. */
  note?: { valeur: number | null; faits: number } | null;
  /** Sa fiche, quand il a un compte. */
  href?: string | null;
}) {
  if (!name) return null;

  const visage = photo !== undefined;
  const ligne = [teamName, motif].filter(Boolean).join(" · ");
  const nom = <span className="block truncate font-display text-lg font-black text-gray-900">{name}</span>;

  return (
    <div className="flex items-center gap-3.5 border border-amber-200/70 bg-amber-50/40 p-3.5 sm:gap-4 sm:p-4">
      {visage ? (
        <div className="relative shrink-0">
          <PlayerAvatar name={name} photo={photo} size={52} />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center bg-amber-400 text-white ring-2 ring-white">
            <Trophy size={11} />
          </span>
        </div>
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-amber-400 text-white">
          <Trophy size={20} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-amber-600">
          {label}
        </p>
        {href ? (
          <Link href={href} className="mt-0.5 block min-w-0 hover:[&>span]:text-emerald-700">
            {nom}
          </Link>
        ) : (
          <div className="mt-0.5">{nom}</div>
        )}
        {ligne && <p className="truncate text-xs font-semibold text-gray-500">{ligne}</p>}
      </div>
      {note && note.valeur !== null && (
        <div
          className="flex shrink-0 flex-col items-center gap-1"
          aria-label={`Note du match ${String(note.valeur).replace(".", ",")}, sur ${note.faits} fait${note.faits > 1 ? "s" : ""}`}
        >
          <PastilleNote note={note.valeur} />
          <span aria-hidden className="text-[9px] font-black uppercase tracking-wide text-gray-400">
            {note.faits} fait{note.faits > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  );
}
