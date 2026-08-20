import { ListOrdered, Trophy } from "lucide-react";
import type { WorldStandingsGroup } from "@/lib/football-data";

// ============================================
// WorldStandingsTable
//
// The provider's table, rendered as-is: positions come ranked from the API, so
// nothing is recomputed here (unlike the Koppafoot standings, which are derived
// from match documents). One section per group for cups, a single unlabelled
// table for leagues.
//
// Server-safe: no client hooks, no motion — this is the page's SEO payload and
// must be in the initial HTML.
// ============================================

const formatDiff = (diff: number) => (diff > 0 ? `+${diff}` : `${diff}`);

export default function WorldStandingsTable({ groups }: { groups: WorldStandingsGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-200">
          <ListOrdered size={32} />
        </div>
        <p className="text-sm font-bold text-gray-400 italic">
          Pas encore de classement pour cette saison.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => (
        <section
          key={group.group ?? `table-${gi}`}
          className="overflow-hidden"
        >
          {group.group && (
            <div className="flex items-center gap-2 border-b border-gray-200/70 px-5 py-4">
              <Trophy size={16} className="text-emerald-500" />
              <h3 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
                {group.group}
              </h3>
            </div>
          )}

          {/* Horizontally scrollable on small screens. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-3 text-center">#</th>
                  <th className="px-3 py-3 text-left">Équipe</th>
                  <th className="px-2 py-3 text-center" title="Joués">J</th>
                  <th className="px-2 py-3 text-center" title="Gagnés">G</th>
                  <th className="px-2 py-3 text-center" title="Nuls">N</th>
                  <th className="px-2 py-3 text-center" title="Perdus">P</th>
                  <th className="px-2 py-3 text-center" title="Buts pour">BP</th>
                  <th className="px-2 py-3 text-center" title="Buts contre">BC</th>
                  <th className="px-2 py-3 text-center" title="Différence de buts">Diff</th>
                  <th className="px-3 py-3 text-center" title="Points">Pts</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.team.id} className="border-t border-gray-200/70">
                    <td className="px-3 py-3 text-center">
                      <span className="flex h-6 w-6 items-center justify-center bg-gray-100 text-xs font-black text-gray-500">
                        {row.position}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        {row.team.crest ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.team.crest}
                            alt=""
                            className="h-7 w-7 shrink-0 object-contain"
                          />
                        ) : (
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-gray-50 text-[11px] font-black text-gray-400">
                            {row.team.name[0]?.toUpperCase() ?? "?"}
                          </span>
                        )}
                        <span className="truncate font-bold text-gray-900">{row.team.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center font-bold text-gray-500">{row.played}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-500">{row.won}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-500">{row.draw}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-500">{row.lost}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-500">{row.goalsFor}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-500">{row.goalsAgainst}</td>
                    <td className="px-2 py-3 text-center font-bold text-gray-700">
                      {formatDiff(row.goalDifference)}
                    </td>
                    <td className="px-3 py-3 text-center text-base font-black text-gray-900">
                      {row.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
