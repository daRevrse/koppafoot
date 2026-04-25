"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Timer, Shield, History, ChevronLeft, Trophy, Activity,
  MapPin, Calendar, Clock, UserPlus, Users, Info, 
  CheckCircle2, XCircle, AlertCircle, Share2, MoreVertical,
  ChevronRight, Star, Save, ClipboardList, RefreshCcw
} from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import {
  toMatch, toParticipation,
  invitePlayerToMatch, respondToParticipation,
  getMatchParticipations, getTeamMembers,
  updateMatchLineup, submitManagerFeedback,
  contestMatchEvent, getTeamById,
  getGhostPlayersByTeam,
} from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Match, Participation, Team, FirestoreMatch, FirestoreParticipation, UserProfile, GhostPlayer } from "@/types";

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
// Main Component
// ============================================

export default function MatchDetailPage() {
  const { id } = useParams() as { id: string };
  const { user } = useAuth();
  const router = useRouter();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"center" | "squad" | "info">("center");
  const [displayTime, setDisplayTime] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [lineupMode, setLineupMode] = useState(false);
  const [tempAssignments, setTempAssignments] = useState<Record<string, { squadNumber: string; role: "starter" | "substitute" }>>({});
  const [savingLineup, setSavingLineup] = useState(false);
  const [validatingLineup, setValidatingLineup] = useState(false);

  const [contestingEventId, setContestingEventId] = useState<string | null>(null);
  const [contestationReason, setContestationReason] = useState("");
  const [submittingContestation, setSubmittingContestation] = useState(false);

  const handleContestEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !user || !contestingEventId || !contestationReason.trim()) return;
    setSubmittingContestation(true);
    try {
      await contestMatchEvent(match.id, contestingEventId, user.uid, contestationReason);
      toast.success("Événement contesté avec succès");
      setContestingEventId(null);
      setContestationReason("");
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    } finally {
      setSubmittingContestation(false);
    }
  };

  const [validation, setValidation] = useState<"validated" | "contested">("validated");
  const [managerComments, setManagerComments] = useState("");
  const [refereeRating, setRefereeRating] = useState(5);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [ghostPlayers, setGhostPlayers] = useState<GhostPlayer[]>([]);

  // 1. Check Roles & IDs
  const isManager = useMemo(() => {
    if (!match || !user) return false;
    return user.uid === match.managerId || user.uid === match.awayManagerId;
  }, [match, user]);

  const myTeamId = useMemo(() => {
    if (!match || !user) return null;
    if (user.uid === match.managerId) return match.homeTeamId;
    if (user.uid === match.awayManagerId) return match.awayTeamId;
    return null;
  }, [match, user]);

  const isHomeManager = useMemo(() => user?.uid === match?.managerId, [user, match]);

  const isMyTeamReady = useMemo(() => {
    if (!match || !user) return false;
    if (user.uid === match.managerId) return match.homeLineupReady;
    if (user.uid === match.awayManagerId) return match.awayLineupReady;
    return false;
  }, [match, user]);

  const myParticipation = useMemo(() => {
    return participations.find(p => p.playerId === user?.uid);
  }, [participations, user]);

  // 1. Fetch Match Data (Real-time)
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "matches", id), (snap) => {
      if (snap.exists()) {
        setMatch(toMatch(snap.id, snap.data() as FirestoreMatch));
        setLoading(false);
      } else {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [id]);

  // 2. Fetch Participations (Real-time)
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, "participations"), where("match_id", "==", id));
    const unsub = onSnapshot(q, (snap) => {
      const parts = snap.docs.map(d => toParticipation(d.id, d.data() as FirestoreParticipation));
      setParticipations(parts);
    });
    return () => unsub();
  }, [id]);

  // 3. Fetch Team Members for invitations (if manager)
  useEffect(() => {
    if (!myTeamId || !isManager) return;
    const fetchMembers = async () => {
      try {
        const users = await getTeamMembers(myTeamId);
        setTeamMembers(users);
      } catch (error) {
        console.error("Failed to fetch team members", error);
      }
    };
    fetchMembers();
  }, [myTeamId, isManager]);

  // Fetch team details for squad numbers
  useEffect(() => {
    if (myTeamId) {
      getTeamById(myTeamId).then(setMyTeam).catch(console.error);
    }
  }, [myTeamId]);

  // Load ghost players for lineup
  useEffect(() => {
    if (!myTeamId) return;
    getGhostPlayersByTeam(myTeamId).then(setGhostPlayers).catch(console.error);
  }, [myTeamId]);

  // 3. Timer Logic
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


  // 5. Build Squads
  const homeSquad = participations.filter(p => p.teamId === match?.homeTeamId);
  const awaySquad = participations.filter(p => p.teamId === match?.awayTeamId);

  // 6. Actions
  const handleJoin = async () => {
    if (!match || !user || !myTeamId) return;
    try {
      await invitePlayerToMatch(
        match.id,
        `${match.homeTeamName} vs ${match.awayTeamName}`,
        match.date,
        match.time,
        match.venueName,
        user.uid,
        `${user.firstName} ${user.lastName}`,
        myTeamId,
        match.format,
        user.uid === match.managerId, 
        match.autoAcceptPlayers || false
      );
    } catch (error) {
      console.error("Join failed", error);
    }
  };

  const handleInvitePlayer = async (player: UserProfile) => {
    if (!match || !myTeamId) return;
    setInviting(true);
    try {
      await invitePlayerToMatch(
        match.id,
        `${match.homeTeamName} vs ${match.awayTeamName}`,
        match.date,
        match.time,
        match.venueName,
        player.uid,
        `${player.firstName} ${player.lastName}`,
        myTeamId,
        match.format,
        true, // isConfirmed since manager is inviting
        match.autoAcceptPlayers || false
      );
    } catch (error) {
      console.error("Invitation failed", error);
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full border-t-2 border-emerald-500 animate-spin" />
          <div className="absolute inset-2 rounded-full border-b-2 border-emerald-400/30 animate-spin-slow" />
          <Activity className="absolute inset-0 m-auto h-8 w-8 text-emerald-500 animate-pulse" />
        </div>
        <p className="text-sm font-black uppercase tracking-widest text-emerald-600/50 italic animate-pulse">Chargement du terrain...</p>
      </div>
    );
  }

  if (!match) return <div className="p-8 text-center text-gray-500">Match non trouvé</div>;

  const isLive = match.status === "live";

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6 pb-24 px-0 sm:px-6">
      {/* Back Button & Share */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => router.back()} 
          className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-gray-100/50 border border-gray-100 text-gray-600 transition-all hover:scale-105 active:scale-95"
        >
          <ChevronLeft size={24} className="transition-transform group-hover:-translate-x-0.5" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-6 py-2 rounded-2xl bg-white border border-gray-100 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 italic">Match ID:</span>
          <span className="text-[10px] font-mono font-bold text-gray-900">{id.slice(0, 8)}</span>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xl shadow-gray-100/50 border border-gray-100 text-gray-600 transition-all hover:scale-105 active:scale-95">
          <Share2 size={20} />
        </button>
      </div>

      {/* Main Scoreboard Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-[2rem] sm:rounded-[3.5rem] bg-gradient-to-br from-gray-950 via-gray-900 to-black p-5 sm:p-12 text-white shadow-2xl"
      >
        {/* Background Accents */}
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px]" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-blue-500/10 blur-[100px]" />
        
        {/* Match Header */}
        <div className="relative z-10 flex flex-col items-center mb-6 sm:mb-10">
          <div className="flex flex-wrap justify-center gap-2 mb-4">
            <div className={`flex items-center gap-2 px-4 py-1 rounded-full border border-white/5 backdrop-blur-md ${isLive ? 'bg-red-500/10' : 'bg-white/5'}`}>
              {isLive ? (
                <>
                  <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">En Direct</span>
                </>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                  {match.status === "completed" ? "Terminé" : "A venir"}
                </span>
              )}
            </div>
            {match.status === "completed" && (
              <div className={`flex items-center gap-2 px-4 py-1 rounded-full border backdrop-blur-md ${
                match.validationStatus === 'validated' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                match.validationStatus === 'contested' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
                'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {match.validationStatus === 'validated' ? <CheckCircle2 size={10} /> : 
                 match.validationStatus === 'contested' ? <AlertCircle size={10} /> : <Clock size={10} />}
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                  {match.validationStatus === 'validated' ? 'Validé' : 
                   match.validationStatus === 'contested' ? 'Contesté' : 'En attente'}
                </span>
              </div>
            )}
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 italic">{match.format} • {match.venueCity}</p>
        </div>

        <div className="relative z-10 grid grid-cols-3 items-center gap-4 sm:gap-8">
          {/* Home Team */}
          <div className="text-center group">
            <div className="relative mx-auto mb-6 flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-[2.5rem] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-inner transition-transform group-hover:scale-105">
               <span className="text-2xl sm:text-4xl font-black">{match.homeTeamName?.[0] || "?"}</span>
               {match.status === "live" && <Activity className="absolute -right-2 -top-2 text-emerald-500 animate-pulse" size={16} />}
            </div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider mb-2 text-white/90 line-clamp-1">{match.homeTeamName}</h2>
            <div className="text-4xl sm:text-8xl font-black tracking-tighter text-white tabular-nums">{match.scoreHome || 0}</div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center justify-center">
            <div className={`mb-4 sm:mb-6 rounded-2xl sm:rounded-3xl ${isLive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'} border px-3 sm:px-4 py-1.5 sm:py-2 text-[9px] sm:text-xs font-black uppercase tracking-widest`}>
               {PERIODS.find(p => p.id === match.liveState?.currentPeriod)?.label || "Prép."}
            </div>
            {match.liveState ? (
              <div className="text-3xl sm:text-6xl font-mono font-black text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                {formatTime(displayTime)}
              </div>
            ) : (
               <div className="text-2xl sm:text-4xl font-black text-white/10 italic">VS</div>
            )}
            {!isLive && match.status !== "completed" && (
                <div className="mt-5 sm:mt-8 flex flex-col items-center">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Coup d'envoi</p>
                    <p className="text-lg font-black text-white/80">{match.time}</p>
                </div>
            )}
          </div>

          {/* Away Team */}
          <div className="text-center group">
            <div className="relative mx-auto mb-6 flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-[2.5rem] bg-white/5 backdrop-blur-2xl border border-white/10 shadow-inner transition-transform group-hover:scale-105">
               <span className="text-2xl sm:text-4xl font-black">{match.awayTeamName?.[0] || "?"}</span>
            </div>
            <h2 className="text-xs sm:text-sm font-black uppercase tracking-wider mb-2 text-white/90 line-clamp-1">{match.awayTeamName}</h2>
            <div className="text-4xl sm:text-8xl font-black tracking-tighter text-white tabular-nums">{match.scoreAway || 0}</div>
          </div>
        </div>
      </motion.div>

      {/* Tabs Control */}
      <div className="flex p-1.5 gap-1 rounded-[2rem] bg-white shadow-xl shadow-gray-100/50 border border-gray-100">
        {[
          { id: "center", label: "Match Center", icon: Activity },
          { id: "squad", label: "Feuille de Match", icon: ClipboardList },
          { id: "info", label: "Informations", icon: Info },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`relative flex flex-1 items-center justify-center gap-1.5 sm:gap-2 py-2.5 sm:py-3.5 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.id ? "text-emerald-600" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTabBadge"
                className="absolute inset-0 rounded-2xl bg-emerald-50 border border-emerald-100"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <tab.icon size={16} className="relative z-10" />
            <span className="relative z-10 hidden sm:block">{tab.label}</span>
            {tab.id === "squad" && isManager && (
              (() => {
                const isHomeManager = user?.uid === match.managerId;
                const isReady = isHomeManager ? match.homeLineupReady : match.awayLineupReady;
                return !isReady ? (
                  <span className="relative z-20 flex h-2.5 w-2.5 ml-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                  </span>
                ) : (
                  <CheckCircle2 size={12} className="relative z-20 text-emerald-500 ml-1.5 bg-white rounded-full" />
                );
              })()
            )}
          </button>
        ))}

      </div>



      {/* Tab Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === "center" && (
            <motion.div
              key="center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              {/* Manager LINEUP Validation Banner */}
              {isManager && (match.status === "upcoming" || match.status === "delayed") && !isMyTeamReady && (
                <div className="rounded-[1.5rem] sm:rounded-[2.5rem] bg-amber-50 border border-amber-200 p-4 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                   <div className="h-14 w-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                      <ClipboardList size={28} />
                   </div>
                   <div className="flex-1">
                      <h4 className="text-lg font-black text-amber-900 leading-tight">Feuille de match non validée !</h4>
                      <p className="text-sm text-amber-800/70 mb-4 font-bold">Vous devez confirmer votre effectif (numéros & rôles) avant que l'arbitre ne puisse lancer le match.</p>
                      <button 
                         onClick={() => setActiveTab("squad")}
                         className="px-6 py-2.5 rounded-xl bg-amber-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20"
                      >
                         Remplir la feuille de match
                      </button>
                   </div>
                </div>
              )}

              {/* Post-Match Validation Banner */}
              {isManager && match.status === "completed" && (!match.postMatchFeedback || !match.postMatchFeedback[user?.uid!]) && (
                <div className="rounded-[1.5rem] sm:rounded-[2.5rem] bg-primary-50 border border-primary-200 p-4 sm:p-8 shadow-sm">
                   <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                      <div className="h-14 w-14 rounded-2xl bg-primary-100 flex items-center justify-center text-primary-600 shrink-0">
                         <Star size={28} />
                      </div>
                      <div>
                         <h4 className="text-lg font-black text-primary-900 leading-tight">Validation du rapport de match</h4>
                         <p className="text-sm text-primary-800/70 font-bold">Le match est terminé. Merci de valider le score et les événements enregistrés.</p>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-3">
                      <button 
                         onClick={async () => {
                           if (!user?.uid) return;
                           try {
                             await submitManagerFeedback(match.id, user.uid, { validation: "validated" }, myTeamId ? { teamId: myTeamId, ghostPlayers } : undefined);
                             toast.success("Match validé ! Merci.");
                           } catch (e) {
                             toast.error("Erreur lors de la validation");
                           }
                         }}
                         className="px-6 py-3 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                      >
                         <CheckCircle2 size={14} /> Valider le Match
                      </button>
                      <button 
                         onClick={() => {
                           const reason = prompt("Raison de la contestation :");
                           if (reason && user?.uid) {
                             submitManagerFeedback(match.id, user.uid, { validation: "contested", comments: reason }, myTeamId ? { teamId: myTeamId, ghostPlayers } : undefined)
                               .then(() => toast.success("Contestation enregistrée"))
                               .catch(() => toast.error("Erreur"));
                           }
                         }}
                         className="px-6 py-3 rounded-xl bg-white border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2"
                      >
                         <XCircle size={14} /> Contester
                      </button>
                   </div>
                </div>
              )}

              {/* Match Validated State */}
              {match.status === "completed" && match.validationStatus === "validated" && (
                <div className="rounded-[1.5rem] sm:rounded-[2.5rem] bg-emerald-50 border border-emerald-100 p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-sm font-bold text-emerald-800">Ce match a été validé par les deux managers.</p>
                </div>
              )}

              {/* Event Timeline */}
              <div className="rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-gray-100 p-4 sm:p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4 sm:mb-8">
                  <h3 className="text-lg font-black text-gray-900 font-display">Timeline</h3>
                  <History className="text-gray-200" size={24} />
                </div>

                <div className="relative">
                  <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gray-50" />
                  <div className="space-y-8 relative">
                    {match.status === "completed" && (
                         <div className="flex items-start gap-6 group">
                           <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm bg-gray-900 border-black text-white transition-all group-hover:scale-110">
                             <CheckCircle2 size={16} />
                           </div>
                           <div className="flex-1 pt-1">
                             <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                                  Match Terminé
                                </span>
                             </div>
                             <div className="flex items-center justify-between">
                               <p className="text-[11px] font-bold text-gray-500">
                                 Score final : {match.scoreHome} - {match.scoreAway}
                               </p>
                             </div>
                           </div>
                         </div>
                    )}
                    {match.liveState?.events && match.liveState.events.length > 0 ? (
                      [...match.liveState.events].reverse().map((event, i) => (
                        <div key={event.id} className="flex items-start gap-6 group">
                          <div className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 shadow-sm transition-all group-hover:scale-110 ${
                            event.type === "goal" ? "bg-emerald-50 border-emerald-100 text-emerald-500" : 
                            event.type === "yellow_card" || event.type === "red_card" ? "bg-red-50 border-red-100 text-red-500" :
                            "bg-gray-50 border-gray-100 text-gray-400"
                          }`}>
                            <span className="text-[10px] font-black">{event.minute}'</span>
                          </div>

                          <div className="flex-1 pt-1">
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-sm font-black text-gray-900 uppercase tracking-wide">
                                 {event.type === "goal" ? "BUT !" : event.type === "yellow_card" ? "Carton Jaune" : event.type === "red_card" ? "Carton Rouge" : event.type === "substitution" ? "Changement" : "Action"}
                               </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-bold text-gray-500">
                                {event.playerName || "Action"} {event.detail && `• ${event.detail}`}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-300 italic">
                                  {event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName}
                                </p>
                                {match.status === "completed" && match.validationStatus !== "validated" && isManager && (
                                  <>
                                    {event.contestedByManagerId ? (
                                      <span className="flex items-center gap-1 rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-orange-500">
                                        <AlertCircle size={10} />
                                        Contesté
                                      </span>
                                    ) : (
                                      <button 
                                        onClick={() => setContestingEventId(event.id)}
                                        className="rounded border border-gray-200 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                      >
                                        Contester
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : match.status !== "completed" ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                         <Activity size={48} className="text-gray-200 mb-4" />
                         <p className="max-w-[200px] text-xs font-bold text-gray-400 italic">En attente des premiers éclats de génie sur le terrain...</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "squad" && (
            <motion.div
              key="squad"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-8"
            >
              {isManager && (
                (() => {
                  const isHomeManager = user?.uid === match.managerId;
                  const isReady = isHomeManager ? match.homeLineupReady : match.awayLineupReady;
                  
                  if (match.status !== 'upcoming' && match.status !== 'live' && match.status !== 'pending') return null;
                  
                  return (
                    <div className={`mx-0 sm:mx-4 mb-4 sm:mb-8 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] border transition-all ${
                      isReady 
                        ? 'bg-emerald-50/50 border-emerald-100/50 text-emerald-900 group' 
                        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 shadow-xl shadow-amber-200/20'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                        <div className={`p-4 rounded-[1.5rem] shadow-sm transition-transform ${
                          isReady ? 'bg-emerald-500 text-white group-hover:scale-110' : 'bg-white text-amber-500'
                        }`}>
                          {isReady ? <CheckCircle2 size={28} /> : <ClipboardList size={28} />}
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-base font-black uppercase tracking-wider mb-1 ${isReady ? 'text-emerald-900' : 'text-amber-950'}`}>
                            {isReady ? "Feuille de match validée" : "Validation de la feuille de match"}
                          </h4>
                          <p className={`text-xs leading-relaxed mb-4 sm:mb-6 ${isReady ? 'text-emerald-700/70 italic' : 'text-amber-900/60'}`}>
                            {isReady 
                              ? `Votre équipe est prête pour le coup d'envoi. Les numéros et rôles ont été transmis à l'arbitre.` 
                              : `Avant le début du match, vous devez définir vos titulaires (${match?.format ? parseInt(match.format.split('v')[0]) : "?"}) et leurs numéros de maillot.`}
                          </p>
                          
                          {!lineupMode && (
                            <button
                              onClick={() => {
                                const initial: Record<string, any> = {};
                                participations.forEach(p => {
                                  if (p.teamId === myTeamId && p.status === 'confirmed') {
                                    initial[p.playerId] = {
                                      squadNumber: p.squadNumber || (myTeam?.squadNumbers?.[p.playerId] || ""),
                                      role: p.matchRole || "starter"
                                    };
                                  }
                                });
                                setTempAssignments(initial);
                                setLineupMode(true);
                              }}
                              className={`px-5 sm:px-8 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl ${
                                isReady 
                                  ? 'bg-white text-emerald-600 border border-emerald-100 hover:bg-emerald-50' 
                                  : 'bg-gray-900 text-white hover:bg-black shadow-gray-900/20'
                              }`}
                            >
                              {isReady ? "Modifier la feuille" : "Remplir la feuille de match"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {isManager && lineupMode && (
                <div className="mx-0 sm:mx-4 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-gray-900 text-white shadow-2xl space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg sm:text-xl font-black italic tracking-tight">Configuration Tactique</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-1">Assignez les dossiers et rôles</p>
                    </div>
                    <div className="h-14 w-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                       <Trophy className="text-emerald-400" size={24} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Titulaires</p>
                       <span className={`text-2xl font-black ${
                         Object.values(tempAssignments).filter(a => a.role === 'starter').length === (match?.format ? parseInt(match.format.split('v')[0]) : 0) ? 'text-emerald-400' : 'text-amber-400'
                       }`}>
                         {Object.values(tempAssignments).filter(a => a.role === 'starter').length} / {match?.format ? parseInt(match.format.split('v')[0]) : "?"}
                       </span>
                    </div>
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Remplaçants</p>
                       <span className="text-2xl font-black text-white/80">
                         {Object.values(tempAssignments).filter(a => a.role === 'substitute').length}
                       </span>
                    </div>
                  </div>

                  {/* Ghost players section in lineup mode */}
                  {ghostPlayers.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Joueurs sans compte</p>
                      {ghostPlayers.map((ghost) => (
                        <div key={ghost.id} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                          <div>
                            <p className="text-sm font-black text-white">{ghost.firstName} {ghost.lastName}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">{ghost.position}{ghost.squadNumber ? ` · N°${ghost.squadNumber}` : ""}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              placeholder="N°"
                              maxLength={3}
                              className="w-12 h-9 rounded-xl bg-white/10 border border-white/10 text-center text-xs font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                              value={tempAssignments[ghost.id]?.squadNumber || ghost.squadNumber || ""}
                              onChange={(e) => setTempAssignments(prev => ({
                                ...prev,
                                [ghost.id]: { ...prev[ghost.id], squadNumber: e.target.value }
                              }))}
                            />
                            <select
                              className="h-9 px-2 rounded-xl bg-white/10 border border-white/10 text-[10px] font-black uppercase text-white focus:outline-none"
                              value={tempAssignments[ghost.id]?.role || "starter"}
                              onChange={(e) => setTempAssignments(prev => ({
                                ...prev,
                                [ghost.id]: { ...prev[ghost.id], role: e.target.value as "starter" | "substitute" }
                              }))}
                            >
                              <option value="starter">Titu</option>
                              <option value="substitute">Sub</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={() => setLineupMode(false)}
                      className="flex-1 py-4 rounded-2xl bg-white/5 text-white/60 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={async () => {
                        if (!match || !myTeamId) return;
                        setValidatingLineup(true);
                        try {
                          const assignments = Object.entries(tempAssignments).map(([playerId, val]) => ({
                            playerId,
                            squadNumber: val.squadNumber,
                            role: val.role
                          }));
                          // This updateMatchLineup also sets the ready flag in firestore
                          await updateMatchLineup(match.id, myTeamId, user?.uid === match.managerId, assignments);
                          setLineupMode(false);
                          toast.success("Feuille de match validée !");
                        } catch (err) {
                          console.error(err);
                          toast.error("Erreur lors de la validation");
                        } finally {
                          setValidatingLineup(false);
                        }
                      }}
                      disabled={validatingLineup}
                      className="flex-[2] py-4 rounded-2xl bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      {validatingLineup ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
                      Envoyer à l'arbitre
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {/* Home Squad */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-gray-400 italic">{match.homeTeamName}</h3>
                    <span className="px-3 py-1 rounded-full bg-gray-50 text-[10px] font-black text-gray-500 border border-gray-100">
                      {homeSquad.filter(p => p.status === 'confirmed').length} Confirmés
                    </span>
                  </div>
                  <div className="space-y-2">
                    {homeSquad.map(player => (
                      <div key={player.id} className="group flex items-center justify-between p-4 rounded-3xl bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-sm ${player.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {player.playerName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 line-clamp-1">{player.playerName}</p>
                            <div className="flex items-center gap-2">
                              <p className={`text-[10px] font-black uppercase tracking-widest ${player.status === 'confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {player.status === 'confirmed' ? 'Présent' : 'Invité'}
                              </p>
                              {player.matchRole && (
                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase border ${
                                  player.matchRole === 'starter' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                }`}>
                                  {player.matchRole === 'starter' ? 'Titulaire' : 'Remplaçant'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {lineupMode && player.teamId === myTeamId && player.status === 'confirmed' ? (
                          <div className="flex items-center gap-2">
                             <input 
                               type="text"
                               placeholder="N°"
                               maxLength={3}
                               className="w-12 h-9 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                               value={tempAssignments[player.playerId]?.squadNumber || ""}
                               onChange={(e) => setTempAssignments(prev => ({
                                 ...prev,
                                 [player.playerId]: { ...prev[player.playerId], squadNumber: e.target.value }
                               }))}
                             />
                             <select
                               className="h-9 px-2 rounded-xl bg-gray-50 border border-gray-200 text-[10px] font-black uppercase focus:outline-none"
                               value={tempAssignments[player.playerId]?.role || "starter"}
                               onChange={(e) => setTempAssignments(prev => ({
                                 ...prev,
                                 [player.playerId]: { ...prev[player.playerId], role: e.target.value as any }
                               }))}
                             >
                               <option value="starter">Titu</option>
                               <option value="substitute">Sub</option>
                             </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            {player.squadNumber && (
                              <span className="text-lg font-black text-gray-300 tracking-tighter mr-1 self-center">#{player.squadNumber}</span>
                            )}
                            {player.status === 'confirmed' && <Star size={14} className="text-emerald-400" />}
                          </div>
                        )}
                      </div>
                    ))}
                    {homeSquad.length === 0 && (
                      <div className="p-8 text-center rounded-3xl border border-dashed border-gray-200">
                        <p className="text-xs font-bold text-gray-400 italic">Aucun joueur pour le moment</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Away Squad */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-gray-400 italic">{match.awayTeamName}</h3>
                    <span className="px-3 py-1 rounded-full bg-gray-50 text-[10px] font-black text-gray-500 border border-gray-100">
                      {awaySquad.filter(p => p.status === 'confirmed').length} Confirmés
                    </span>
                  </div>
                  <div className="space-y-2">
                    {awaySquad.map(player => (
                      <div key={player.id} className="group flex items-center justify-between p-4 rounded-3xl bg-white border border-gray-100 shadow-sm transition-all hover:shadow-md hover:border-emerald-100">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-sm ${player.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {player.playerName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 line-clamp-1">{player.playerName}</p>
                            <div className="flex items-center gap-2">
                              <p className={`text-[10px] font-black uppercase tracking-widest ${player.status === 'confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {player.status === 'confirmed' ? 'Présent' : 'Invité'}
                              </p>
                              {player.matchRole && (
                                <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase border ${
                                  player.matchRole === 'starter' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-gray-50 text-gray-400 border-gray-100'
                                }`}>
                                  {player.matchRole === 'starter' ? 'Titulaire' : 'Remplaçant'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {lineupMode && player.teamId === myTeamId && player.status === 'confirmed' ? (
                          <div className="flex items-center gap-2">
                             <input 
                               type="text"
                               placeholder="N°"
                               maxLength={3}
                               className="w-12 h-9 rounded-xl bg-gray-50 border border-gray-200 text-center text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                               value={tempAssignments[player.playerId]?.squadNumber || ""}
                               onChange={(e) => setTempAssignments(prev => ({
                                 ...prev,
                                 [player.playerId]: { ...prev[player.playerId], squadNumber: e.target.value }
                               }))}
                             />
                             <select
                               className="h-9 px-2 rounded-xl bg-gray-50 border border-gray-200 text-[10px] font-black uppercase focus:outline-none"
                               value={tempAssignments[player.playerId]?.role || "starter"}
                               onChange={(e) => setTempAssignments(prev => ({
                                 ...prev,
                                 [player.playerId]: { ...prev[player.playerId], role: e.target.value as any }
                               }))}
                             >
                               <option value="starter">Titu</option>
                               <option value="substitute">Sub</option>
                             </select>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            {player.squadNumber && (
                              <span className="text-lg font-black text-gray-300 tracking-tighter mr-1 self-center">#{player.squadNumber}</span>
                            )}
                            {player.status === 'confirmed' && <Star size={14} className="text-emerald-400" />}
                          </div>
                        )}
                      </div>
                    ))}
                    {awaySquad.length === 0 && (
                      <div className="p-8 text-center rounded-3xl border border-dashed border-gray-200">
                        <p className="text-xs font-bold text-gray-400 italic">Aucun joueur pour le moment</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Recruitment CTA if not full */}
              {!myParticipation && myTeamId && (
                <div className="mt-6 sm:mt-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-emerald-600 p-5 sm:p-8 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Trophy size={72} className="sm:hidden" />
                    <Trophy size={100} className="hidden sm:block" />
                  </div>
                  <div className="relative z-10 max-w-sm">
                    <h4 className="text-xl sm:text-2xl font-black mb-2">Rejoins le combat !</h4>
                    <p className="text-emerald-100 text-xs sm:text-sm font-medium mb-4 sm:mb-6">Ta team a besoin de renforts. Confirme ta présence pour porter fièrement tes couleurs.</p>
                    <button
                      onClick={handleJoin}
                      className="flex items-center gap-2 rounded-2xl bg-white px-5 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-emerald-600 transition-all hover:scale-105 active:scale-95 shadow-lg"
                    >
                      Confirmer ma présence
                    </button>
                  </div>
                </div>
              )}

              {/* Manager Invitation Tools */}
              {isManager && teamMembers.length > 0 && match.status === "upcoming" && (
                <div className="mt-8 sm:mt-12 space-y-4 sm:space-y-6">
                  <div className="flex items-center gap-3 px-2 sm:px-4">
                    <UserPlus size={20} className="text-emerald-500" />
                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-gray-900">Inviter tes joueurs</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teamMembers
                      .filter(m => !participations.some(p => p.playerId === m.uid))
                      .map(m => (
                        <div key={m.uid} className="flex items-center justify-between p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-gray-50 border border-gray-100 transition-all hover:bg-white hover:shadow-md group">
                           <div className="flex items-center gap-3">
                             <div className="h-10 w-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center font-black text-sm text-gray-500 shadow-sm">
                               {m.profilePictureUrl ? (
                                 <img src={m.profilePictureUrl} alt="" className="h-full w-full object-cover rounded-2xl" />
                               ) : m.firstName[0]}
                             </div>
                             <div>
                               <p className="text-sm font-black text-gray-900 line-clamp-1">{m.firstName} {m.lastName}</p>
                               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{m.position || 'Joueur'}</p>
                             </div>
                           </div>
                           <button 
                             onClick={() => handleInvitePlayer(m)}
                             disabled={inviting}
                             className="h-10 w-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:grayscale"
                           >
                             <UserPlus size={16} />
                           </button>
                        </div>
                      ))}
                  </div>
                  {teamMembers.filter(m => !participations.some(p => p.playerId === m.uid)).length === 0 && (
                    <div className="p-8 text-center rounded-3xl bg-gray-50/50 border border-dashed border-gray-200">
                      <p className="text-xs font-black text-gray-300 uppercase tracking-widest italic">Tous les membres sont déjà sur la feuille de match</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-gray-100 shadow-sm flex flex-col items-center text-center">
                  <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mb-3 sm:mb-4">
                    <MapPin size={24} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Terrain</h4>
                  <p className="font-black text-gray-900 break-words">{match.venueName}</p>
                  <p className="text-xs font-bold text-gray-400">{match.venueCity}</p>
                </div>

                <div className="p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-gray-100 shadow-sm flex flex-col items-center text-center">
                  <div className="h-14 w-14 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mb-3 sm:mb-4">
                    <Shield size={24} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Arbitre</h4>
                  <p className="font-black text-gray-900 break-words">{match.refereeName || "Arbitre Officiel"}</p>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter truncate w-full">{match.refereeStatus === 'confirmed' ? '📋 Officiellement désigné' : '⏳ En attente de désignation'}</p>
                </div>
              </div>

              {/* Match Calendar Entry */}
              <div className="p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] bg-white border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 sm:gap-6">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 shrink-0 rounded-2xl sm:rounded-[2rem] bg-emerald-50 flex flex-col items-center justify-center border border-emerald-100">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">{match.date.split('-')[1]}</span>
                    <span className="text-xl sm:text-2xl font-black text-emerald-700">{match.date.split('-')[2]}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg sm:text-xl font-black text-gray-900 mb-1 truncate">{match.date}</h4>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-bold text-gray-400">
                      <div className="flex items-center gap-1.5 sm:border-r sm:border-gray-100 sm:pr-4">
                        <Clock size={14} />
                        <span>{match.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} />
                        <span>Calendrier Match</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Post-Match Feedback Section for Managers */}
      {isManager && match?.status === "completed" && (
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[3.5rem] bg-white border-2 border-emerald-500/20 p-5 sm:p-12 shadow-2xl mb-6 mt-6 sm:mt-8"
        >
          <div className="mb-6 sm:mb-8">
             <h3 className="text-lg sm:text-xl font-black text-gray-900 border-b border-gray-100 pb-3 sm:pb-4 mb-3 sm:mb-4">Validation Finale de la Feuille de Match</h3>
             <p className="text-gray-500 text-xs sm:text-sm">Le match est terminé. Veuillez valider le score final, les évènements et noter l'arbitre pour clore officiellement la rencontre.</p>
             <div className="mt-4 p-3 sm:p-4 rounded-2xl bg-amber-50 border border-amber-100">
               <p className="text-[11px] font-bold text-amber-700 flex items-start sm:items-center gap-2">
                 <AlertCircle size={14} className="shrink-0 mt-0.5 sm:mt-0" />
                 Note: Sans action sous 12h, le match sera validé automatiquement.
               </p>
             </div>
          </div>

          {user && match.postMatchFeedback?.[user.uid] ? (
             <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gray-50 border border-gray-100 space-y-4">
                <div className="flex items-center gap-2">
                   {match.postMatchFeedback[user.uid].validation === 'validated' ? (
                     <CheckCircle2 size={20} className="text-emerald-500" />
                   ) : (
                     <AlertCircle size={20} className="text-red-500" />
                   )}
                   <span className="font-black text-gray-900">
                     {match.postMatchFeedback[user.uid].validation === 'validated' ? 'Match Validé' : 'Match Contesté'}
                   </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400 uppercase font-black mr-2">Arbitrage :</span>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} className={i < (match.postMatchFeedback?.[user.uid]?.refereeRating || 0) ? "text-amber-400 fill-amber-400" : "text-gray-300"} />
                  ))}
                </div>
                {match.postMatchFeedback[user.uid].comments && (
                  <p className="text-sm text-gray-600 italic">« {match.postMatchFeedback[user.uid].comments} »</p>
                )}
             </div>
          ) : (
             <div className="space-y-6">
                <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Confirmation de la feuille de match</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                       <button
                          onClick={() => setValidation("validated")}
                          className={`flex-1 flex gap-2 justify-center items-center py-4 sm:py-5 rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-widest border transition-all ${validation === "validated" ? "bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-600/20" : "bg-white border-gray-200 text-gray-500 hover:border-emerald-200"}`}
                       >
                         <CheckCircle2 size={16} /> Valider le Score
                       </button>
                       <button
                          onClick={() => setValidation("contested")}
                          className={`flex-1 flex gap-2 justify-center items-center py-4 sm:py-5 rounded-2xl text-[11px] sm:text-xs font-black uppercase tracking-widest border transition-all ${validation === "contested" ? "bg-red-600 border-red-600 text-white shadow-xl shadow-red-600/20" : "bg-white border-gray-200 text-gray-500 hover:border-red-200"}`}
                       >
                         <XCircle size={16} /> Contester le Match
                       </button>
                    </div>
                 </div>

               <div>
                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Noter l'arbitre (sur 5)</label>
                 <div className="flex flex-wrap gap-2">
                   {Array.from({ length: 5 }).map((_, i) => (
                     <button
                       key={i}
                       onClick={() => setRefereeRating(i + 1)}
                       className={`h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center rounded-xl border transition-all ${
                         i < refereeRating ? "bg-amber-50 border-amber-400 text-amber-500 shadow-sm" : "bg-white border-gray-200 text-gray-400 hover:bg-gray-50"
                       }`}
                     >
                       <Star size={20} className={i < refereeRating ? "fill-amber-400 text-amber-500" : ""} />
                     </button>
                   ))}
                 </div>
               </div>

               <div>
                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Commentaire ({validation === 'contested' ? 'Requis' : 'Optionnel'})</label>
                 <textarea 
                   rows={3}
                   value={managerComments}
                   onChange={e => setManagerComments(e.target.value)}
                   className="w-full rounded-2xl border-gray-200 shadow-sm text-sm p-4 focus:ring-emerald-500 focus:border-emerald-500"
                   placeholder={validation === 'contested' ? "Expliquez la raison de votre contestation..." : "Un mot sur l'organisation ou l'arbitrage ?"}
                 />
               </div>

               <button
                 onClick={async () => {
                   if (validation === 'contested' && !managerComments.trim()) {
                     toast.error("Veuillez expliquer votre contestation.");
                     return;
                   }
                   if (!user) return;
                   setSubmittingFeedback(true);
                   try {
                     await submitManagerFeedback(match.id, user.uid, {
                       validation,
                       comments: managerComments,
                       refereeRating
                     }, myTeamId ? { teamId: myTeamId, ghostPlayers } : undefined);
                     toast.success("Retour envoyé à l'arbitre !");
                   } catch(e) {
                     console.error(e);
                     toast.error("Erreur lors de l'envoi du retour.");
                   } finally {
                     setSubmittingFeedback(false);
                   }
                 }}
                 disabled={submittingFeedback}
                 className="w-full h-14 rounded-2xl bg-gray-900 text-white font-black text-sm uppercase tracking-widest shadow-xl flex justify-center items-center gap-2 hover:bg-gray-800 transition-all active:scale-[0.98]"
               >
                 {submittingFeedback ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
                 Valider et envoyer
               </button>
             </div>
          )}
        </motion.div>
      )}

      {/* Floating Action for Managers */}
      {isManager && match?.status !== "completed" && (
        <div className="fixed bottom-20 sm:bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm px-3 sm:px-4 flex gap-2 z-40">
            <button
              onClick={() => setActiveTab("squad")}
              className="flex-1 flex items-center justify-center gap-2 h-14 sm:h-16 rounded-[1.5rem] sm:rounded-[2rem] bg-gray-900 text-white font-black uppercase tracking-widest text-[10px] shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              <UserPlus size={18} />
              Gérer l'effectif
            </button>
            <button
              onClick={() => router.push(`/referee-panel/matches/${id}/manage`)}
              className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-[1.5rem] sm:rounded-[2rem] bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20 transition-all hover:scale-110 active:scale-90"
            >
              <Activity size={24} />
            </button>
        </div>
      )}

      {/* Contestation Modal */}
      <AnimatePresence>
        {contestingEventId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setContestingEventId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl"
            >
              <button
                onClick={() => setContestingEventId(null)}
                className="absolute right-6 top-6 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <XCircle size={24} />
              </button>

              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 border border-orange-100">
                <AlertCircle className="text-orange-500" size={32} />
              </div>

              <h2 className="mb-2 text-2xl font-black text-gray-900 font-display">Contester l'événement</h2>
              <p className="mb-6 text-sm text-gray-500">
                Veuillez expliquer pourquoi vous contestez cet événement. Cette information sera examinée.
              </p>

              <form onSubmit={handleContestEvent} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">Raison de la contestation</label>
                  <textarea
                    value={contestationReason}
                    onChange={(e) => setContestationReason(e.target.value)}
                    required
                    rows={4}
                    className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50/50 p-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:bg-white focus:outline-none transition-all resize-none"
                    placeholder="Cet événement est incorrect car..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setContestingEventId(null)}
                    className="flex-1 h-12 flex items-center justify-center rounded-2xl border-2 border-gray-100 bg-white text-[11px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingContestation}
                    className="flex-1 h-12 flex items-center justify-center rounded-2xl bg-orange-500 text-[11px] font-black uppercase tracking-widest text-white shadow-xl shadow-orange-500/20 active:scale-95 disabled:opacity-50 transition-all hover:bg-orange-600"
                  >
                    {submittingContestation ? (
                      <RefreshCcw size={18} className="animate-spin" />
                    ) : (
                      "Soumettre"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
