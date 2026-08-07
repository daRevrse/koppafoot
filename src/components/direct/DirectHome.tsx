"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays, ChevronRight, ChevronLeft, Trophy, MapPin,
} from "lucide-react";
import { onCompMatches, listCompTeams } from "@/lib/competition-firestore";
import type { CompetitionFeed } from "@/lib/competition-admin";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// DirectHome — the live-score home, served publicly at "/".
//
// It answers one question: what is on right now, everywhere. It used to bind
// to a single competition (?c=slug) and show that competition's poules,
// standings and scorers — which is what the competition page is for. Now it
// reads ACROSS every public competition: a banner carousel of the matches
// that matter, then a timeline bucketed by day with today first.
// ============================================

type Tab = "all" | "live" | "finished" | "upcoming";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "live", label: "En direct" },
  { key: "finished", label: "Terminés" },
  { key: "upcoming", label: "À venir" },
];

// ---- helpers ------------------------------------------------------------------

function shortDay(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit",
    });
  } catch {
    return date;
  }
}

function heroDate(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return date;
  }
}

/** Live minute from the shared live_state clock (same math as LiveMatchConsole). */
function liveMinute(m: CompMatch): number {
  const ls = m.liveState;
  if (!ls) return 0;
  if (m.status === "live" && ls.isTimerRunning && ls.timerStartAt) {
    const elapsed = Date.now() - new Date(ls.timerStartAt).getTime() + (ls.timerOffset || 0);
    return Math.floor(elapsed / 60000) + 1;
  }
  return Math.floor((ls.timerOffset || 0) / 60000) + 1;
}

function TeamBadge({ name, logo, size = 26 }: { name: string; logo?: string | null; size?: number }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ---- Hero match card (image, ValueBet-style) -------------------------------------

// Prefer the live team-doc logo (always current) over the match's
// denormalised snapshot (stale if the logo was uploaded after the fixture).
function logoFor(
  teamsById: Map<string, CompTeam>,
  teamId: string | null,
  fallback: string | null,
): string | null {
  return (teamId ? teamsById.get(teamId)?.logoUrl : null) ?? fallback;
}

function HeroMatchCard({
  match, competition, teamsById,
}: {
  match: CompMatch; competition: Competition; teamsById: Map<string, CompTeam>;
}) {
  const [, forceTick] = useState(0);
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const homeLogo = logoFor(teamsById, match.homeTeamId, match.homeTeamLogo);
  const awayLogo = logoFor(teamsById, match.awayTeamId, match.awayTeamLogo);

  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [isLive]);

  // Banner fallback chain: per-match → competition → default stadium.
  const bg = match.bannerUrl ?? competition.bannerUrl ?? "/branding/hero_stadium.png";

  return (
    <Link href={`/c/${competition.slug}/matches/${match.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl shadow-sm transition-transform hover:scale-[1.005]"
      >
        {/* Background image + overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/40 to-emerald-950/30" />

        <div className="relative flex min-h-[240px] flex-col justify-between p-5 sm:min-h-[280px] sm:p-6">
          {/* Top row: date/live badge + competition pill */}
          <div className="flex items-start justify-between gap-2">
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                EN DIRECT {liveMinute(match)}&apos;
              </span>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                {finished
                  ? "Terminé"
                  : match.date
                    ? `${heroDate(match.date)}${match.time ? ` · ${match.time}` : ""}`
                    : "À programmer"}
              </span>
            )}
            <span className="truncate rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-emerald-100 backdrop-blur-sm">
              {competition.name}{match.group ? ` · Poule ${match.group}` : ""}
            </span>
          </div>

          {/* Bottom: teams + score */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <TeamBadge name={match.homeTeamName} logo={homeLogo} size={42} />
                <span className="truncate font-display text-lg font-black text-white sm:text-2xl">
                  {match.homeTeamName}
                </span>
              </div>

              <div className="shrink-0 text-center">
                {isLive || finished ? (
                  <span className="font-display text-3xl font-black tabular-nums text-white sm:text-4xl">
                    {match.scoreHome ?? 0}
                    <span className="mx-1.5 text-white/40">:</span>
                    {match.scoreAway ?? 0}
                  </span>
                ) : (
                  <span className="font-display text-2xl font-black text-emerald-300 sm:text-3xl">
                    {match.time ?? "VS"}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
                <span className="truncate text-right font-display text-lg font-black text-white sm:text-2xl">
                  {match.awayTeamName}
                </span>
                <TeamBadge name={match.awayTeamName} logo={awayLogo} size={42} />
              </div>
            </div>

            {/* Info bar */}
            <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-emerald-100 backdrop-blur-sm">
              {match.venueName && (
                <>
                  <MapPin size={12} className="text-emerald-300" />
                  <span>{match.venueName}</span>
                  <span className="text-white/30">·</span>
                </>
              )}
              <span>Voir le match</span>
              <ChevronRight size={13} className="text-emerald-300" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ---- Match row (time | home | score | away | venue) --------------------------------

function MatchRow({
  match, competition, teamsById,
}: {
  match: CompMatch; competition: Competition; teamsById: Map<string, CompTeam>;
}) {
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const homeLogo = logoFor(teamsById, match.homeTeamId, match.homeTeamLogo);
  const awayLogo = logoFor(teamsById, match.awayTeamId, match.awayTeamLogo);

  return (
    <Link
      href={`/c/${competition.slug}/matches/${match.id}`}
      className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50/70"
    >
      {/* Time column */}
      <div className="w-12 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-500">
            <span className="h-1 w-1 rounded-full bg-red-500" />
            {liveMinute(match)}&apos;
          </span>
        ) : (
          <>
            <p className="text-xs font-black tabular-nums text-gray-900">{match.time ?? "—"}</p>
            {match.date && (
              <p className="text-[10px] font-bold text-gray-300">{shortDay(match.date)}</p>
            )}
          </>
        )}
      </div>

      {/* Home */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamBadge name={match.homeTeamName} logo={homeLogo} size={24} />
        <span className={`truncate text-sm font-bold ${finished && (match.scoreHome ?? 0) < (match.scoreAway ?? 0) ? "text-gray-400" : "text-gray-900"}`}>
          {match.homeTeamName}
        </span>
      </div>

      {/* Score / VS */}
      {isLive || finished ? (
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black tabular-nums text-white ${isLive ? "bg-red-500" : "bg-gray-900"}`}>
          {match.scoreHome ?? 0}:{match.scoreAway ?? 0}
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[9px] font-black text-gray-400">
          VS
        </span>
      )}

      {/* Away */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className={`truncate text-right text-sm font-bold ${finished && (match.scoreAway ?? 0) < (match.scoreHome ?? 0) ? "text-gray-400" : "text-gray-900"}`}>
          {match.awayTeamName}
        </span>
        <TeamBadge name={match.awayTeamName} logo={awayLogo} size={24} />
      </div>

      {/* Competition (desktop). The feed mixes every competition, so the
          fixture has to say which one it belongs to — the venue does not. */}
      <span className="hidden w-28 shrink-0 truncate text-right text-[10px] font-bold text-gray-300 md:block">
        {competition.name}
      </span>
    </Link>
  );
}

// ---- Hero carousel (featured match per competition, auto-advancing) ----------------

function HeroCarousel({
  slides, teamsById,
}: {
  slides: { match: CompMatch; competition: Competition }[];
  teamsById: Map<string, CompTeam>;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = slides.length;
  const safeIndex = count === 0 ? 0 : index % count;

  // Auto-advance. Pauses on hover and while a finger is down, so the banner
  // never slides out from under a tap.
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;

  const go = (next: number) => setIndex(((next % count) + count) % count);
  const current = slides[safeIndex];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        setPaused(false);
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 50) go(safeIndex + (dx < 0 ? 1 : -1));
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.competition.id}-${current.match.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <HeroMatchCard
            match={current.match}
            competition={current.competition}
            teamsById={teamsById}
          />
        </motion.div>
      </AnimatePresence>

      {count > 1 && (
        <>
          {/* Arrows are pointer-only; mobile swipes instead. */}
          <button
            aria-label="Affiche précédente"
            onClick={() => go(safeIndex - 1)}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Affiche suivante"
            onClick={() => go(safeIndex + 1)}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:flex"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={`${s.competition.id}-${s.match.id}`}
                aria-label={`Affiche ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIndex ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Day grouping -----------------------------------------------------------------

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Aujourd&apos;hui / Demain / Hier, else a full French date. */
function dayLabel(date: string): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date === dayKey(today)) return "Aujourd'hui";
  if (date === dayKey(tomorrow)) return "Demain";
  if (date === dayKey(yesterday)) return "Hier";
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return date;
  }
}

const UNDATED = "0000-00-00";

// ---- Page -------------------------------------------------------------------------

export default function DirectHome({ initialFeed }: { initialFeed: CompetitionFeed[] }) {
  const [feed, setFeed] = useState<CompetitionFeed[]>(initialFeed);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  const competitions = useMemo(() => feed.map((f) => f.competition), [feed]);
  // Stable dependency: `competitions` is a fresh array on every feed update,
  // so keying the effects on it would tear down the listeners each time a
  // score changes.
  const competitionIds = useMemo(
    () => competitions.map((c) => c.id).join(","),
    [competitions],
  );

  // One real-time listener per competition: the home is a live-score board,
  // so every fixture on screen has to move on its own.
  useEffect(() => {
    const ids = competitionIds ? competitionIds.split(",") : [];
    if (ids.length === 0) return;
    const unsubs = ids.map((id) =>
      onCompMatches(id, (matches) =>
        setFeed((prev) =>
          prev.map((f) => (f.competition.id === id ? { ...f, matches } : f)),
        ),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [competitionIds]);

  // Team docs carry the current crest; match docs only a snapshot of it.
  useEffect(() => {
    const ids = competitionIds ? competitionIds.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map((id) => listCompTeams(id).catch(() => []))).then((lists) => {
      if (!cancelled) setTeams(lists.flat());
    });
    return () => { cancelled = true; };
  }, [competitionIds]);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Every fixture, all competitions, each keeping its competition context.
  const allMatches = useMemo(
    () => feed.flatMap((f) => f.matches.map((match) => ({ match, competition: f.competition }))),
    [feed],
  );

  // Banner: live first, then soonest upcoming, then most recent results —
  // capped so the carousel stays a highlight reel, not a second fixture list.
  const heroSlides = useMemo(() => {
    const live = allMatches.filter((x) => x.match.status === "live");
    const upcoming = allMatches
      .filter((x) => x.match.status === "scheduled" && x.match.date != null)
      .sort((a, b) =>
        `${a.match.date}T${a.match.time ?? ""}`.localeCompare(`${b.match.date}T${b.match.time ?? ""}`),
      );
    const recent = allMatches
      .filter((x) => x.match.status === "completed")
      .sort((a, b) =>
        `${b.match.date ?? ""}T${b.match.time ?? ""}`.localeCompare(`${a.match.date ?? ""}T${a.match.time ?? ""}`),
      );
    return [...live, ...upcoming, ...recent].slice(0, 5);
  }, [allMatches]);

  // Timeline: filtered by tab, then bucketed by DAY — today first.
  const days = useMemo(() => {
    let list = allMatches;
    if (tab === "live") list = allMatches.filter((x) => x.match.status === "live");
    if (tab === "finished") list = allMatches.filter((x) => x.match.status === "completed");
    if (tab === "upcoming") list = allMatches.filter((x) => x.match.status === "scheduled");

    const buckets = new Map<string, typeof list>();
    for (const x of list) {
      const key = x.match.date ?? UNDATED;
      const bucket = buckets.get(key) ?? [];
      bucket.push(x);
      buckets.set(key, bucket);
    }

    const today = dayKey(new Date());
    const todayMs = new Date(`${today}T00:00:00`).getTime();

    return Array.from(buckets.entries())
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) =>
          (a.match.time ?? "99:99").localeCompare(b.match.time ?? "99:99"),
        ),
      }))
      // Today first, then the nearest days around it; undated last.
      .sort((a, b) => {
        if (a.date === UNDATED) return 1;
        if (b.date === UNDATED) return -1;
        if (a.date === today) return -1;
        if (b.date === today) return 1;
        const da = Math.abs(new Date(`${a.date}T00:00:00`).getTime() - todayMs);
        const db = Math.abs(new Date(`${b.date}T00:00:00`).getTime() - todayMs);
        return da - db;
      });
  }, [allMatches, tab]);

  const liveCount = allMatches.filter((x) => x.match.status === "live").length;

  if (feed.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-gray-200 bg-white py-16">
          <Trophy size={32} className="text-gray-300" />
          <h3 className="mt-4 font-display text-lg font-black text-gray-900">
            Aucune compétition en cours
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Les prochaines compétitions apparaîtront ici.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <HeroCarousel slides={heroSlides} teamsById={teamsById} />

      {/* Section header + underlined tabs */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex min-w-0 items-center gap-2 truncate font-display text-xl font-black text-gray-900">
            Le direct
            {liveCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-black text-red-500">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                {liveCount}
              </span>
            )}
          </h2>
          <Link
            href="/competitions"
            className="hidden shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600 sm:flex"
          >
            Toutes les compétitions
            <ChevronRight size={13} />
          </Link>
        </div>
        <div className="mt-2 flex gap-5 border-b border-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative pb-2.5 text-sm font-bold transition-colors ${
                tab === t.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline by day */}
      {days.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          <CalendarDays size={24} className="mx-auto text-gray-300" />
          <p className="mt-2 text-sm text-gray-400">Aucun match dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map(({ date, items }) => (
            <div
              key={date}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2.5">
                <p className="text-xs font-black uppercase tracking-wide text-gray-500">
                  {date === UNDATED ? "À programmer" : dayLabel(date)}
                </p>
                <span className="text-[11px] font-bold text-gray-400">
                  {items.length} match{items.length > 1 ? "s" : ""}
                </span>
              </div>
              {items.map(({ match, competition }) => (
                <MatchRow
                  key={`${competition.id}-${match.id}`}
                  match={match}
                  competition={competition}
                  teamsById={teamsById}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
