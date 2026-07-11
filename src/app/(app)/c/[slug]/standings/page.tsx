"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
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
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-[11px] font-black text-gray-500"
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

export default function PublicStandingsPage() {
  const { slug } = useParams() as { slug: string };
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Resolve competition by slug, then subscribe to matches + teams in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug) return;
    let unsubMatches: (() => void) | undefined;
    let unsubTeams: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const comp = await getCompetitionBySlug(slug);
      if (cancelled) return;
      if (!comp) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCompetition(comp);
      setLoading(false);
      unsubMatches = onCompMatches(comp.id, (m) => {
        if (!cancelled) setMatches(m);
      });
      unsubTeams = onCompTeams(comp.id, (t) => {
        if (!cancelled) setTeams(t);
      });
    })();

    return () => {
      cancelled = true;
      unsubMatches?.();
      unsubTeams?.();
    };
  }, [slug]);

  // Derive standings from the pure helper; never recompute inline.
  const groups = useMemo(
    () => (competition ? computeStandings(matches, teams, competition.format) : []),
    [matches, teams, competition],
  );

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement du classement...</p>
      </div>
    );
  }

  if (notFound || !competition) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">Compétition introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Cette compétition n&apos;existe pas ou n&apos;est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const qualifiers = competition.format.qualifiers_per_group;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
          {competition.name}
        </span>
        <h1 className="font-display text-xl font-black text-gray-900">Classement</h1>
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-gray-100 bg-white py-20 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-200">
            <ListOrdered size={32} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">
            Classement vide — aucun groupe ou résultat pour l&apos;instant.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g, gi) => (
            <motion.section
              key={g.group}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
              className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-gray-50 px-5 py-4">
                <Trophy size={16} className="text-emerald-500" />
                <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
                  Groupe {g.group}
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
                    {g.rows.map((row: StandingRow, idx) => {
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
                              className={`relative flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black ${
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
                              <span className="truncate font-bold text-gray-900">{row.team.name}</span>
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
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
