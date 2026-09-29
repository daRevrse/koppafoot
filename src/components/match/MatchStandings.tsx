"use client";

import MiniEcusson from "@/components/match/MiniEcusson";
import type { GroupStanding } from "@/lib/competition-firestore";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { COLONNES_CLASSEMENT } from "@/i18n/foot";

const T = textes({ poule: (g: string) => `Poule ${g}` }, { poule: (g: string) => `Group ${g}` });

// ============================================
// Le classement, réduit à la poule des deux équipes qui jouent.
//
// L'onglet déroulait TOUTES les poules de la compétition, l'une sous l'autre.
// Sur une CAN à six groupes, cela faisait six tableaux à faire défiler pour
// trouver celui des deux équipes affichées trois centimètres plus haut. Un
// classement lu depuis une fiche de match répond à une question précise :
// « où en sont ces deux-là ? »
//
// LES DEUX ÉQUIPES SONT MISES EN ÉVIDENCE, et elles seules : c'est la seule
// raison de lire ce tableau ici.
//
// Il n'y a rien à afficher, et l'onglet ne s'ouvre donc pas, quand :
//  - le match est un amical, il n'appartient à aucun classement ;
//  - le match est une phase finale, un huitième ne se joue pas au nombre de
//    points, et le classement qui y a mené n'explique plus rien ;
//  - les deux équipes ne partagent aucune poule renseignée.
// ============================================

/**
 * La poule qui contient les deux équipes, ou `null`.
 *
 * On exige les DEUX : une poule qui ne contiendrait qu'un des deux camps ne
 * répond pas à la question posée depuis cette page.
 */
export function pouleDuMatch(
  groups: GroupStanding[],
  homeTeamId: string | null,
  awayTeamId: string | null,
): GroupStanding | null {
  if (!homeTeamId || !awayTeamId) return null;
  return (
    groups.find(
      (g) =>
        g.rows.some((r) => r.team.id === homeTeamId) &&
        g.rows.some((r) => r.team.id === awayTeamId),
    ) ?? null
  );
}

export default function MatchStandings({
  groupe, homeTeamId, awayTeamId, compact = false,
}: {
  groupe: GroupStanding;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /**
   * Pour la colonne étroite du fil, sur grand écran : G, N et P y restent
   * cachés quelle que soit la largeur de l'écran, comme sur téléphone.
   */
  compact?: boolean;
}) {
  const detail = compact ? "hidden" : "hidden sm:table-cell";
  const t = useTextes(T);
  const c = useTextes(COLONNES_CLASSEMENT);
  return (
    <div>
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
        {t.poule(groupe.group)}
      </h3>
      {/* G, N et P disparaissent sous `sm`. Les sept colonnes forçaient un
          défilement horizontal sur un téléphone, et la colonne qui sortait de
          l'écran était PTS — celle pour laquelle on ouvre un classement.
          Restent le nombre de matchs, la différence de buts et les points :
          de quoi lire un classement, sans faire glisser le tableau. */}
      {/* LES CHIFFRES À LEUR LARGEUR, L'ÉQUIPE AU RESTE. En disposition
          automatique, le tableau partageait l'écran entre ses colonnes, et
          « Étoile d'Adidogomé » était coupé à côté d'un « J » qui occupait
          le quart de la ligne pour un seul chiffre. */}
      <table className={`w-full table-fixed ${compact ? "text-[13px]" : "text-sm"}`}>
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">
            <th className="py-1.5 pr-2 text-left font-black">{c.equipe}</th>
            <th className="w-8 px-1 py-1.5 text-right font-black" title={c.jTitre}>{c.j}</th>
            <th className={`${detail} w-8 px-1 py-1.5 text-right font-black`} title={c.gTitre}>{c.g}</th>
            <th className={`${detail} w-8 px-1 py-1.5 text-right font-black`} title={c.nTitre}>{c.n}</th>
            <th className={`${detail} w-8 px-1 py-1.5 text-right font-black`} title={c.pTitre}>{c.p}</th>
            <th className="w-12 px-1 py-1.5 text-right font-black" title={c.diffTitre}>{c.diff}</th>
            <th className="w-10 py-1.5 pl-1 text-right font-black" title={c.ptsTitre}>{c.pts}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200/70">
          {groupe.rows.map((row, i) => {
            const concerne = row.team.id === homeTeamId || row.team.id === awayTeamId;
            return (
              <tr key={row.team.id} className={concerne ? "bg-emerald-50/70" : undefined}>
                <td className="py-2 pr-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-right text-[11px] font-black tabular-nums text-gray-400">
                      {i + 1}
                    </span>
                    <MiniEcusson nom={row.team.name} logo={row.team.logoUrl} taille={18} />
                    <span className={`truncate ${concerne ? "font-black text-gray-900" : "font-bold text-gray-600"}`}>
                      {row.team.name}
                    </span>
                  </span>
                </td>
                <td className="px-1 py-2 text-right tabular-nums text-gray-500">{row.played}</td>
                <td className={`${detail} px-1 py-2 text-right tabular-nums text-gray-500`}>{row.won}</td>
                <td className={`${detail} px-1 py-2 text-right tabular-nums text-gray-500`}>{row.drawn}</td>
                <td className={`${detail} px-1 py-2 text-right tabular-nums text-gray-500`}>{row.lost}</td>
                <td className="px-1 py-2 text-right tabular-nums text-gray-500">
                  {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                </td>
                <td className="py-2 pl-1 text-right font-black tabular-nums text-gray-900">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
