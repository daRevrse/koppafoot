import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { Loader2, SearchX, GitBranch, Trophy } from "lucide-react";
import {
  getCompetitionBySlug, onCompMatches, describeBracketSlotSource,
} from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompMatchRound } from "@/types";

// ============================================
// Helpers
// ============================================

// Bracket columns, left → right. `third_place` is excluded, it's shown
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
  // Pas de fond derrière un vrai écusson : beaucoup de logos sont des PNG
  // transparents, et la plaque se voyait au travers.
  // `contain` plutôt que `cover` : sans plaque, un logo rogné n'a plus rien
  // qui rattrape la coupe.
  if (logo) {
    return (
      <Image
        src={logo}
        alt={name}
        width={28}
        height={28}
        className="h-7 w-7 shrink-0 object-contain"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 bg-gray-50 text-[11px] font-black text-gray-500">
      <span>{name?.[0]?.toUpperCase() || "?"}</span>
    </div>
  );
}

// One side (home/away) of a read-only bracket match. Until a team id is
// present it shows where the place comes from ("1er poule A") when the
// organizer drew the bracket that way, else "À déterminer". The winning side of
// a completed match is emphasized.
function BracketSide({
  teamId,
  name,
  logo,
  score,
  showScore,
  isWinner,
  dimmed,
  placeholder,
}: {
  teamId: string | null;
  name: string;
  logo: string | null;
  score: number | null;
  showScore: boolean;
  isWinner: boolean;
  dimmed: boolean;
  placeholder?: string | null;
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
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center border border-dashed text-[11px] font-black ${
              placeholder
                ? "border-emerald-200 bg-emerald-50 text-emerald-400"
                : "border-gray-200/70 bg-gray-50 text-gray-300"
            }`}
          >
            ?
          </div>
          <span
            className={`min-w-0 flex-1 truncate text-sm font-medium italic ${
              placeholder ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            {placeholder ?? "À déterminer"}
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
      className={`group block w-60 overflow-hidden border bg-white transition-all ${
        isLive ? "border-red-100 hover:border-red-200" : "border-gray-200/70 hover:border-emerald-200"
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
          placeholder={match.homeSource ? describeBracketSlotSource(match.homeSource) : null}
        />
        <BracketSide
          teamId={match.awayTeamId}
          name={match.awayTeamName}
          logo={match.awayTeamLogo}
          score={match.scoreAway}
          showScore={showScore}
          isWinner={awayWon}
          dimmed={hasWinner && !awayWon}
          placeholder={match.awaySource ? describeBracketSlotSource(match.awaySource) : null}
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

export default function BracketTab({ competition, matches }: {
  competition: Competition;
  matches: CompMatch[];
}) {
  const { slug } = useParams() as { slug: string };
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

const isEmpty = columns.length === 0 && !thirdPlace;

  return (
    <div className="space-y-6 pb-20">
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-200">
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
