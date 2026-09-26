import Link from "next/link";
import { ArrowDown, ArrowUp, Footprints, Goal, Hand, ShieldCheck } from "lucide-react";
import { FOND_NOTE } from "@/components/forme/badges";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { formaterNote, tonNote } from "@/lib/notes";
import type { LigneJoueurPubliee, TriClassement } from "@/lib/classement";

// ============================================
// Une ligne du classement des joueurs — la même sur l'accueil et sur la page
// complète. La carte de l'accueil recopiait la ligne de la page, à quelques
// classes près : deux dessins d'une même ligne dérivent au premier retouche.
//
// UN JOUEUR ET UN GARDIEN SE LISENT DIFFÉREMMENT, DANS LA MÊME LISTE. Ils
// sont classés sur la même note (voir lib/classement) ; ce qui change, c'est
// le détail sous le nom — ce qui a fait la note. Des buts et des passes pour
// un joueur de champ, des arrêts et des matchs sans but encaissé pour un
// gardien, qui porte en plus son étiquette : on ne cherche pas à deviner qui
// garde les buts dans une liste de cent noms.
// ============================================

/** Le podium se voit : or, argent, bronze ; le reste se tait. */
const TEINTE_RANG: Record<number, string> = {
  1: "text-amber-500",
  2: "text-gray-500",
  3: "text-orange-700",
};

/**
 * La flèche : ce que le joueur a gagné ou perdu depuis le calcul précédent.
 *
 * Rien du tout sur une entrée nouvelle. Elle n'a pas grimpé de vingt places,
 * elle vient d'arriver, et une flèche verte géante le raconterait de travers.
 */
export function MouvementBadge({ mouvement }: { mouvement: number | null }) {
  if (mouvement === null) return <span className="w-9 shrink-0" />;
  if (mouvement === 0) {
    return (
      <span className="flex w-9 shrink-0 items-center justify-center text-[11px] font-black text-gray-300">
        –
      </span>
    );
  }
  const monte = mouvement > 0;
  return (
    <span
      className={`flex w-9 shrink-0 items-center justify-center gap-0.5 rounded-full py-0.5 text-[11px] font-black tabular-nums ${
        monte ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
      }`}
    >
      {monte ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {Math.abs(mouvement)}
    </span>
  );
}

/** La note, dans la couleur de la console : une note se lit pareil partout. */
export function PastilleNote({ note, petite = false }: { note: number | null; petite?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center font-black tabular-nums ${
        petite ? "h-5 w-7 text-[10px]" : "h-7 w-10 text-[13px]"
      } ${FOND_NOTE[tonNote(note)]}`}
    >
      {formaterNote(note)}
    </span>
  );
}

export default function LigneDeClassement({
  ligne,
  tri,
  compacte = false,
}: {
  ligne: LigneJoueurPubliee;
  tri: TriClassement;
  /** Sur l'accueil : sans la frise des notes ni le club, qui n'y ont pas la place. */
  compacte?: boolean;
}) {
  const rang = (tri === "note" ? ligne.rangNote : ligne.rangContribution) ?? 0;
  const mouvement = tri === "note" ? ligne.mouvementNote : ligne.mouvementContribution;
  // Du plus ancien au plus récent : le sens d'une frise, le dernier à droite.
  const frise = [...ligne.notes].reverse();

  const nom = ligne.uid ? (
    <Link href={`/profile/${ligne.uid}`} className="truncate text-[13px] font-black text-gray-900 hover:text-emerald-700">
      {ligne.nom}
    </Link>
  ) : (
    <span className="truncate text-[13px] font-black text-gray-900">{ligne.nom}</span>
  );

  return (
    <div className="flex items-center gap-3 border-t border-gray-200/70 px-4 py-2.5 first:border-0">
      <span className={`w-6 shrink-0 text-center text-[12px] font-black tabular-nums ${TEINTE_RANG[rang] ?? "text-gray-300"}`}>
        {rang}
      </span>

      <PlayerAvatar name={ligne.nom} photo={ligne.photo} size={32} />

      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-1.5">
          {nom}
          {/* « G » sur un téléphone : l'étiquette entière y coupait le nom
              du gardien, qui est ce qu'on vient lire. */}
          {ligne.gardien && (
            <span
              title="Gardien de but"
              className="shrink-0 border border-sky-200 bg-sky-50 px-1 py-px text-[9px] font-black uppercase tracking-wide text-sky-700"
            >
              <span className="sm:hidden">G</span>
              <span className="hidden sm:inline">Gardien</span>
            </span>
          )}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-2.5 text-[11px] font-black tabular-nums text-gray-500">
          {ligne.gardien ? (
            <>
              <span className="flex shrink-0 items-center gap-1" title="Arrêts">
                {ligne.arrets}
                <Hand size={12} className="text-emerald-600" />
              </span>
              <span className="flex shrink-0 items-center gap-1" title="Matchs sans but encaissé">
                {ligne.cleanSheets}
                <ShieldCheck size={12} className="text-sky-500" />
              </span>
            </>
          ) : (
            <>
              <span className="flex shrink-0 items-center gap-1" title="Buts">
                {ligne.buts}
                <Goal size={12} className="text-emerald-600" />
              </span>
              <span className="flex shrink-0 items-center gap-1" title="Passes décisives">
                {ligne.passes}
                <Footprints size={12} className="text-orange-500" />
              </span>
            </>
          )}
          <span className="shrink-0 font-bold text-gray-300" title="Matchs retenus">{ligne.matchs} m</span>
          {/* Le club, là où il tient : sur un téléphone ou dans la colonne de
              l'accueil, il n'en restait que quatre lettres. */}
          {ligne.equipe && !compacte && (
            <span className="hidden min-w-0 truncate font-semibold text-gray-400 sm:inline">{ligne.equipe}</span>
          )}
        </span>
      </span>

      {/* LA FRISE : les notes des cinq derniers matchs, sur un écran assez
          large pour la tenir. Elle dit si la note tient ou si un seul match
          la porte. */}
      {!compacte && (
        <span className="hidden shrink-0 items-center gap-0.5 sm:flex" aria-label="Notes des derniers matchs">
          {frise.map((n, i) => (
            <PastilleNote key={i} note={n} petite />
          ))}
        </span>
      )}

      {tri === "note" ? (
        <PastilleNote note={ligne.note} />
      ) : (
        <span className="shrink-0 text-[13px] font-black tabular-nums text-gray-900">
          {ligne.total} <span className="text-gray-400">G/A</span>
        </span>
      )}

      <MouvementBadge mouvement={mouvement} />
    </div>
  );
}
