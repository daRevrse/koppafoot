"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import {
  History, Trophy, Loader2, Activity, MapPin, Calendar, Clock, SearchX, Users,
} from "lucide-react";
import type { LineupEntry } from "@/types";
import { getCompetitionBySlug, onCompMatch } from "@/lib/competition-firestore";
import type { CompMatch } from "@/types";

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

const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Terminé" },
];

// Team crest: real logo when present, otherwise a first-letter avatar.
function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 shadow-inner backdrop-blur-xl">
      {logo ? (
        <Image src={logo} alt={name} width={80} height={80} className="h-full w-full object-cover" />
      ) : (
        <span className="text-3xl font-black">{name?.[0]?.toUpperCase() || "?"}</span>
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
  const [detailTab, setDetailTab] = useState<"feed" | "lineups">("feed");
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
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-300">
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
  // While the clock runs, show the ticking value; otherwise the frozen offset.
  const shownTime =
    match.liveState?.isTimerRunning && match.liveState.timerStartAt
      ? displayTime
      : match.liveState?.timerOffset || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Status pill */}
      <div className="text-center">
        <div className="mb-1 flex items-center justify-center gap-2">
          {isLive && <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />}
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
            {isLive ? "En direct" : "Rapport de match"}
          </span>
        </div>
        <h1 className="font-display text-xl font-black text-gray-900">Centre de Match</h1>
      </div>

      {/* Main Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-gray-900 via-gray-800 to-black p-10 text-white shadow-2xl"
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
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Activity size={120} />
        </div>

        <div className="relative z-10 grid grid-cols-3 items-center gap-6">
          {/* Home */}
          <div className="text-center">
            <TeamCrest name={match.homeTeamName} logo={match.homeTeamLogo} />
            <h2 className="mb-2 truncate text-sm font-black uppercase tracking-tight">{match.homeTeamName}</h2>
            <div className="text-7xl font-black tracking-tighter">{match.scoreHome || 0}</div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-4 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              {periodLabel}
            </div>
            {match.liveState ? (
              <div className="font-mono text-5xl font-black text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                {formatTime(shownTime)}
              </div>
            ) : (
              <div className="text-lg font-black text-white/50 italic">
                {match.status === "completed" ? "Terminé" : "VS"}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            <TeamCrest name={match.awayTeamName} logo={match.awayTeamLogo} />
            <h2 className="mb-2 truncate text-sm font-black uppercase tracking-tight">{match.awayTeamName}</h2>
            <div className="text-7xl font-black tracking-tighter">{match.scoreAway || 0}</div>
          </div>
        </div>
      </motion.div>

      {/* Match Details Bar */}
      {hasMeta && (
        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-gray-100 bg-white p-2 shadow-sm">
          <div className="flex flex-col items-center justify-center border-r border-gray-50 p-4">
            <MapPin size={16} className="mb-1 text-gray-400" />
            <span className="w-full truncate text-center text-[10px] font-bold text-gray-900">
              {match.venueName || "—"}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center border-r border-gray-50 p-4">
            <Calendar size={16} className="mb-1 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-900">{match.date || "—"}</span>
          </div>
          <div className="flex flex-col items-center justify-center p-4">
            <Clock size={16} className="mb-1 text-gray-400" />
            <span className="text-[10px] font-bold text-gray-900">{match.time || "—"}</span>
          </div>
        </div>
      )}

      {/* Tabs: match feed / lineups */}
      {(() => {
        const hasLineups = match.homeLineup.length > 0 || match.awayLineup.length > 0;
        const activeTab = detailTab === "lineups" && !hasLineups ? "feed" : detailTab;
        return (
          <div className="rounded-[2.5rem] border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
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

          <div className="relative space-y-8">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event) => (
                <div key={event.id} className="group flex items-start gap-6">
                  <div
                    className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm transition-all group-hover:scale-110 ${
                      event.type === "goal"
                        ? "border-amber-100 bg-amber-50 text-amber-500"
                        : event.type === "yellow_card"
                          ? "border-amber-100 bg-amber-50 text-amber-400"
                          : event.type === "red_card"
                            ? "border-red-100 bg-red-50 text-red-500"
                            : "border-gray-100 bg-gray-50 text-gray-400"
                    }`}
                  >
                    <span className="text-[10px] font-black">{event.minute}&apos;</span>
                  </div>

                  <div className="flex-1 pt-1">
                    <div className="mb-1 flex items-center gap-2">
                      {event.type === "goal" && <Trophy size={16} />}
                      <span className="text-sm font-black uppercase tracking-wide text-gray-900">
                        {event.type === "goal"
                          ? "BUT !"
                          : event.type === "yellow_card"
                            ? "Carton Jaune"
                            : event.type === "red_card"
                              ? "Carton Rouge"
                              : "Événement"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-500">{event.playerName || ""}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                        {event.teamId === match.homeTeamId ? "DOM" : "EXT"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-200">
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
