import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Loader2, SearchX, Trophy, ListOrdered } from "lucide-react";
import {
  getCompetitionBySlug,
  onCompMatches,
  onCompTeams,
  computeStandings,
  type StandingRow,
} from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// Helpers
// ============================================

// Team crest: real logo when present, otherwise a first-letter avatar tinted
// with the team color. Mirrors the crest treatment in the public match view,
// scaled down for table rows.
function TeamBadge({ team }: { team: CompTeam }) {
  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50 text-[11px] font-black text-gray-500"
      style={!team.logoUrl && team.color ? { backgroundColor: team.color, color: "#fff" } : undefined}
    >
      {team.logoUrl ? (
        <Image src={team.logoUrl} alt={team.name} width={28} height={28} className="h-full w-full object-cover" />
      ) : (
        <span>{team.name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// Signed goal difference, e.g. +3 / 0 / -2.
const formatDiff = (diff: number) => (diff > 0 ? `+${diff}` : `${diff}`);

// ============================================
// Component
// ============================================

export default function StandingsTab({ competition, matches, teams }: {
  competition: Competition;
  matches: CompMatch[];
  teams: CompTeam[];
}) {
  // Derive standings from the pure helper; never recompute inline.
  const groups = useMemo(
    () => (competition ? computeStandings(matches, teams, competition.format) : []),
    [matches, teams, competition],
  );

  const qualifiers = competition.format.qualifiers_per_group;

  // Une poule a la fois. Empilees, quatre tableaux de six lignes donnaient
  // une page a faire defiler ou l'on perdait de vue celle qu'on lisait ;
  // et sur telephone la deuxieme poule commencait deja hors de l'ecran.
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const active = groups.find((g) => g.group === openGroup) ?? groups[0] ?? null;

  return (
    <div className="space-y-6 pb-20">
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-200">
            <ListOrdered size={32} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">
            Classement vide, aucun groupe ou résultat pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Selecteur de poule, quand il y en a plusieurs. */}
          {groups.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => (
                <button
                  key={g.group}
                  type="button"
                  onClick={() => setOpenGroup(g.group)}
                  className={`border px-4 py-2 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                    active?.group === g.group
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200/70 text-gray-500 hover:border-gray-900 hover:text-gray-900"
                  }`}
                >
                  Poule {g.group}
                </button>
              ))}
            </div>
          )}

          {active && (
            <section key={active.group} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-50 px-5 py-4">
                <Trophy size={16} className="text-emerald-500" />
                <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
                  Groupe {active.group}
                </h2>
              </div>

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
                    {active.rows.map((row: StandingRow, idx) => {
                      const rank = idx + 1;
                      const qualifies = rank <= qualifiers;
                      return (
                        <tr
                          key={row.team.id}
                          className={`border-t border-gray-50 ${
                            qualifies ? "bg-emerald-50/60" : ""
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`relative flex h-6 w-6 items-center justify-center text-xs font-black ${
                                qualifies
                                  ? "bg-emerald-500 text-white"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <TeamBadge team={row.team} />
                              <span
                                className={`truncate font-bold ${
                                  row.team.disqualified
                                    ? "text-gray-400 line-through"
                                    : "text-gray-900"
                                }`}
                              >
                                {row.team.name}
                              </span>
                              {row.team.disqualified && (
                                <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide bg-red-50 text-red-600">
                                  DQ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-3 text-center font-bold text-gray-500">{row.played}</td>
                          <td className="px-2 py-3 text-center font-bold text-gray-500">{row.won}</td>
                          <td className="px-2 py-3 text-center font-bold text-gray-500">{row.drawn}</td>
                          <td className="px-2 py-3 text-center font-bold text-gray-500">{row.lost}</td>
                          <td className="px-2 py-3 text-center font-bold text-gray-500">{row.goalsFor}</td>
                          <td className="px-2 py-3 text-center font-bold text-gray-500">{row.goalsAgainst}</td>
                          <td className="px-2 py-3 text-center font-bold text-gray-700">{formatDiff(row.goalDiff)}</td>
                          <td className="px-3 py-3 text-center text-base font-black text-gray-900">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Qualifier legend */}
              {qualifiers > 0 && (
                <div className="flex items-center gap-2 border-t border-gray-50 px-5 py-3">
                  <span className="h-3 w-3 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {qualifiers === 1 ? "Qualifié" : `${qualifiers} premiers qualifiés`}
                  </span>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
