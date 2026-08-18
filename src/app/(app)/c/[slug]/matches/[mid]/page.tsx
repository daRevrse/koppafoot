"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import {
  History, Loader2, Activity, MapPin, Calendar, Clock, SearchX, Users,
  Goal, ArrowRightLeft, BarChart3,
} from "lucide-react";
import type { LineupEntry } from "@/types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { getCompetitionBySlug, onCompMatch, OWN_GOAL_DETAIL } from "@/lib/competition-firestore";
import type { CompMatch, CompMatchRound } from "@/types";

// ============================================
// Helpers
// ============================================

// Ported verbatim from the (app)/matches/[id]/live spectator view.
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Knockout round -> French label, for the context line under the status.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

/** "2026-08-16" -> "16 août 2026". Falls back to the raw string. */
function matchDay(date: string): string {
  try {
    return format(parseISO(date), "d MMMM yyyy", { locale: fr });
  } catch {
    return date;
  }
}

const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Terminé" },
];

// Team crest: real logo when present, otherwise a first-letter avatar.
function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-inner backdrop-blur-xl sm:mb-4 sm:h-20 sm:w-20">
      {logo ? (
        <Image src={logo} alt={name} width={80} height={80} className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-black sm:text-3xl">{name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// One side's match sheet: starters then substitutes (each group hidden when
// empty). Numbers are shown when set; rows fall back to a dash for the dossard.
function LineupColumn({ title, entries }: { title: string; entries: LineupEntry[] }) {
  const starters = entries.filter((e) => e.role === "starter");
  const substitutes = entries.filter((e) => e.role === "substitute");

  const renderRow = (entry: LineupEntry) => (
    <div key={entry.playerId || `${entry.number}-${entry.name}`} className="flex items-center gap-2.5 py-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-50 text-[10px] font-black tabular-nums text-gray-500">
        {entry.number || "—"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">{entry.name}</span>
    </div>
  );

  return (
    <div className="min-w-0">
      <h4 className="mb-3 truncate text-sm font-black uppercase tracking-tight text-gray-900">{title}</h4>
      {starters.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-300">Titulaires</p>
          <div className="divide-y divide-gray-50">{starters.map(renderRow)}</div>
        </div>
      )}
      {substitutes.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-300">Remplaçants</p>
          <div className="divide-y divide-gray-50">{substitutes.map(renderRow)}</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function PublicCompMatchView() {
  const { slug, mid } = useParams() as { slug: string; mid: string };
  const [match, setMatch] = useState<CompMatch | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [compBanner, setCompBanner] = useState<string | null>(null);
  const [compName, setCompName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"feed" | "stats" | "lineups">("feed");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  // Resolve competition by slug, then subscribe to the match doc in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug || !mid) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const competition = await getCompetitionBySlug(slug);
      if (cancelled) return;
      if (!competition) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCid(competition.id);
      setCompBanner(competition.bannerUrl);
      setCompName(competition.name);
      unsub = onCompMatch(competition.id, mid, (m) => {
        if (cancelled) return;
        if (!m) setNotFound(true);
        setMatch(m);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [slug, mid]);

  // Server-clock timer. Same semantics as the spectator view: while the clock
  // runs we tick every 100ms from timerStartAt + timerOffset; when paused/stopped
  // the displayed value is the frozen timerOffset (derived at render below, so the
  // effect only drives the running interval — no synchronous setState in its body).
  useEffect(() => {
    const ls = match?.liveState;
    if (match?.status !== "live" || !ls || !ls.isTimerRunning || !ls.timerStartAt) return;

    const start = new Date(ls.timerStartAt).getTime();
    const offset = ls.timerOffset || 0;
    const interval = setInterval(() => {
      setDisplayTime(Date.now() - start + offset);
    }, 100);

    return () => clearInterval(interval);
  }, [match?.liveState, match?.status]);

  // Still resolving the slug (no cid yet) or awaiting the first match snapshot.
  if (loading || (cid && !match && !notFound)) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Connexion au direct...</p>
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">Match introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Ce match n&apos;existe pas ou n&apos;est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const isLive = match.status === "live";
  const periodLabel =
    PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label ||
    (match.status === "completed" ? "Terminé" : "À venir");
  const hasMeta = Boolean(match.venueName || match.date || match.time);
  // Competition name plus the round (or poule) this match belongs to.
  const contextLabel = [
    compName,
    match.round ? ROUND_LABELS[match.round] : match.group ? `Poule ${match.group}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // While the clock runs, show the ticking value; otherwise the frozen offset.
  const shownTime =
    match.liveState?.isTimerRunning && match.liveState.timerStartAt
      ? displayTime
      : match.liveState?.timerOffset || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Where this match sits: the competition, and its round or group. The
          generic "Centre de Match" title said nothing the page did not already
          show, and "Rapport de match" named the document rather than the game. */}
      <div className="flex items-center justify-center gap-2 text-center">
        {isLive && (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 italic">
              En direct
            </span>
            {contextLabel && <span className="text-gray-200">·</span>}
          </>
        )}
        {contextLabel && (
          <h1 className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
            {contextLabel}
          </h1>
        )}
      </div>

      {/* Main Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-black p-5 text-white shadow-xl sm:p-8"
      >
        {/* Banner background: per-match → competition → none. A dark overlay
            keeps the scoreboard legible. */}
        {(match.bannerUrl || compBanner) && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={match.bannerUrl ?? compBanner ?? ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/80 via-gray-900/70 to-black/80" />
          </>
        )}
        <div className="relative z-10 grid grid-cols-3 items-center gap-2 sm:gap-6">
          {/* Home */}
          <div className="text-center">
            <TeamCrest name={match.homeTeamName} logo={match.homeTeamLogo} />
            <h2 className="mb-1 truncate text-xs font-black uppercase tracking-tight sm:mb-2 sm:text-sm">{match.homeTeamName}</h2>
            <div className="text-5xl font-black tracking-tighter sm:text-7xl">{match.scoreHome || 0}</div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-3 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-400 sm:mb-4 sm:px-4 sm:text-[10px] sm:tracking-widest">
              {periodLabel}
            </div>
{/* The clock runs only for a match in progress. A finished one kept
                showing its frozen final time, which read like a live chrono
                stopped mid-second; one still to come showed 00:00. */}
            {isLive ? (
              <div className="font-mono text-2xl font-black text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] sm:text-5xl">
                {formatTime(shownTime)}
              </div>
            ) : match.status === "completed" ? null : (
              <div className="text-lg font-black text-white/50 italic">VS</div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            <TeamCrest name={match.awayTeamName} logo={match.awayTeamLogo} />
            <h2 className="mb-1 truncate text-xs font-black uppercase tracking-tight sm:mb-2 sm:text-sm">{match.awayTeamName}</h2>
            <div className="text-5xl font-black tracking-tighter sm:text-7xl">{match.scoreAway || 0}</div>
          </div>
        </div>

        {/* Where and when — inside the frame rather than in a card of its own
            below it: these belong to the fixture, not beside it. */}
        {hasMeta && (
          <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-4 text-[11px] font-bold text-white/50">
            {match.venueName && (
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{match.venueName}</span>
              </span>
            )}
            {match.date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={12} className="shrink-0" />
                {matchDay(match.date)}
              </span>
            )}
            {match.time && (
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="shrink-0" />
                {match.time}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Tabs: match feed / lineups */}
      {(() => {
        const hasLineups = match.homeLineup.length > 0 || match.awayLineup.length > 0;
        const events = match.liveState?.events ?? [];
        const hasStats = events.length > 0;
        // Goals come from the scoreboard, not the timeline: an own goal is
        // recorded against the team that conceded it, so counting goal events
        // per team would credit the wrong side.
        const countBy = (type: string, teamId: string | null) =>
          events.filter((e) => e.type === type && e.teamId === teamId).length;
        const statRows = [
          { label: "Buts", home: match.scoreHome ?? 0, away: match.scoreAway ?? 0 },
          { label: "Cartons jaunes", home: countBy("yellow_card", match.homeTeamId), away: countBy("yellow_card", match.awayTeamId) },
          { label: "Cartons rouges", home: countBy("red_card", match.homeTeamId), away: countBy("red_card", match.awayTeamId) },
          { label: "Changements", home: countBy("substitution", match.homeTeamId), away: countBy("substitution", match.awayTeamId) },
        ];
        const activeTab =
          (detailTab === "lineups" && !hasLineups) || (detailTab === "stats" && !hasStats)
            ? "feed"
            : detailTab;
        return (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
            {/* Tab bar */}
            <div className="mb-8 flex gap-6 border-b border-gray-100">
              <button
                onClick={() => setDetailTab("feed")}
                className={`relative flex items-center gap-2 pb-3 text-sm font-black transition-colors ${
                  activeTab === "feed" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                <History size={16} />
                Fil du match
                {activeTab === "feed" && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
                )}
              </button>
              {hasStats && (
                <button
                  onClick={() => setDetailTab("stats")}
                  className={`relative flex items-center gap-2 pb-3 text-sm font-black transition-colors ${
                    activeTab === "stats" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <BarChart3 size={16} />
                  Statistiques
                  {activeTab === "stats" && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              )}
              {hasLineups && (
                <button
                  onClick={() => setDetailTab("lineups")}
                  className={`relative flex items-center gap-2 pb-3 text-sm font-black transition-colors ${
                    activeTab === "lineups" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Users size={16} />
                  Compositions
                  {activeTab === "lineups" && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              )}
            </div>

            {/* Stats panel: one row per metric, the two teams facing each
                other, with a bar showing each side's share. */}
            {activeTab === "stats" && hasStats && (
              <div className="space-y-5">
                {statRows.map((row) => {
                  const total = row.home + row.away;
                  const homePct = total === 0 ? 50 : (row.home / total) * 100;
                  return (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="w-8 text-left text-base font-black tabular-nums text-gray-900">
                          {row.home}
                        </span>
                        <span className="truncate text-[11px] font-black uppercase tracking-wide text-gray-400">
                          {row.label}
                        </span>
                        <span className="w-8 text-right text-base font-black tabular-nums text-gray-900">
                          {row.away}
                        </span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${homePct}%` }}
                        />
                        <div
                          className="bg-gray-300 transition-all"
                          style={{ width: `${100 - homePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-3 pt-1 text-[10px] font-black uppercase tracking-wide">
                  <span className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate">{match.homeTeamName}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <span className="truncate">{match.awayTeamName}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  </span>
                </div>
              </div>
            )}

            {/* Lineups panel */}
            {activeTab === "lineups" && hasLineups && (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <LineupColumn title={match.homeTeamName} entries={match.homeLineup} />
                <LineupColumn title={match.awayTeamName} entries={match.awayLineup} />
              </div>
            )}

            {/* Feed panel */}
            {activeTab === "feed" && (
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gray-50" />

          <div className="relative space-y-5 sm:space-y-7">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event) => {
                const isHome = event.teamId === match.homeTeamId;
                const teamName = isHome ? match.homeTeamName : match.awayTeamName;
                const isSub = event.type === "substitution";
                // A goal the VAR is looking at, or took away. The disallowed
                // one stays in the feed — the crowd saw it, and the timeline
                // is what explains why the score did not move.
                const checking = event.type === "goal" && event.varStatus === "checking";
                const cancelled = event.type === "goal" && event.varStatus === "cancelled";
                return (
                  <div key={event.id} className="group flex items-start gap-3 sm:gap-5">
                    {/* Minute badge */}
                    <div
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 shadow-sm sm:h-11 sm:w-11 ${
                        cancelled
                          ? "border-gray-100 bg-gray-50 text-gray-300"
                          : checking
                            ? "border-amber-100 bg-amber-50 text-amber-600"
                            : event.type === "goal"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                          : event.type === "yellow_card"
                            ? "border-amber-100 bg-amber-50 text-amber-500"
                            : event.type === "red_card"
                              ? "border-red-100 bg-red-50 text-red-500"
                              : "border-gray-100 bg-gray-50 text-gray-400"
                      }`}
                    >
                      {/* A result entered after the fact may carry no minute
                          (stored as 0) — no goal is ever scored at the 0th. */}
                      <span className="text-[10px] font-black">
                        {event.minute ? `${event.minute}'` : "—"}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        {/* Type marker */}
                        {event.type === "goal" && (
                          <Goal
                            size={15}
                            className={`shrink-0 ${cancelled ? "text-gray-300" : "text-emerald-600"}`}
                          />
                        )}
                        {event.type === "yellow_card" && (
                          <span className="h-3.5 w-2.5 shrink-0 rounded-[3px] bg-amber-400" />
                        )}
                        {event.type === "red_card" && (
                          <span className="h-3.5 w-2.5 shrink-0 rounded-[3px] bg-red-500" />
                        )}
                        {isSub && <ArrowRightLeft size={14} className="shrink-0 text-blue-500" />}
                        <span
                          className={`truncate text-xs font-black uppercase tracking-wide sm:text-sm ${
                            cancelled ? "text-gray-400 line-through" : "text-gray-900"
                          }`}
                        >
                          {event.type === "goal"
                            ? event.detail === OWN_GOAL_DETAIL ? "But contre son camp" : "But"
                            : event.type === "yellow_card"
                              ? "Carton jaune"
                              : event.type === "red_card"
                                ? event.detail === "2e carton jaune" ? "Expulsion (2e jaune)" : "Carton rouge"
                                : isSub
                                  ? "Changement"
                                  : "Événement"}
                        </span>
                        {checking && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            VAR
                          </span>
                        )}
                        {cancelled && (
                          <span className="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700">
                            Refusé
                          </span>
                        )}
                        <span className="ml-auto shrink-0 truncate text-[10px] font-black uppercase tracking-wide text-gray-300 max-w-[35%]">
                          {teamName}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-gray-500 sm:text-xs">
                        {isSub && event.detail ? event.detail : event.playerName || ""}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-200">
                  <Activity size={32} />
                </div>
                <p className="text-sm font-bold text-gray-400 italic">Le match n&apos;a pas encore commencé...</p>
              </div>
            )}
          </div>
        </div>
            )}
          </div>
          );
        })()}
    </div>
  );
}
