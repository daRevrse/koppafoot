"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Loader2, SearchX, Trophy, CalendarDays, ClipboardList } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { getCompetitionBySlug, onCompMatches } from "@/lib/competition-firestore";
import { gameTypeLabel, matchDurationLabel } from "@/lib/competition-format";
import RegisterTeamButton from "@/components/competition/RegisterTeamButton";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import type { Competition, CompMatch, CompMatchRound, CompetitionStatus } from "@/types";

// ============================================
// Helpers
// ============================================

// Status → label + accent, reusing the mapping style from the organizer landing.
const STATUS_CONFIG: Record<CompetitionStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { label: "Inscriptions", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { label: "Phase de groupes", color: "text-amber-700", bg: "bg-amber-50" },
  knockout: { label: "Phase finale", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "Terminée", color: "text-emerald-700", bg: "bg-emerald-50" },
};

// Knockout round → French label, for the per-match tag when `round` is set.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

// Small stage tag: "Groupe A" for group matches, the round label for knockout.
function stageTag(match: CompMatch): string | null {
  if (match.group) return `Groupe ${match.group}`;
  if (match.round) return ROUND_LABELS[match.round];
  return null;
}

// Format a single ISO date, e.g. "18 juil." (fr). Falls back to the raw string.
function formatShortDate(date: string): string {
  try {
    return format(parseISO(date), "d MMM", { locale: fr });
  } catch {
    return date;
  }
}

// Human date range for the hero. Both / start-only / end-only / none.
function formatDateRange(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "d MMMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  if (start) return `À partir du ${fmt(start)}`;
  if (end) return `Jusqu'au ${fmt(end)}`;
  return null;
}

// Team crest: real logo when present, otherwise a first-letter avatar. Mirrors
// the crest treatment used across the public competition pages.
function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200/70 bg-gray-50 text-sm font-black text-gray-500">
      {logo ? (
        <Image src={logo} alt={name} width={40} height={40} className="h-full w-full object-cover" />
      ) : (
        <span>{name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// A scoreboard-style match card (live / completed): crests, names, final score.
function ScoreCard({ match, slug }: { match: CompMatch; slug: string }) {
  const isLive = match.status === "live";
  const tag = stageTag(match);
  return (
    <Link
      href={`/c/${slug}/matches/${match.id}`}
      className={`group block bg-white transition-colors hover:bg-gray-50 ${
        isLive ? "border-l-2 border-l-red-500" : ""
      }`}
    >
      {/* Top row: tag + status */}
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        {tag ? (
          <span className="truncate text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            {tag}
          </span>
        ) : (
          <span />
        )}
        {isLive ? (
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            En direct
          </span>
        ) : (
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            Terminé
          </span>
        )}
      </div>

      {/* Scoreboard row */}
      <div className="flex items-center gap-4 px-5 pb-5 pt-3">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
          <span className="truncate text-base font-bold text-gray-900">{match.homeTeamName}</span>
          <TeamBadge name={match.homeTeamName} logo={match.homeTeamLogo} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 px-1">
          <span className="font-display text-3xl font-black tabular-nums text-gray-900">{match.scoreHome ?? 0}</span>
          <span className="text-lg font-black text-gray-300">-</span>
          <span className="font-display text-3xl font-black tabular-nums text-gray-900">{match.scoreAway ?? 0}</span>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TeamBadge name={match.awayTeamName} logo={match.awayTeamLogo} />
          <span className="truncate text-base font-bold text-gray-900">{match.awayTeamName}</span>
        </div>
      </div>
    </Link>
  );
}

// An upcoming (scheduled) match card: crests, names, kickoff time / date.
function FixtureCard({ match, slug }: { match: CompMatch; slug: string }) {
  const tag = stageTag(match);
  return (
    <Link
      href={`/c/${slug}/matches/${match.id}`}
      className="group block bg-white transition-colors hover:bg-gray-50"
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        {tag ? (
          <span className="truncate text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
            {tag}
          </span>
        ) : (
          <span />
        )}
        <span className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-600">
          À venir
        </span>
      </div>

      <div className="flex items-center gap-4 px-5 pb-5 pt-3">
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
          <span className="truncate text-base font-bold text-gray-900">{match.homeTeamName}</span>
          <TeamBadge name={match.homeTeamName} logo={match.homeTeamLogo} />
        </div>
        <div className="flex shrink-0 flex-col items-center justify-center px-1">
          {match.time ? (
            <span className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-black tabular-nums text-gray-500">
              {match.time}
            </span>
          ) : (
            <span className="text-sm font-black text-gray-300">VS</span>
          )}
          {match.date && (
            <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {formatShortDate(match.date)}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <TeamBadge name={match.awayTeamName} logo={match.awayTeamLogo} />
          <span className="truncate text-base font-bold text-gray-900">{match.awayTeamName}</span>
        </div>
      </div>
    </Link>
  );
}

// ============================================
// Component
// ============================================

export default function PublicCompetitionHome() {
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

  // Live matches, in document order (already ordered by date asc upstream).
  const liveMatches = useMemo(
    () => matches.filter((m) => m.status === "live"),
    [matches],
  );

  // Next few scheduled matches with a real date, ascending by date then time.
  const upcomingMatches = useMemo(() => {
    return matches
      .filter((m) => m.status === "scheduled" && m.date != null)
      .sort((a, b) => {
        const d = (a.date as string).localeCompare(b.date as string);
        if (d !== 0) return d;
        // Within a day: nulls last, then "HH:mm" lexicographic (chronological).
        if (a.time == null && b.time == null) return 0;
        if (a.time == null) return 1;
        if (b.time == null) return -1;
        return a.time.localeCompare(b.time);
      })
      .slice(0, 5);
  }, [matches]);

  // Most recent completed matches, descending by date then time.
  const recentResults = useMemo(() => {
    return matches
      .filter((m) => m.status === "completed")
      .sort((a, b) => {
        // Undated completed matches sort last.
        if (a.date == null && b.date == null) return 0;
        if (a.date == null) return 1;
        if (b.date == null) return -1;
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        if (a.time == null && b.time == null) return 0;
        if (a.time == null) return 1;
        if (b.time == null) return -1;
        return b.time.localeCompare(a.time);
      })
      .slice(0, 5);
  }, [matches]);

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement de la compétition...</p>
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

  const statusCfg = STATUS_CONFIG[competition.status];
  const dateRange = formatDateRange(competition.startDate, competition.endDate);

  return (
    <div className="space-y-10 pb-24">
      {/* Hero — full bleed to the shell edges, left aligned, the name at
          poster size. The metadata reads as caps micro-labels rather than
          icon rows: a competition page is a front page, not a form. */}
      <section className="relative -mx-3 -mt-3 overflow-hidden bg-gray-900 text-white lg:-mx-5 lg:-mt-5">
        {competition.bannerUrl ? (
          <>
            <Image
              src={competition.bannerUrl}
              alt=""
              width={1600}
              height={600}
              priority
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/75 to-gray-900/40" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-800 via-gray-900 to-black" />
        )}

        <div className="relative mx-auto flex max-w-5xl flex-col gap-7 px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-white/15 bg-white/5">
              {competition.logoUrl ? (
                <Image
                  src={competition.logoUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Trophy size={30} strokeWidth={1.2} className="text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-300">
                {statusCfg.label}
              </p>
              {competition.organizerName && (
                <p className="mt-1 truncate text-sm font-bold text-white/60">
                  {competition.organizerName}
                </p>
              )}
            </div>
          </div>

          <h1 className="font-display text-4xl font-black uppercase leading-[0.92] tracking-tight sm:text-6xl lg:text-7xl">
            {competition.name}
          </h1>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-[11px] font-black uppercase tracking-[0.15em] text-white/55">
            {dateRange && <span>{dateRange}</span>}
            {competition.venueCity && <span>{competition.venueCity}</span>}
            <span>{gameTypeLabel(competition.format)}</span>
            <span>{matchDurationLabel(competition.format)}</span>
          </div>

          {/* Suivre : la compétition entre dans « Mes compétitions » du menu
              et ses buts arrivent en notification. Mis à l'échelle du hero
              ici plutôt que dans le composant, qui sert ailleurs. */}
          <div className="[&_button]:gap-2 [&_button]:px-6 [&_button]:py-3 [&_button]:text-sm [&_svg]:h-[18px] [&_svg]:w-[18px]">
            <FollowCompetitionButton cid={competition.id} />
          </div>
        </div>
      </section>

      {/* Entries are open — and a manager can register from right here
          rather than being sent to another screen to do it. The button
          renders nothing for anyone without a club. */}
      {competition.status === "registration" && (
        <div className="flex items-center gap-4 rounded-lg border border-emerald-200/70 bg-emerald-50/60 px-5 py-4">
          <ClipboardList size={26} strokeWidth={1.3} className="shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black tracking-tight text-emerald-900">Inscriptions ouvertes</p>
            <p className="mt-0.5 text-xs font-semibold text-emerald-800">
              Tu diriges une équipe ? Inscris-la à cette compétition.
            </p>
          </div>
          <RegisterTeamButton competition={competition} label="S'inscrire" />
        </div>
      )}

      {/* En direct maintenant — or — Prochains matchs */}
      {liveMatches.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <h2 className="font-display text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              En direct maintenant
            </h2>
          </div>
          <div className="divide-y divide-gray-200/70 overflow-hidden rounded-lg border border-gray-200/70">
            {liveMatches.map((match) => (
              <ScoreCard key={match.id} match={match} slug={slug} />
            ))}
          </div>
        </section>
      ) : upcomingMatches.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <CalendarDays size={20} strokeWidth={1.4} className="text-gray-400" />
            <h2 className="font-display text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              Prochains matchs
            </h2>
          </div>
          <div className="divide-y divide-gray-200/70 overflow-hidden rounded-lg border border-gray-200/70">
            {upcomingMatches.map((match) => (
              <FixtureCard key={match.id} match={match} slug={slug} />
            ))}
          </div>
        </section>
      ) : null}

      {/* Derniers résultats */}
      {recentResults.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Trophy size={20} strokeWidth={1.4} className="text-gray-400" />
            <h2 className="font-display text-xl font-black tracking-tight text-gray-900 sm:text-2xl">
              Derniers résultats
            </h2>
          </div>
          <div className="divide-y divide-gray-200/70 overflow-hidden rounded-lg border border-gray-200/70">
            {recentResults.map((match) => (
              <ScoreCard key={match.id} match={match} slug={slug} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
