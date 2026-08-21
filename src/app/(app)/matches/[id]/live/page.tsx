"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  History, ChevronLeft, Trophy,
  Loader2, Activity, MapPin, Calendar, Clock, BarChart3
} from "lucide-react";
import { format as formatDate, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { toMatch } from "@/lib/firestore";
import type { Match, FirestoreMatch } from "@/types";

// ============================================
// Helpers
// ============================================

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

/** "2026-08-16" -> "16 août 2026". Falls back to the raw string. */
function matchDay(date: string): string {
  try {
    return formatDate(parseISO(date), "d MMMM yyyy", { locale: fr });
  } catch {
    return date;
  }
}

const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Terminé" }
];

// ============================================
// Component
// ============================================

export default function MatchLiveView() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const [detailTab, setDetailTab] = useState<"feed" | "stats">("feed");

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "matches", id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as FirestoreMatch;
        setMatch(toMatch(snap.id, data));
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [id]);

  // Server-clock timer, same semantics as the competition match view: while the
  // clock runs we tick from timerStartAt + timerOffset; when it is paused the
  // displayed value is the frozen timerOffset, derived at render below. Setting
  // that frozen value from inside the effect was a synchronous setState in an
  // effect body, a cascading render for a number already known at render time.
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

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Connexion au direct...</p>
      </div>
    );
  }

  if (!match) return <div className="p-8 text-center text-gray-500">Match non trouvé</div>;

  const isLive = match.status === "live";
  const contextLabel = ["Match amical", match.format].filter(Boolean).join(" · ");
  const hasMeta = Boolean(match.venueName || match.date || match.time);
  // Ticking value while the clock runs, frozen offset otherwise.
  const shownTime =
    match.liveState?.isTimerRunning && match.liveState.timerStartAt
      ? displayTime
      : match.liveState?.timerOffset || 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center bg-white border border-gray-200/70 text-gray-600">
          <ChevronLeft size={24} />
        </button>
        {/* Same treatment as the competition match page: name the fixture
            rather than the document. A friendly has no competition, so the
            format stands in for the round. */}
        <div className="flex items-center justify-center gap-2 text-center">
          {isLive && (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 italic">
                En direct
              </span>
              <span className="text-gray-200">·</span>
            </>
          )}
          <h1 className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
            {contextLabel}
          </h1>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black p-5 sm:p-8 text-white relative"
      >
        <div className="relative z-10 grid grid-cols-3 items-center gap-2 sm:gap-6">
          {/* Home */}
          <div className="text-center">
            <div className="mx-auto mb-3 sm:mb-4 flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
               <span className="text-3xl font-black">{match.homeTeamName?.[0] || "?"}</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight mb-2 truncate">{match.homeTeamName}</h2>
            <div className="text-7xl font-black tracking-tighter">{match.scoreHome || 0}</div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-400">
               {PERIODS.find(p => p.id === match.liveState?.currentPeriod)?.label || (match.status === "completed" ? "Terminé" : "À venir")}
            </div>
            {/* A finished match kept showing its frozen final time; one still
                to come showed 00:00. The status pill above already says which. */}
            {isLive ? (
              <div className="text-2xl sm:text-5xl font-mono font-black text-emerald-500 drop-">
                {formatTime(shownTime)}
              </div>
            ) : match.status === "completed" ? null : (
               <div className="text-lg font-black text-white/50 italic">VS</div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            <div className="mx-auto mb-3 sm:mb-4 flex h-14 w-14 sm:h-20 sm:w-20 items-center justify-center bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
               <span className="text-3xl font-black">{match.awayTeamName?.[0] || "?"}</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight mb-2 truncate">{match.awayTeamName}</h2>
            <div className="text-7xl font-black tracking-tighter">{match.scoreAway || 0}</div>
          </div>
        </div>
        {/* Where and when belong to the fixture, not to a card beside it. */}
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

      {/* Events + stats */}
      {(() => {
      const events = match.liveState?.events ?? [];
      const hasStats = events.length > 0;
      const countBy = (type: string, teamId: string | null) =>
        events.filter((e) => e.type === type && e.teamId === teamId).length;
      // Goals are read off the scoreboard, not counted from the timeline: an own
      // goal is filed under the team that conceded it.
      const statRows = [
        { label: "Buts", home: match.scoreHome ?? 0, away: match.scoreAway ?? 0 },
        { label: "Cartons jaunes", home: countBy("yellow_card", match.homeTeamId), away: countBy("yellow_card", match.awayTeamId) },
        { label: "Cartons rouges", home: countBy("red_card", match.homeTeamId), away: countBy("red_card", match.awayTeamId) },
      ];
      const activeTab = detailTab === "stats" && !hasStats ? "feed" : detailTab;
      return (
      <div className=" bg-white border border-gray-200/70 p-5 sm:p-6">
        <div className="mb-8 flex gap-6 border-b border-gray-200/70">
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
        </div>

        {activeTab === "stats" && hasStats && (
          <div className="space-y-5">
            {statRows.map((row) => {
              const total = row.home + row.away;
              const homePct = total === 0 ? 50 : (row.home / total) * 100;
              return (
                <div key={row.label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3">
                    <span className="w-8 text-left text-base font-black tabular-nums text-gray-900">{row.home}</span>
                    <span className="truncate text-[11px] font-black uppercase tracking-wide text-gray-400">{row.label}</span>
                    <span className="w-8 text-right text-base font-black tabular-nums text-gray-900">{row.away}</span>
                  </div>
                  <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div className="bg-emerald-500 transition-all" style={{ width: `${homePct}%` }} />
                    <div className="bg-gray-300 transition-all" style={{ width: `${100 - homePct}%` }} />
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

        {activeTab === "feed" && (
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gray-50" />

          <div className="space-y-8 relative">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event) => (
                <div key={event.id} className="flex items-start gap-6 group">
                  <div className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center border-2 transition-all group-hover:scale-110 ${
                    event.type === "goal" ? "bg-amber-50 border-amber-100 text-amber-500" : 
                    event.type === "yellow_card" ? "bg-amber-50 border-amber-100 text-amber-400" :
                    event.type === "red_card" ? "bg-red-50 border-red-100 text-red-500" : "bg-gray-50 border-gray-200/70 text-gray-400"
                  }`}>
                    <span className="text-[10px] font-black">{event.minute}&apos;</span>
                  </div>

                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2 mb-1">
                       {event.type === "goal" && <Trophy size={16} />}
                       <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                         {event.type === "goal" ? "BUT !" : event.type === "yellow_card" ? "Carton Jaune" : "Carton Rouge"}
                       </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-500">
                        {event.playerName || "Joueur"}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-300">
                        {event.teamId === match.homeTeamId ? "DOM" : "EXT"}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <div className="flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-200 mb-4">
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

      {/* Footer Info */}
      <div className="text-center">
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 italic">Arbitré par {match.refereeName || "Arbitre Officiel"}</p>
      </div>
    </div>
  );
}
