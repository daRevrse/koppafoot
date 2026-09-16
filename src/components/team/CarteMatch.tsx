import Link from "next/link";
import { MapPin } from "lucide-react";
import MiniEcusson from "@/components/match/MiniEcusson";
import TirsAuBut from "@/components/match/TirsAuBut";
import { libelleDuJour } from "@/lib/dates";
import type { Match } from "@/types";

// ============================================
// L'AFFICHE D'UN MATCH, DANS LA LISTE D'UNE ÉQUIPE.
//
// CE QU'ELLE REMPLACE. L'onglet Matchs d'une équipe posait une ligne de texte :
// « FC ARCHIMEDE 0 - 0 FC Koppa », suivie de « 2026-09-05 ». Trois défauts, et
// aucun n'est cosmétique :
//
//   — ON NE VOYAIT PAS QUI JOUE. Deux noms dans une phrase demandent qu'on les
//     LISE pour savoir qui reçoit ; une affiche se regarde. Les écussons
//     existaient déjà sur le match, personne ne les montrait ici.
//
//   — LA DATE ÉTAIT CELLE DE LA BASE. « 2026-09-05 » est un format de
//     stockage. On dit « Demain », « sam. 5 sept. » — et les deux premiers
//     jours valent mieux qu'une date, puisqu'on ne compte pas les jours pour
//     savoir si un match est demain.
//
//   — LA CARTE N'ÉTAIT PAS CLIQUABLE. C'est le défaut le plus coûteux : une
//     liste de matchs dont aucun ne s'ouvre. La fiche du match existe, elle
//     porte le fil, la compo et les statistiques, et rien n'y menait depuis
//     l'équipe qui l'a joué.
//
// UNE SEULE CARTE POUR LES DEUX LISTES. « À venir » et « Terminés » posaient
// chacune sa propre mise en page, à quelques mots près — et elles divergeaient
// déjà : la première montrait le lieu avec son icône, la seconde le format
// sans lui. Ce qui les sépare vraiment tient en UN endroit, le centre de
// l'affiche : un score quand il y en a un, « VS » sinon.
//
// LES DEUX CAMPS SONT SYMÉTRIQUES, y compris sur la page de l'un d'eux. On
// pourrait vouloir mettre en avant l'équipe dont on consulte la fiche : ce
// serait se tromper de question. Ce qu'on cherche en parcourant cette liste,
// c'est le résultat — et c'est la pastille de droite qui le dit, en un mot.
// ============================================

/** Ce que la carte sait lire d'un match. */
type MatchAffiche = Pick<
  Match,
  | "id" | "date" | "time" | "venueName" | "status"
  | "homeTeamName" | "awayTeamName" | "scoreHome" | "scoreAway" | "result"
> & {
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  penaltyHome?: number | null;
  penaltyAway?: number | null;
  format?: string;
  playersConfirmed?: number;
  playersTotal?: number;
};

const LIBELLE_RESULTAT: Record<string, string> = {
  win: "Victoire",
  loss: "Défaite",
  draw: "Nul",
};

const TON_RESULTAT: Record<string, string> = {
  win: "bg-emerald-50 text-emerald-700 border-emerald-200",
  loss: "bg-red-50 text-red-700 border-red-200",
  draw: "bg-gray-50 text-gray-600 border-gray-200/70",
};

/** Un camp de l'affiche : l'écusson vers l'extérieur, le nom vers le centre. */
function Camp({
  nom, logo, droite,
}: {
  nom: string;
  logo: string | null;
  /** Le camp extérieur, dont l'ordre s'inverse pour faire face à l'autre. */
  droite?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${
        droite ? "flex-row-reverse text-right" : ""
      }`}
    >
      <MiniEcusson nom={nom} logo={logo} taille={28} className="text-gray-400" />
      <span className="min-w-0 truncate text-[13px] font-black uppercase leading-tight tracking-tight text-gray-900">
        {nom}
      </span>
    </div>
  );
}

export default function CarteMatch({ match }: { match: MatchAffiche }) {
  const termine = match.status === "completed";
  const enDirect = match.status === "live";
  const scoreConnu = match.scoreHome != null && match.scoreAway != null;

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block border border-gray-200/70 bg-white transition-colors hover:border-gray-300 hover:bg-gray-50/60"
    >
      {/* Le bandeau de la carte : QUAND à gauche, OÙ à droite. Les deux se
          lisent avant l'affiche, et jamais pendant — d'où le gris pâle. */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 px-3 py-1.5">
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
          {enDirect ? (
            <>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-red-600">En direct</span>
            </>
          ) : (
            <>
              {libelleDuJour(match.date)}
              {match.time && <span className="text-gray-300">·</span>}
              {match.time}
            </>
          )}
        </span>
        {match.venueName && (
          <span className="flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{match.venueName}</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-3">
        <Camp nom={match.homeTeamName} logo={match.homeTeamLogo ?? null} />

        {/* LE CENTRE EST LA SEULE CHOSE QUI CHANGE d'une liste à l'autre : le
            score quand il existe, « VS » tant qu'il n'a pas été joué. */}
        <div className="flex shrink-0 flex-col items-center px-1">
          {termine || (enDirect && scoreConnu) ? (
            <>
              <span className="text-lg font-black leading-none tracking-tighter tabular-nums text-gray-900">
                {match.scoreHome ?? 0} <span className="text-gray-300">–</span> {match.scoreAway ?? 0}
              </span>
              <TirsAuBut home={match.penaltyHome ?? null} away={match.penaltyAway ?? null} className="mt-0.5" />
            </>
          ) : (
            <span className="text-[11px] font-black uppercase tracking-widest text-gray-300">
              VS
            </span>
          )}
        </div>

        <Camp nom={match.awayTeamName} logo={match.awayTeamLogo ?? null} droite />
      </div>

      {/* Ce qui ne concerne qu'une des deux listes : le verdict d'un match
          joué, le compte des présents pour un match qui ne l'est pas. */}
      {(match.result && termine) || (!termine && match.playersTotal) ? (
        <div className="flex items-center justify-end gap-1.5 border-t border-gray-200/70 px-3 py-1.5">
          {termine && match.result && (
            <span
              className={`border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                TON_RESULTAT[match.result] ?? TON_RESULTAT.draw
              }`}
            >
              {LIBELLE_RESULTAT[match.result] ?? match.result}
            </span>
          )}
          {!termine && match.format && (
            <span className="border border-gray-200/70 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
              {match.format}
            </span>
          )}
          {!termine && match.playersTotal ? (
            <span className="border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider tabular-nums text-amber-700">
              {match.playersConfirmed ?? 0}/{match.playersTotal} présents
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
