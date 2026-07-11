"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, Loader2, SearchX, MapPin, Clock, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { getCompetitionBySlug, onCompMatches } from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompMatchRound } from "@/types";

// ============================================
// Helpers
// ============================================

// Bucket sentinel for fixtures whose date is not yet set. Sorts last because
// no real ISO date string ever equals this token.
const UNDATED = "__undated__";

// Knockout round → French label, for the per-match tag when `round` is set.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

// Nicely formatted day header, e.g. "Samedi 18 juillet" (fr locale). Falls back
// to the raw ISO string if it can't be parsed, and to a fixed label for undated.
function formatDayHeader(date: string): string {
  if (date === UNDATED) return "Date à définir";
  try {
    const label = format(parseISO(date), "EEEE d MMMM", { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return date;
  }
}

// Team crest: real logo when present, otherwise a first-letter avatar. Mirrors
// the crest treatment in the standings table, sized for calendar rows.
function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-xs font-black text-gray-500">
      {logo ? (
        <Image src={logo} alt={name} width={32} height={32} className="h-full w-full object-cover" />
      ) : (
        <span>{name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// Status pill: À venir / 🔴 EN DIRECT (with pulse) / Terminé.
function StatusPill({ status }: { status: CompMatch["status"] }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-600">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        En direct
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-500">
        Terminé
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-gray-400">
        Annulé
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
      À venir
    </span>
  );
}

// Small stage tag: "Groupe A" for group matches, the round label for knockout.
function stageTag(match: CompMatch): string | null {
  if (match.group) return `Groupe ${match.group}`;
  if (match.round) return ROUND_LABELS[match.round];
  return null;
}

// ============================================
// Component
// ============================================

export default function PublicCalendarPage() {
  const { slug } = useParams() as { slug: string };
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Resolve competition by slug, then subscribe to matches in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
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
        if (!cancelled) setMatches(m);
      });
    })();

    return () => {
      cancelled = true;
      unsubMatches?.();
    };
  }, [slug]);

  // Group matches by day. Dated buckets sort chronologically ascending; the
  // undated bucket (date == null) is forced last. Within a day, matches sort by
  // time with nulls last. Pure derivation — recomputed only when matches change.
  const days = useMemo(() => {
    const byDay = new Map<string, CompMatch[]>();
    for (const match of matches) {
      const key = match.date ?? UNDATED;
      const bucket = byDay.get(key);
      if (bucket) bucket.push(match);
      else byDay.set(key, [match]);
    }

    return Array.from(byDay.entries())
      .sort(([a], [b]) => {
        if (a === UNDATED) return 1;
        if (b === UNDATED) return -1;
        return a.localeCompare(b);
      })
      .map(([date, dayMatches]) => ({
        date,
        matches: [...dayMatches].sort((m1, m2) => {
          // Nulls last, then lexicographic on "HH:mm" (chronological for that shape).
          if (m1.time == null && m2.time == null) return 0;
          if (m1.time == null) return 1;
          if (m2.time == null) return -1;
          return m1.time.localeCompare(m2.time);
        }),
      }));
  }, [matches]);

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement du calendrier...</p>
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
        <h1 className="font-display text-xl font-black text-gray-900">Calendrier</h1>
      </div>

      {days.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-gray-100 bg-white py-20 text-center shadow-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-200">
            <CalendarDays size={32} />
          </div>
          <p className="text-sm font-bold text-gray-400 italic">
            Le calendrier n&apos;est pas encore disponible.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {days.map((day, di) => (
            <motion.section
              key={day.date}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: di * 0.04 }}
              className="space-y-3"
            >
              {/* Day header */}
              <div className="flex items-center gap-2 px-1">
                <CalendarDays size={15} className="text-emerald-500" />
                <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
                  {formatDayHeader(day.date)}
                </h2>
              </div>

              {/* Matches of the day */}
              <div className="space-y-2.5">
                {day.matches.map((match) => {
                  const isLive = match.status === "live";
                  const hasScore = match.status === "live" || match.status === "completed";
                  const tag = stageTag(match);
                  return (
                    <Link
                      key={match.id}
                      href={`/c/${slug}/matches/${match.id}`}
                      className={`group block overflow-hidden rounded-[1.75rem] border bg-white shadow-sm transition-all hover:shadow-lg ${
                        isLive ? "border-red-100 hover:border-red-200" : "border-gray-100 hover:border-emerald-200"
                      }`}
                    >
                      {/* Top row: tag + status */}
                      <div className="flex items-center justify-between gap-2 border-b border-gray-50 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          {tag && (
                            <span className="truncate rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                              {tag}
                            </span>
                          )}
                        </div>
                        <StatusPill status={match.status} />
                      </div>

                      {/* Scoreboard row */}
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        {/* Home */}
                        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
                          <span className="truncate text-sm font-bold text-gray-900">{match.homeTeamName}</span>
                          <TeamBadge name={match.homeTeamName} logo={match.homeTeamLogo} />
                        </div>

                        {/* Center: score or kickoff time */}
                        <div className="flex shrink-0 flex-col items-center justify-center px-1">
                          {hasScore ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xl font-black tabular-nums text-gray-900">{match.scoreHome ?? 0}</span>
                              <span className="text-sm font-black text-gray-300">-</span>
                              <span className="text-xl font-black tabular-nums text-gray-900">{match.scoreAway ?? 0}</span>
                            </div>
                          ) : match.time ? (
                            <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-black tabular-nums text-gray-500">
                              {match.time}
                            </span>
                          ) : (
                            <span className="text-sm font-black text-gray-300">—</span>
                          )}
                        </div>

                        {/* Away */}
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <TeamBadge name={match.awayTeamName} logo={match.awayTeamLogo} />
                          <span className="truncate text-sm font-bold text-gray-900">{match.awayTeamName}</span>
                        </div>
                      </div>

                      {/* Meta row: venue + time, plus a chevron affordance */}
                      <div className="flex items-center justify-between gap-2 border-t border-gray-50 px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-3 text-[11px] font-bold text-gray-400">
                          {match.venueName && (
                            <span className="flex min-w-0 items-center gap-1">
                              <MapPin size={12} className="shrink-0" />
                              <span className="truncate">
                                {match.venueName}
                                {match.venueCity ? `, ${match.venueCity}` : ""}
                              </span>
                            </span>
                          )}
                          {hasScore && match.time && (
                            <span className="flex shrink-0 items-center gap-1">
                              <Clock size={12} />
                              {match.time}
                            </span>
                          )}
                        </div>
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
