"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Timer, Shield, History, ChevronLeft, Trophy, Flame,
  Loader2, Activity, MapPin, Calendar, Clock
} from "lucide-react";
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

  useEffect(() => {
    if (!match?.liveState) return;
    
    let interval: ReturnType<typeof setInterval>;
    
    if (match.liveState.isTimerRunning && match.liveState.timerStartAt) {
      const start = new Date(match.liveState.timerStartAt).getTime();
      const offset = match.liveState.timerOffset || 0;
      
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - start + offset;
        setDisplayTime(elapsed);
      }, 100);
    } else {
      setDisplayTime(match.liveState.timerOffset || 0);
    }
    
    return () => clearInterval(interval);
  }, [match?.liveState]);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm border border-gray-100 text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
             {isLive && <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
               {isLive ? "En direct" : "Rapport de match"}
             </span>
          </div>
          <h1 className="text-xl font-black text-gray-900 font-display">Centre de Match</h1>
        </div>
        <div className="w-10" />
      </div>

      {/* Main Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="overflow-hidden rounded-[3rem] bg-gradient-to-br from-gray-900 via-gray-800 to-black p-10 text-white shadow-2xl relative"
      >
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Activity size={120} />
        </div>

        <div className="relative z-10 grid grid-cols-3 items-center gap-6">
          {/* Home */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
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
            {match.liveState ? (
              <div className="text-5xl font-mono font-black text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                {formatTime(displayTime)}
              </div>
            ) : (
               <div className="text-lg font-black text-white/50 italic">VS</div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-inner">
               <span className="text-3xl font-black">{match.awayTeamName?.[0] || "?"}</span>
            </div>
            <h2 className="text-sm font-black uppercase tracking-tight mb-2 truncate">{match.awayTeamName}</h2>
            <div className="text-7xl font-black tracking-tighter">{match.scoreAway || 0}</div>
          </div>
        </div>
      </motion.div>

      {/* Match Details Bar */}
      <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white border border-gray-100 p-2 shadow-sm">
         <div className="flex flex-col items-center justify-center p-4 border-r border-gray-50">
           <MapPin size={16} className="text-gray-400 mb-1" />
           <span className="text-[10px] font-bold text-gray-900 truncate w-full text-center">{match.venueName}</span>
         </div>
         <div className="flex flex-col items-center justify-center p-4 border-r border-gray-50">
           <Calendar size={16} className="text-gray-400 mb-1" />
           <span className="text-[10px] font-bold text-gray-900">{match.date}</span>
         </div>
         <div className="flex flex-col items-center justify-center p-4">
           <Clock size={16} className="text-gray-400 mb-1" />
           <span className="text-[10px] font-bold text-gray-900">{match.time}</span>
         </div>
      </div>

      {/* Events Timeline */}
      <div className="rounded-[2.5rem] bg-white border border-gray-100 p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
           <h3 className="text-lg font-black text-gray-900 font-display">Fil du match</h3>
           <History className="text-gray-200" size={24} />
        </div>

        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gray-50" />

          <div className="space-y-8 relative">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event, i) => (
                <div key={event.id} className="flex items-start gap-6 group">
                  <div className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm transition-all group-hover:scale-110 ${
                    event.type === "goal" ? "bg-amber-50 border-amber-100 text-amber-500" : 
                    event.type === "yellow_card" ? "bg-amber-50 border-amber-100 text-amber-400" :
                    event.type === "red_card" ? "bg-red-50 border-red-100 text-red-500" : "bg-gray-50 border-gray-100 text-gray-400"
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
                 <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-50 text-gray-200 mb-4">
                    <Activity size={32} />
                 </div>
                 <p className="text-sm font-bold text-gray-400 italic">Le match n&apos;a pas encore commencé...</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Footer Info */}
      <div className="text-center">
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300 italic">Arbitré par {match.refereeName || "Arbitre Officiel"}</p>
      </div>
    </div>
  );
}
