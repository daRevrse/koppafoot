import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Loader2, SearchX, Goal, Medal } from "lucide-react";
import {
  getCompetitionBySlug,
  onCompMatches,
  onCompTeams,
  computeTopScorers,
} from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// Helpers
// ============================================

// Medal tint for the podium (top 3); plain accent below.
const PODIUM = [
  { ring: "border-amber-200 bg-amber-50 text-amber-500", label: "text-amber-500" }, // gold
  { ring: "border-gray-200/70 bg-gray-50 text-gray-400", label: "text-gray-400" }, // silver
  { ring: "border-orange-200 bg-orange-50 text-orange-500", label: "text-orange-500" }, // bronze
];

// Small crest for a scorer's team, falling back to the team color/letter. When
// the team is missing (e.g. it was deleted), render a neutral placeholder so the
// row still shows the player without crashing.
function ScorerTeam({ team }: { team: CompTeam | undefined }) {
  if (!team) {
    return (
      <span className="text-[11px] font-bold text-gray-300 italic">Équipe inconnue</span>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50 text-[9px] font-black text-gray-500"
        style={!team.logoUrl && team.color ? { backgroundColor: team.color, color: "#fff" } : undefined}
      >
        {team.logoUrl ? (
          <Image src={team.logoUrl} alt={team.name} width={20} height={20} className="h-full w-full object-cover" />
        ) : (
          <span>{team.name?.[0]?.toUpperCase() || "?"}</span>
        )}
      </div>
      <span className="truncate text-[11px] font-bold text-gray-500">{team.name}</span>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function ScorersTab({ competition, matches, teams }: {
  competition: Competition;
  matches: CompMatch[];
  teams: CompTeam[];
}) {
  // Aggregate goals via the pure helper.
  const scorers = useMemo(() => computeTopScorers(matches), [matches]);

  // Resolve each scorer's teamId -> CompTeam for display.
  const teamsById = useMemo(() => {
    const map = new Map<string, CompTeam>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

return (
    <div className="space-y-6 pb-20">
      {scorers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-200">
            <Goal size={32} />
          </div>
          <p className="max-w-xs text-sm font-bold text-gray-400 italic">
            Aucun buteur enregistré pour l&apos;instant — les buts nommés apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {scorers.map((s, idx) => {
              const rank = idx + 1;
              const podium = idx < 3 ? PODIUM[idx] : null;
              const team = teamsById.get(s.teamId);
              return (
                <motion.li
                  key={`${s.playerName}__${s.teamId}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx, 10) * 0.03 }}
                  className={`flex items-center gap-4 px-5 py-4 ${podium ? "bg-gray-50/40" : ""}`}
                >
                  {/* Rank / medal */}
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 text-sm font-black ${
                      podium ? podium.ring : "border-gray-200/70 bg-gray-50 text-gray-400"
                    }`}
                  >
                    {podium ? <Medal size={16} className={podium.label} /> : rank}
                  </div>

                  {/* Player + team */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900">{s.playerName}</p>
                    <div className="mt-0.5">
                      <ScorerTeam team={team} />
                    </div>
                  </div>

                  {/* Goal count */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Goal size={16} className="text-emerald-500" />
                    <span className="text-lg font-black text-gray-900">{s.goals}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                      {s.goals > 1 ? "buts" : "but"}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
