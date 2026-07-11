"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Timer, Play, Pause, Award, AlertTriangle, Shield,
  History, CheckCircle2, ChevronLeft, User, Plus,
  Minus, Loader2, Trophy, Flame, ArrowRightLeft,
  Users, ChevronRight, Settings2, Clock, CheckSquare
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMatchById,
  updateMatchStatus,
  startMatchTimer,
  pauseMatchTimer,
  addMatchEvent,
  updateMatchPeriod,
  initLiveMatch,
  getParticipationsForMatch,
  toMatch,
  toParticipation
} from "@/lib/firestore";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where } from "firebase/firestore";
import type { Match, Participation } from "@/types";
import { format } from "date-fns";

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
  { id: 4, label: "Fin de match" }
];

// ============================================
// Component
// ============================================

export default function LiveMatchManage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubModal, setShowSubModal] = useState<{ teamId: string; teamName: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: Participation, teamId: string, teamName: string } | null>(null);
  const [subInPlayer, setSubInPlayer] = useState("");
  const [subOutPlayer, setSubOutPlayer] = useState("");

  // Subscribe to match changes
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "matches", id), (snap) => {
      if (snap.exists()) {
        setMatch(toMatch(snap.id, snap.data() as any));
        setLoading(false);
      }
    });
    return () => unsub();
  }, [id]);

  // Fetch players (Real-time)
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "participations"), where("match_id", "==", id));
    const unsub = onSnapshot(q, (snap) => {
      const parts = snap.docs.map(d => toParticipation(d.id, d.data() as any));
      setParticipations(parts);
    });
    return () => unsub();
  }, [id]);

  // Focus Mode / Prevention of accidental navigation
  useEffect(() => {
    if (match?.status === "live") {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = "";
        return "";
      };
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }
  }, [match?.status]);

  // Timer logic
  useEffect(() => {
    if (!match?.liveState) return;
    
    let interval: ReturnType<typeof setInterval>;
    
    if (match.liveState.isTimerRunning && match.liveState.timerStartAt) {
      const start = new Date(match.liveState.timerStartAt).getTime();
      const offset = match.liveState.timerOffset || 0;
      
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - start + offset;
        
        // Auto-pause logic
        const totalSecs = Math.floor(elapsed / 1000);
        
        if (match.liveState?.currentPeriod === 1 && totalSecs >= 2700) {
          handlePauseTimer();
          toast("Mi-temps ! Pause automatique à 45:00.", { icon: '⏰', duration: 5000 });
        } else if (match.liveState?.currentPeriod === 3 && totalSecs >= 5400) {
          handlePauseTimer();
          toast("Fin du temps réglementaire ! Pause automatique à 90:00.", { icon: '⏰', duration: 5000 });
        }

        setDisplayTime(elapsed);
      }, 100);
    } else {
      setDisplayTime(match.liveState.timerOffset || 0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [match?.liveState]);

  const handleStartTimer = async () => {
    try {
      await startMatchTimer(id);
      toast.success("Chronomètre lancé");
    } catch (err) {
      toast.error("Erreur technique");
    }
  };

  const handlePauseTimer = async () => {
    try {
      await pauseMatchTimer(id, displayTime);
      toast.success("Chronomètre arrêté");
    } catch (err) {
      toast.error("Erreur technique");
    }
  };

  const handleAddEvent = async (type: string, teamId: string, playerId?: string, playerName?: string, detail?: string) => {
    if (!match?.liveState) return;
    setIsSubmitting(true);
    try {
      const minute = Math.floor(displayTime / 60000) + 1;
      await addMatchEvent(id, {
        type,
        period: match.liveState.currentPeriod,
        minute,
        team_id: teamId,
        player_id: playerId || null,
        player_name: playerName || null,
        detail: detail || null,
        isHome: teamId === match.homeTeamId
      });
      
      if (type === "goal") toast.success("BUT !");
      else if (type === "substitution") toast.success("Changement effectué");
      else toast.success("Événement enregistré");
    } catch (err) {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubstitution = async () => {
    if (!showSubModal || !subInPlayer || !subOutPlayer) return;
    
    const inPlayer = participations.find(p => p.playerId === subInPlayer);
    const outPlayer = participations.find(p => p.playerId === subOutPlayer);
    
    if (!inPlayer || !outPlayer) return;

    await handleAddEvent(
      "substitution", 
      showSubModal.teamId, 
      undefined, 
      undefined, 
      `${outPlayer.playerName} ➔ ${inPlayer.playerName}`
    );
    
    setShowSubModal(null);
    setSubInPlayer("");
    setSubOutPlayer("");
  };

  const handleNextPeriod = async () => {
    if (!match?.liveState) return;
    const next = match.liveState.currentPeriod + 1;
    if (next > 4) return;
    
    try {
      await updateMatchPeriod(id, next);
      if (match.liveState.isTimerRunning) {
        await pauseMatchTimer(id, displayTime);
      }
      toast.success("Période mise à jour");
    } catch (err) {
      toast.error("Erreur technique");
    }
  };

  const handleFinishMatch = async () => {
    if (!window.confirm("Confirmer la fin du match ? Les scores seront définitifs.")) return;
    setIsSubmitting(true);
    try {
       await updateMatchStatus(id, "completed");
       toast.success("Match terminé ! Bravo pour l'arbitrage.");
       router.push("/referee-panel/matches");
    } catch (err) {
      console.error("Match finish error:", err);
      toast.error("Erreur technique : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Préparation du terrain...</p>
      </div>
    );
  }

  if (!match) return <div>Match non trouvé</div>;

  // Initialize if not live
  if (match.status !== "live" && match.status !== "completed") {
    const lineupsReady = match.homeLineupReady && match.awayLineupReady;
    
    return (
      <div className="flex h-screen flex-col items-center justify-center p-8 text-center bg-gray-50/30">
        <div className="relative mb-12">
           <div className="absolute inset-0 blur-3xl bg-amber-500/20 rounded-full" />
           <Flame size={100} className="relative text-amber-500 animate-pulse" />
        </div>
        <h2 className="text-4xl font-black text-gray-900 font-display tracking-tight">Prêt à arbitrer ?</h2>
        <p className="mt-4 max-w-sm text-lg text-gray-500 leading-relaxed font-medium">
          Le coup d&apos;envoi marquera le début du match en <span className="text-emerald-600 font-bold">Direct</span>.
        </p>

        <div className="mt-12 w-full max-w-sm space-y-4">
          <div className="flex items-center justify-between p-6 rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${match.homeLineupReady ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {match.homeLineupReady ? <CheckCircle2 size={24} /> : <Clock size={24} />}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Home Lineup</p>
                <p className="text-sm font-black text-gray-900">{match.homeTeamName}</p>
              </div>
            </div>
            {!match.homeLineupReady && <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-tighter">Attente</span>}
          </div>

          <div className="flex items-center justify-between p-6 rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 rounded-2xl flex items-center justify-center ${match.awayLineupReady ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {match.awayLineupReady ? <CheckCircle2 size={24} /> : <Clock size={24} />}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Away Lineup</p>
                <p className="text-sm font-black text-gray-900">{match.awayTeamName}</p>
              </div>
            </div>
            {!match.awayLineupReady && <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-tighter">Attente</span>}
          </div>
        </div>

        {!lineupsReady ? (
          <div className="mt-12 p-8 rounded-[2.5rem] bg-amber-50 border border-amber-100/50 text-amber-800 text-sm font-bold flex flex-col items-center gap-4 max-w-sm">
             <div className="h-14 w-14 rounded-2xl bg-white shadow-sm flex items-center justify-center text-amber-500">
                <AlertTriangle size={24} />
             </div>
             <p className="leading-relaxed">
               L&apos;arbitre ne peut lancer le match que lorsque les deux managers ont <span className="text-amber-900 underline decoration-amber-500/30 underline-offset-4">validé leurs feuilles de match</span>.
             </p>
          </div>
        ) : (
          <button
            onClick={() => initLiveMatch(id)}
            className="mt-12 group relative inline-flex items-center gap-6 rounded-[2.5rem] bg-emerald-600 px-14 py-8 text-2xl font-black uppercase tracking-widest text-white shadow-[0_30px_60px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 rounded-[2.5rem] bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative">Lancer le Match</span>
            <Flame size={28} className="relative transition-transform group-hover:scale-125 group-hover:rotate-12" />
          </button>
        )}
      </div>
    );
  }

  const confirmedPlayers = participations.filter(p => p.status === "confirmed");
  const homePlayers = confirmedPlayers.filter(p => p.teamId === match.homeTeamId);
  const awayPlayers = confirmedPlayers.filter(p => p.teamId === match.awayTeamId);

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-32">
      {/* Header */}
      <div className="flex items-center justify-between px-4">
        <button 
          onClick={() => router.back()} 
          className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-gray-200/50 transition-all hover:scale-110 active:scale-90"
        >
          <ChevronLeft size={24} className="text-gray-400 group-hover:text-gray-900" />
        </button>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600">Match en Direct</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 font-display tracking-tight">
            {match.homeTeamName} <span className="text-gray-300 mx-2">vs</span> {match.awayTeamName}
          </h1>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-gray-200/50 text-gray-400 transition-all hover:text-gray-900">
          <Settings2 size={22} />
        </button>
      </div>

      {/* Main Scoreboard & Timer */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[3rem] bg-[#0A0A0B] p-10 text-white shadow-[0_40px_100px_rgba(0,0,0,0.15)]"
      >
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-full bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.3),transparent)] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 grid grid-cols-3 items-center">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-white/10 rounded-full" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-white/10 to-white/5 text-4xl font-black border border-white/10 shadow-2xl backdrop-blur-md">
                {match.homeTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-sm font-black uppercase tracking-tight text-white/50 mb-1 truncate max-w-[120px]">{match.homeTeamName}</h2>
              <div className="text-8xl font-black tracking-tighter drop-shadow-2xl">{match.scoreHome || 0}</div>
            </div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center">
            <div className="mb-6 rounded-full border border-white/5 bg-white/10 px-6 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400 backdrop-blur-xl">
              {PERIODS.find(p => p.id === match.liveState?.currentPeriod)?.label || "Match"}
            </div>
            <div className="relative flex flex-col items-center">
               <div className="absolute -inset-10 blur-3xl bg-emerald-500/10 rounded-full" />
               <div className="relative text-[5.5rem] font-mono font-black tracking-tighter text-emerald-500 tabular-nums leading-none">
                 {formatTime(displayTime)}
               </div>
            </div>
            <div className="mt-10 flex gap-6">
              {match.liveState?.isTimerRunning ? (
                <button
                  onClick={handlePauseTimer}
                  className="group relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-amber-500 text-white shadow-[0_15px_30px_rgba(245,158,11,0.3)] transition-all hover:bg-amber-600 hover:scale-110 active:scale-95"
                >
                  <Pause size={32} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleStartTimer}
                  className="group relative flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500 text-white shadow-[0_15px_30px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-600 hover:scale-110 active:scale-95"
                >
                  <Play size={32} fill="currentColor" className="ml-1" />
                </button>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-white/10 rounded-full" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[2.5rem] bg-gradient-to-br from-white/10 to-white/5 text-4xl font-black border border-white/10 shadow-2xl backdrop-blur-md">
                {match.awayTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-sm font-black uppercase tracking-tight text-white/50 mb-1 truncate max-w-[120px]">{match.awayTeamName}</h2>
              <div className="text-8xl font-black tracking-tighter drop-shadow-2xl">{match.scoreAway || 0}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Match Lock Banner */}
      {match.status === 'live' && (
        <div className="mx-4 sm:mx-0 p-4 rounded-3xl bg-amber-500 text-white flex items-center justify-between shadow-xl shadow-amber-500/20">
           <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                 <Shield size={20} />
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Session Arbitrage Active</p>
                 <p className="text-xs font-bold font-display italic">Veuillez ne pas quitter cette page avant le coup de sifflet final</p>
              </div>
           </div>
           <div className="hidden sm:block px-4 py-1.5 rounded-full bg-black/10 text-[10px] font-black uppercase tracking-widest border border-white/10">
              Contrôles verrouillés
           </div>
        </div>
      )}

      {/* Control Panel: 2 Grids */}
      <div className="grid gap-6 md:grid-cols-2 px-4 sm:px-0">
        {/* Home Team Grid */}
        <div className="rounded-[3rem] border border-gray-100 bg-white p-8 shadow-2xl shadow-gray-200/40 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full opacity-50 bg-emerald-100" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
               <div className="flex flex-col">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-1">Dominateurs (Grille)</h3>
                 <h2 className="text-xl font-black text-gray-900 tracking-tighter truncate max-w-[200px]">{match.homeTeamName}</h2>
               </div>
               <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black">
                 {match.scoreHome || 0}
               </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {participations.filter(p => p.teamId === match.homeTeamId && p.status === 'confirmed').map(p => (
                <button
                  key={p.playerId}
                  onClick={() => setSelectedPlayer({ player: p, teamId: match.homeTeamId, teamName: match.homeTeamName })}
                  className="group relative h-16 rounded-2xl border-2 border-gray-100 bg-gray-50/50 text-sm font-black transition-all flex items-center justify-center hover:border-emerald-500 hover:bg-white hover:text-emerald-600 hover:scale-105 active:scale-95"
                >
                  <span className="text-lg">{p.squadNumber || p.playerName[0].toUpperCase()}</span>
                  {p.matchRole === 'starter' && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                  {/* Subtle Tooltip-like label */}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-gray-900 text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                    {p.playerName}
                  </div>
                </button>
              ))}
              <button 
                onClick={() => setShowSubModal({ teamId: match.homeTeamId, teamName: match.homeTeamName })}
                className="h-16 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 flex flex-col items-center justify-center gap-1 hover:border-emerald-500 hover:text-emerald-500 transition-all"
              >
                <Plus size={16} />
                <span className="text-[8px] font-black uppercase">Sub</span>
              </button>
            </div>
          </div>
        </div>

        {/* Away Team Grid */}
        <div className="rounded-[3rem] border border-gray-100 bg-white p-8 shadow-2xl shadow-gray-200/40 relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full opacity-50 bg-blue-100" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
               <div className="flex flex-col">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 mb-1">Visiteurs (Grille)</h3>
                 <h2 className="text-xl font-black text-gray-900 tracking-tighter truncate max-w-[200px]">{match.awayTeamName}</h2>
               </div>
               <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black">
                 {match.scoreAway || 0}
               </div>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {participations.filter(p => p.teamId === match.awayTeamId && p.status === 'confirmed').map(p => (
                <button
                  key={p.playerId}
                  onClick={() => setSelectedPlayer({ player: p, teamId: match.awayTeamId, teamName: match.awayTeamName })}
                  className="group relative h-16 rounded-2xl border-2 border-gray-100 bg-gray-50/50 text-sm font-black transition-all flex items-center justify-center hover:border-blue-600 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95"
                >
                  <span className="text-lg">{p.squadNumber || p.playerName[0].toUpperCase()}</span>
                  {p.matchRole === 'starter' && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-600" />
                  )}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-gray-900 text-[8px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                    {p.playerName}
                  </div>
                </button>
              ))}
              <button 
                onClick={() => setShowSubModal({ teamId: match.awayTeamId, teamName: match.awayTeamName })}
                className="h-16 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 flex flex-col items-center justify-center gap-1 hover:border-blue-600 hover:text-blue-600 transition-all"
              >
                <Plus size={16} />
                <span className="text-[8px] font-black uppercase">Sub</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Selector Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPlayer(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-sm rounded-[3rem] bg-white p-10 shadow-3xl text-center"
            >
              <div className="mb-8">
                 <div className="mx-auto h-20 w-20 rounded-[2rem] bg-gray-900 text-white flex items-center justify-center text-3xl font-black mb-4 shadow-xl">
                   {selectedPlayer.player.squadNumber || selectedPlayer.player.playerName[0].toUpperCase()}
                 </div>
                 <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedPlayer.player.playerName}</h2>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1 italic">{selectedPlayer.teamName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <EventButton 
                    label="BUT !"
                    icon={<Trophy size={20} />}
                    color="amber"
                    onClick={() => {
                        handleAddEvent("goal", selectedPlayer.teamId, selectedPlayer.player.playerId, selectedPlayer.player.playerName);
                        setSelectedPlayer(null);
                    }}
                  />
                  <EventButton 
                    label="JAUNE"
                    icon={<div className="h-6 w-4 rounded-sm bg-amber-400 border border-amber-500/20" />}
                    color="gray"
                    onClick={() => {
                        handleAddEvent("yellow_card", selectedPlayer.teamId, selectedPlayer.player.playerId, selectedPlayer.player.playerName);
                        setSelectedPlayer(null);
                    }}
                  />
                  <EventButton 
                    label="ROUGE"
                    icon={<div className="h-6 w-4 rounded-sm bg-red-600 border border-red-700/20 shadow-inner" />}
                    color="red"
                    onClick={() => {
                        handleAddEvent("red_card", selectedPlayer.teamId, selectedPlayer.player.playerId, selectedPlayer.player.playerName);
                        setSelectedPlayer(null);
                    }}
                  />
                  <EventButton 
                    label="CANCEL"
                    icon={<Minus size={20} />}
                    color="light"
                    onClick={() => setSelectedPlayer(null)}
                  />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Timeline & Flow Control */}
      <div className="grid gap-8 md:grid-cols-3 px-2">
        {/* Flow Control */}
        <div className="rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-2xl shadow-gray-200/50 backdrop-blur-sm">
           <div className="flex items-center gap-3 mb-6">
              <Clock className="text-gray-400" size={20} />
              <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Match Workflow</h3>
           </div>
           <div className="space-y-4">
              <button
                disabled={match.liveState?.currentPeriod === 4}
                onClick={handleNextPeriod}
                className="group flex w-full items-center justify-between rounded-2xl bg-gray-900 px-6 py-5 text-sm font-bold text-white transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50"
              >
                <span>Passer à la période suivante</span>
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <button
                 onClick={handleFinishMatch}
                 className="flex w-full items-center justify-between rounded-2xl border-2 border-red-50 bg-red-50/50 px-6 py-5 text-sm font-bold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98]"
              >
                <span>Siffler la fin du match</span>
                <CheckCircle2 size={20} />
              </button>
           </div>
        </div>

        {/* Timeline */}
        <div className="md:col-span-2 rounded-[2.5rem] border border-gray-100 bg-white p-8 shadow-2xl shadow-gray-200/50">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <History className="text-gray-400" size={20} />
              <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Événements</h3>
            </div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">
              {match.liveState?.events?.length || 0} Total
            </div>
          </div>
          <div className="max-h-[350px] overflow-y-auto pr-4 space-y-4 custom-scrollbar">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={event.id} 
                  className="flex items-center gap-6 group"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-50 text-xs font-black border border-gray-100 shadow-sm transition-colors group-hover:bg-emerald-50/50 group-hover:border-emerald-100 group-hover:text-emerald-600">
                    {event.minute}&apos;
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                       {event.type === "goal" && <Trophy size={16} className="text-amber-500" />}
                       {event.type === "yellow_card" && <div className="h-5 w-3.5 rounded-sm bg-amber-400 shadow-sm border border-amber-500/20" />}
                       {event.type === "red_card" && <div className="h-5 w-3.5 rounded-sm bg-red-600 shadow-sm border border-red-700/20" />}
                       {event.type === "substitution" && <ArrowRightLeft size={16} className="text-blue-500" />}
                       <span className="text-sm font-black text-gray-900 uppercase tracking-tight">
                         {event.type === "goal" ? "BUT !" : event.type === "yellow_card" ? "Carton Jaune" : event.type === "red_card" ? "Carton Rouge" : "Changement"}
                       </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-gray-400 uppercase tracking-tighter">
                      {event.detail ? (
                        <span className="text-blue-600">{event.detail}</span>
                      ) : (
                        <span>{event.playerName || "Joueur Inconnu"} • {event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName}</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="h-16 w-16 rounded-full bg-gray-50 flex items-center justify-center mb-4">
                   <History size={32} className="text-gray-200" />
                </div>
                <p className="text-sm font-bold text-gray-300 uppercase tracking-widest italic">Le match attend ses premiers coups d&apos;éclat</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Substitution Modal */}
      <AnimatePresence>
        {showSubModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSubModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md rounded-[3rem] bg-white p-10 shadow-2xl"
            >
              <h2 className="mb-2 text-2xl font-black text-gray-900">Nouveau changement</h2>
              <p className="mb-8 text-sm font-bold text-gray-400 italic uppercase tracking-tight">{showSubModal.teamName}</p>
              
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Joueur Sortant</label>
                  <select
                    value={subOutPlayer}
                    onChange={(e) => setSubOutPlayer(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-sm font-bold outline-none focus:border-red-500 transition-colors"
                  >
                    <option value="">Sélectionner...</option>
                    {(showSubModal.teamId === match.homeTeamId ? homePlayers : awayPlayers).map(p => (
                      <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center">
                   <div className="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center text-white shadow-lg">
                      <ArrowRightLeft size={24} />
                   </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Joueur Entrant</label>
                  <select
                    value={subInPlayer}
                    onChange={(e) => setSubInPlayer(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
                  >
                    <option value="">Sélectionner...</option>
                    {(showSubModal.teamId === match.homeTeamId ? homePlayers : awayPlayers).map(p => (
                      <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSubstitution}
                  disabled={!subInPlayer || !subOutPlayer || isSubmitting}
                  className="mt-4 w-full rounded-3xl bg-gray-900 py-5 text-sm font-black uppercase tracking-widest text-white shadow-xl transition-all hover:bg-black active:scale-95 disabled:opacity-50"
                >
                  Valider le changement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e5e5e5;
        }
      `}</style>
    </div>
  );
}

function EventButton({ label, icon, color, onClick }: { label: string; icon: any; color: string; onClick: () => void }) {
  const colorBgs: Record<string, string> = {
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    red: "bg-red-600 text-white shadow-red-600/20",
    gray: "bg-gray-100 text-gray-900 shadow-gray-200/50",
    light: "bg-gray-50 text-gray-400"
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-2 p-6 rounded-3xl transition-all hover:scale-105 active:scale-95 shadow-lg ${colorBgs[color] || colorBgs.gray}`}
    >
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
