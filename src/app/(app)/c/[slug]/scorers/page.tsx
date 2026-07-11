"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
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
  { ring: "border-gray-200 bg-gray-50 text-gray-400", label: "text-gray-400" }, // silver
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
        className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-100 bg-gray-50 text-[9px] font-black text-gray-500"
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

export default function PublicScorersPage() {
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

  // Aggregate goals via the pure helper.
  const scorers = useMemo(() => computeTopScorers(matches), [matches]);

  // Resolve each scorer's teamId -> CompTeam for display.
  const teamsById = useMemo(() => {
    const map = new Map<string, CompTeam>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement des buteurs...</p>
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

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
          {competition.name}
        </span>
        <h1 className="font-display text-xl font-black text-gray-900">Meilleurs buteurs</h1>
      </div>

      {scorers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-gray-100 bg-white py-20 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-200">
            <Goal size={32} />
          </div>
          <p className="max-w-xs text-sm font-bold text-gray-400 italic">
            Aucun buteur enregistré pour l&apos;instant — les buts nommés apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-gray-100 bg-white shadow-sm">
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
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-black ${
                      podium ? podium.ring : "border-gray-100 bg-gray-50 text-gray-400"
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
