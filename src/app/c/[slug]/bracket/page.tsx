"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Loader2, SearchX, GitBranch, Trophy } from "lucide-react";
import { getCompetitionBySlug, onCompMatches } from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompMatchRound } from "@/types";

// ============================================
// Helpers
// ============================================

// Bracket columns, left → right. `third_place` is excluded — it's shown
// separately below the tree (it isn't a tree node).
const ROUND_ORDER: CompMatchRound[] = ["round_of_16", "quarter", "semi", "final"];

const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quarts",
  semi: "Demi-finales",
  final: "Finale",
  third_place: "Petite finale",
};

// Team crest: real logo when present, otherwise a first-letter avatar. Mirrors
// the crest treatment used across the public competition pages.
function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-[11px] font-black text-gray-500">
      {logo ? (
        <Image src={logo} alt={name} width={28} height={28} className="h-full w-full object-cover" />
      ) : (
        <span>{name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// One side (home/away) of a read-only bracket match. "À déterminer" until a
// team id is present; the winning side of a completed match is emphasized.
function BracketSide({
  teamId,
  name,
  logo,
  score,
  showScore,
  isWinner,
  dimmed,
}: {
  teamId: string | null;
  name: string;
  logo: string | null;
  score: number | null;
  showScore: boolean;
  isWinner: boolean;
  dimmed: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${
        isWinner ? "bg-emerald-50/70" : ""
      } ${dimmed ? "opacity-50" : ""}`}
    >
      {teamId ? (
        <>
          <TeamBadge name={name} logo={logo} />
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              isWinner ? "font-black text-gray-900" : "font-bold text-gray-700"
            }`}
          >
            {name}
          </span>
        </>
      ) : (
        <>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-[11px] font-black text-gray-300">
            ?
          </div>
          <span className="min-w-0 flex-1 truncate text-sm font-medium italic text-gray-400">
            À déterminer
          </span>
        </>
      )}
      {showScore && (
        <span
          className={`shrink-0 text-sm font-black tabular-nums ${
            isWinner ? "text-gray-900" : "text-gray-400"
          }`}
        >
          {score ?? 0}
        </span>
      )}
    </div>
  );
}

// A single read-only bracket match card. Links to the public match view.
function BracketMatch({ match, slug }: { match: CompMatch; slug: string }) {
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const showScore = isLive || isCompleted;
  const homeWon = isCompleted && match.winnerTeamId != null && match.winnerTeamId === match.homeTeamId;
  const awayWon = isCompleted && match.winnerTeamId != null && match.winnerTeamId === match.awayTeamId;
  // When a match has a decided winner, fade the loser side.
  const hasWinner = isCompleted && match.winnerTeamId != null;

  return (
    <Link
      href={`/c/${slug}/matches/${match.id}`}
      className={`group block w-60 overflow-hidden rounded-2xl border bg-white shadow-sm transition-all hover:shadow-lg ${
        isLive ? "border-red-100 hover:border-red-200" : "border-gray-100 hover:border-emerald-200"
      }`}
    >
      <div className="divide-y divide-gray-50">
        <BracketSide
          teamId={match.homeTeamId}
          name={match.homeTeamName}
          logo={match.homeTeamLogo}
          score={match.scoreHome}
          showScore={showScore}
          isWinner={homeWon}
          dimmed={hasWinner && !homeWon}
        />
        <BracketSide
          teamId={match.awayTeamId}
          name={match.awayTeamName}
          logo={match.awayTeamLogo}
          score={match.scoreAway}
          showScore={showScore}
          isWinner={awayWon}
          dimmed={hasWinner && !awayWon}
        />
      </div>
      {isLive && (
        <div className="flex items-center justify-center gap-1.5 bg-red-50 py-1">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[10px] font-black uppercase tracking-wider text-red-600">En direct</span>
        </div>
      )}
    </Link>
  );
}

// ============================================
// Component
// ============================================

export default function PublicBracketPage() {
  const { slug } = useParams() as { slug: string };
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Resolve competition by slug, then subscribe to knockout matches in real
  // time. Anonymous reads work because Firestore rules allow read on
  // competitions/**. Winners appear live as matches finish (onSnapshot data).
  useEffect(() => {
    if (!slug) return;
    let unsubMatches: (() => void) | undefined;
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
        if (!cancelled) setMatches(m.filter((x) => x.stage === "knockout"));
      });
    })();

    return () => {
      cancelled = true;
      unsubMatches?.();
    };
  }, [slug]);

  // Bracket columns in display order; matches sorted by bracketSlot within each.
  const columns = useMemo(() => {
    return ROUND_ORDER.map((round) => ({
      round,
      matches: matches
        .filter((m) => m.round === round)
        .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0)),
    })).filter((c) => c.matches.length > 0);
  }, [matches]);

  const thirdPlace = useMemo(
    () => matches.find((m) => m.round === "third_place") ?? null,
    [matches],
  );

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement du tableau...</p>
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

  const isEmpty = columns.length === 0 && !thirdPlace;

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="text-center">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
          {competition.name}
        </span>
        <h1 className="font-display text-xl font-black text-gray-900">Tableau final</h1>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-gray-100 bg-white py-20 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-200">
            <GitBranch size={32} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">
            La phase finale n&apos;a pas encore commencé.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Bracket: horizontal-scrolling columns, one per round. */}
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex min-w-max gap-5">
              {columns.map((col, ci) => (
                <motion.div
                  key={col.round}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: ci * 0.05 }}
                  className="flex flex-col gap-4"
                >
                  {/* Column header */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-display text-xs font-black uppercase tracking-tight text-gray-900">
                      {ROUND_LABELS[col.round]}
                    </span>
                  </div>
                  {/* Matches, vertically centered so later rounds align nicely. */}
                  <div className="flex flex-1 flex-col justify-around gap-4">
                    {col.matches.map((match) => (
                      <BracketMatch key={match.id} match={match} slug={slug} />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Third-place match, shown separately below the tree. */}
          {thirdPlace && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: columns.length * 0.05 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-center gap-1.5">
                <Trophy size={14} className="text-amber-500" />
                <span className="font-display text-xs font-black uppercase tracking-tight text-gray-900">
                  {ROUND_LABELS.third_place}
                </span>
              </div>
              <div className="flex justify-center">
                <BracketMatch match={thirdPlace} slug={slug} />
              </div>
            </motion.section>
          )}
        </div>
      )}
    </div>
  );
}
