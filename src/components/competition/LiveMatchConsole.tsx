"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ChevronLeft, ChevronRight, History, Clock,
  CheckCircle2, Loader2, Flame, Trophy, Shield, Goal,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  onCompMatch,
  initLiveCompMatch,
  startCompTimer,
  pauseCompTimer,
  updateCompPeriod,
  addCompEvent,
  finishCompMatch,
} from "@/lib/competition-firestore";
import type { CompMatch } from "@/types";

// ============================================
// Helpers
// ============================================

// Copied verbatim from the referee console (referee-panel/.../manage).
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
  { id: 4, label: "Fin de match" },
];

type Side = "home" | "away";
type EventType = "goal" | "yellow_card" | "red_card";

interface EventModalState {
  type: EventType;
  side: Side;
  teamName: string;
}

// ============================================
// Component
// ============================================

export default function LiveMatchConsole({ cid, mid, returnHref }: { cid: string; mid: string; returnHref: string }) {
  const router = useRouter();

  const [match, setMatch] = useState<CompMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayTime, setDisplayTime] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Free-text event modal (goal / card)
  const [eventModal, setEventModal] = useState<EventModalState | null>(null);
  const [eventName, setEventName] = useState("");

  // Penalty shootout entry (knockout draw)
  const [showPenaltyModal, setShowPenaltyModal] = useState(false);
  const [penaltyHome, setPenaltyHome] = useState("");
  const [penaltyAway, setPenaltyAway] = useState("");

  // Subscribe to match changes
  useEffect(() => {
    if (!cid || !mid) return;
    const unsub = onCompMatch(cid, mid, (m) => {
      setMatch(m);
      setLoading(false);
    });
    return () => unsub();
  }, [cid, mid]);

  // Prevent accidental navigation while live
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

  // Timer logic — copied verbatim from the referee console. The live_state
  // shapes are identical (timerStartAt / timerOffset / isTimerRunning), so the
  // server-clock computation works unchanged; only the pause writer is
  // retargeted to pauseCompTimer.
  useEffect(() => {
    if (!match?.liveState) return;

    let interval: ReturnType<typeof setInterval>;

    if (match.status === "live" && match.liveState.isTimerRunning && match.liveState.timerStartAt) {
      const start = new Date(match.liveState.timerStartAt).getTime();
      const offset = match.liveState.timerOffset || 0;

      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - start + offset;

        // Auto-pause logic
        const totalSecs = Math.floor(elapsed / 1000);

        if (match.liveState?.currentPeriod === 1 && totalSecs >= 2700) {
          handlePauseTimer();
          toast("Mi-temps ! Pause automatique à 45:00.", { icon: "⏰", duration: 5000 });
        } else if (match.liveState?.currentPeriod === 3 && totalSecs >= 5400) {
          handlePauseTimer();
          toast("Fin du temps réglementaire ! Pause automatique à 90:00.", { icon: "⏰", duration: 5000 });
        }

        setDisplayTime(elapsed);
      }, 100);
    } else {
      setDisplayTime(match.liveState.timerOffset || 0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.liveState, match?.status]);

  const handleStartTimer = async () => {
    try {
      await startCompTimer(cid, mid);
      toast.success("Chronomètre lancé");
    } catch {
      toast.error("Erreur technique");
    }
  };

  const handlePauseTimer = async () => {
    try {
      await pauseCompTimer(cid, mid, displayTime);
      toast.success("Chronomètre arrêté");
    } catch {
      toast.error("Erreur technique");
    }
  };

  const handleNextPeriod = async () => {
    if (!match?.liveState) return;
    const next = match.liveState.currentPeriod + 1;
    if (next > 4) return;

    try {
      await updateCompPeriod(cid, mid, next);
      if (match.liveState.isTimerRunning) {
        await pauseCompTimer(cid, mid, displayTime);
      }
      toast.success("Période mise à jour");
    } catch {
      toast.error("Erreur technique");
    }
  };

  const openEventModal = (type: EventType, side: Side) => {
    if (!match) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    setEventName("");
    setEventModal({ type, side, teamName });
  };

  // Submit the free-text event. `withName === false` skips the name (sends null).
  const submitEvent = async (withName: boolean) => {
    if (!match?.liveState || !eventModal) return;
    const { type, side } = eventModal;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }

    setIsSubmitting(true);
    try {
      const name = withName ? eventName.trim() : "";
      await addCompEvent(cid, mid, {
        type,
        side,
        team_id: teamId,
        period: match.liveState.currentPeriod ?? 1,
        minute: Math.floor(displayTime / 60000) + 1,
        player_name: name || null,
      });
      if (type === "goal") toast.success("BUT !");
      else toast.success("Carton enregistré");
      setEventModal(null);
      setEventName("");
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Whistle for full time. On a knockout draw, collect penalties first.
  const handleFinishClick = () => {
    if (!match) return;
    const scoreHome = match.scoreHome ?? 0;
    const scoreAway = match.scoreAway ?? 0;
    if (match.stage === "knockout" && scoreHome === scoreAway) {
      setPenaltyHome("");
      setPenaltyAway("");
      setShowPenaltyModal(true);
      return;
    }
    if (!window.confirm("Confirmer la fin du match ? Le score sera définitif.")) return;
    void finishMatch();
  };

  const finishMatch = async (opts?: { penaltyHome: number; penaltyAway: number }) => {
    setIsSubmitting(true);
    try {
      await finishCompMatch(cid, mid, opts);
      toast.success("Match terminé !");
      router.push(returnHref);
    } catch (err) {
      console.error("Comp match finish error:", err);
      toast.error("Erreur technique : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePenaltySubmit = async () => {
    const ph = Number(penaltyHome);
    const pa = Number(penaltyAway);
    if (!Number.isFinite(ph) || !Number.isFinite(pa) || ph < 0 || pa < 0) {
      toast.error("Saisissez des tirs au but valides");
      return;
    }
    setShowPenaltyModal(false);
    await finishMatch({ penaltyHome: ph, penaltyAway: pa });
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
        <p className="font-bold text-gray-500 italic">Chargement du match...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-lg font-bold text-gray-900">Match introuvable</p>
        <button
          onClick={() => router.push(returnHref)}
          className="text-sm font-semibold text-primary-600 hover:text-primary-700"
        >
          Retour au calendrier
        </button>
      </div>
    );
  }

  // ----- Before kickoff (no lineup gate — organizer launches directly) -----
  if (match.status !== "live" && match.status !== "completed") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-8 text-center">
        <div className="relative mb-10">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 blur-3xl" />
          <Flame size={96} className="relative animate-pulse text-amber-500" />
        </div>
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-gray-900">
          Prêt à lancer le match ?
        </h2>
        <p className="mt-3 max-w-sm text-base font-medium leading-relaxed text-gray-500">
          {match.homeTeamName} <span className="text-gray-300">vs</span> {match.awayTeamName}
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Le coup d&apos;envoi démarre le suivi en{" "}
          <span className="font-bold text-primary-600">Direct</span>.
        </p>

        <button
          onClick={() => initLiveCompMatch(cid, mid)}
          className="group relative mt-10 inline-flex items-center gap-4 rounded-3xl bg-primary-600 px-12 py-6 text-xl font-black uppercase tracking-widest text-white shadow-[0_25px_50px_rgba(37,99,235,0.35)] transition-all hover:scale-105 hover:bg-primary-700 active:scale-95"
        >
          <span className="relative">Lancer le Match</span>
          <Flame size={24} className="relative transition-transform group-hover:rotate-12 group-hover:scale-125" />
        </button>
      </div>
    );
  }

  const isCompleted = match.status === "completed";
  const homeDisabled = match.homeTeamId == null;
  const awayDisabled = match.awayTeamId == null;
  const events = match.liveState?.events ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-7 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => router.push(returnHref)}
          className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-gray-200/60 transition-all hover:scale-110 active:scale-90"
        >
          <ChevronLeft size={22} className="text-gray-400 group-hover:text-gray-900" />
        </button>
        <div className="text-center">
          <div className="mb-1 flex items-center justify-center gap-2">
            {isCompleted ? (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                Terminé
              </span>
            ) : (
              <>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary-500" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-600">
                  Match en Direct
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-xl font-extrabold tracking-tight text-gray-900">
            {match.homeTeamName} <span className="mx-1.5 text-gray-300">vs</span> {match.awayTeamName}
          </h1>
        </div>
        <div className="h-11 w-11" />
      </div>

      {/* Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[2.5rem] bg-[#0A0A0B] p-8 text-white shadow-[0_40px_100px_rgba(0,0,0,0.15)] sm:p-10"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[80%] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.3),transparent)]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="relative z-10 grid grid-cols-3 items-center">
          {/* Home */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-3xl font-black backdrop-blur-md">
                {match.homeTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="mb-1 max-w-[120px] truncate text-xs font-black uppercase tracking-tight text-white/50">
                {match.homeTeamName}
              </h2>
              <div className="text-7xl font-black tracking-tighter drop-shadow-2xl">
                {match.scoreHome ?? 0}
              </div>
            </div>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center">
            <div className="mb-5 rounded-full border border-white/5 bg-white/10 px-5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary-400 backdrop-blur-xl">
              {PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label || "Match"}
            </div>
            <div className="relative flex flex-col items-center">
              <div className="absolute -inset-8 rounded-full bg-primary-500/10 blur-3xl" />
              <div className="relative font-mono text-[4.5rem] font-black leading-none tracking-tighter tabular-nums text-primary-400">
                {formatTime(displayTime)}
              </div>
            </div>
            {!isCompleted && (
              <div className="mt-8 flex gap-6">
                {match.liveState?.isTimerRunning ? (
                  <button
                    onClick={handlePauseTimer}
                    className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-amber-500 text-white shadow-[0_15px_30px_rgba(245,158,11,0.3)] transition-all hover:scale-110 hover:bg-amber-600 active:scale-95"
                  >
                    <Pause size={28} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartTimer}
                    className="flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-primary-500 text-white shadow-[0_15px_30px_rgba(37,99,235,0.3)] transition-all hover:scale-110 hover:bg-primary-600 active:scale-95"
                  >
                    <Play size={28} fill="currentColor" className="ml-1" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-3xl font-black backdrop-blur-md">
                {match.awayTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="mb-1 max-w-[120px] truncate text-xs font-black uppercase tracking-tight text-white/50">
                {match.awayTeamName}
              </h2>
              <div className="text-7xl font-black tracking-tighter drop-shadow-2xl">
                {match.scoreAway ?? 0}
              </div>
            </div>
          </div>
        </div>

        {/* Penalty line (completed knockout shootout) */}
        {isCompleted && match.penaltyHome != null && match.penaltyAway != null && (
          <div className="relative z-10 mt-6 text-center text-xs font-bold uppercase tracking-widest text-white/40">
            Tirs au but : {match.penaltyHome} – {match.penaltyAway}
          </div>
        )}
      </motion.div>

      {isCompleted ? (
        /* ----- Read-only completed summary ----- */
        <div className="rounded-[2rem] border border-gray-100 bg-white p-8 shadow-xl shadow-gray-200/40">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-gray-900">Match terminé</h3>
              <p className="text-xs font-medium text-gray-400">
                Score final {match.scoreHome ?? 0} – {match.scoreAway ?? 0}
              </p>
            </div>
          </div>
          <EventTimeline events={events} homeTeamId={match.homeTeamId} homeTeamName={match.homeTeamName} awayTeamName={match.awayTeamName} />
        </div>
      ) : (
        <>
          {/* Lock banner */}
          <div className="flex items-center justify-between rounded-3xl bg-amber-500 p-4 text-white shadow-xl shadow-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
                <Shield size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Session live active</p>
                <p className="font-display text-xs font-bold italic">Ne quittez pas cette page avant le coup de sifflet final</p>
              </div>
            </div>
          </div>

          {/* Scoring controls */}
          <div className="grid gap-5 px-1 md:grid-cols-2">
            <TeamScoringCard
              side="home"
              teamName={match.homeTeamName}
              accent="primary"
              disabled={homeDisabled}
              onGoal={() => openEventModal("goal", "home")}
              onYellow={() => openEventModal("yellow_card", "home")}
              onRed={() => openEventModal("red_card", "home")}
            />
            <TeamScoringCard
              side="away"
              teamName={match.awayTeamName}
              accent="amber"
              disabled={awayDisabled}
              onGoal={() => openEventModal("goal", "away")}
              onYellow={() => openEventModal("yellow_card", "away")}
              onRed={() => openEventModal("red_card", "away")}
            />
          </div>

          {/* Workflow + timeline */}
          <div className="grid gap-6 px-1 md:grid-cols-3">
            <div className="rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl shadow-gray-200/50">
              <div className="mb-5 flex items-center gap-3">
                <Clock className="text-gray-400" size={18} />
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Déroulé</h3>
              </div>
              <div className="space-y-3">
                <button
                  disabled={match.liveState?.currentPeriod === 4}
                  onClick={handleNextPeriod}
                  className="group flex w-full items-center justify-between rounded-2xl bg-gray-900 px-5 py-4 text-sm font-bold text-white transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Période suivante</span>
                  <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={handleFinishClick}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-red-50 bg-red-50/50 px-5 py-4 text-sm font-bold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Siffler la fin</span>
                  <CheckCircle2 size={20} />
                </button>
              </div>
            </div>

            <div className="rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl shadow-gray-200/50 md:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <History className="text-gray-400" size={18} />
                  <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Événements</h3>
                </div>
                <div className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {events.length} Total
                </div>
              </div>
              <EventTimeline events={events} homeTeamId={match.homeTeamId} homeTeamName={match.homeTeamName} awayTeamName={match.awayTeamName} />
            </div>
          </div>
        </>
      )}

      {/* Event modal (goal / card, free-text scorer) */}
      <AnimatePresence>
        {eventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEventModal(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl"
            >
              <h2 className="text-xl font-black text-gray-900">
                {eventModal.type === "goal"
                  ? "But"
                  : eventModal.type === "yellow_card"
                    ? "Carton jaune"
                    : "Carton rouge"}{" "}
                — {eventModal.teamName}
              </h2>
              <p className="mb-6 mt-1 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
                {Math.floor(displayTime / 60000) + 1}&apos;
              </p>

              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                {eventModal.type === "goal" ? "Buteur (optionnel)" : "Joueur (optionnel)"}
              </label>
              <input
                type="text"
                autoFocus
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSubmitting) void submitEvent(true);
                }}
                placeholder="Nom du joueur"
                className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-sm font-bold outline-none transition-colors focus:border-primary-500"
              />

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  onClick={() => submitEvent(false)}
                  disabled={isSubmitting}
                  className="rounded-2xl bg-gray-100 py-4 text-sm font-black uppercase tracking-widest text-gray-600 transition-all hover:bg-gray-200 active:scale-95 disabled:opacity-50"
                >
                  Passer
                </button>
                <button
                  onClick={() => submitEvent(true)}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-primary-600 py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Penalty entry modal (knockout draw) */}
      <AnimatePresence>
        {showPenaltyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPenaltyModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm rounded-[2rem] bg-white p-8 shadow-2xl"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  <Trophy size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Tirs au but</h2>
                  <p className="text-xs font-medium text-gray-400">Match nul — départage requis</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-2">
                  <span className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    {match.homeTeamName}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={penaltyHome}
                    onChange={(e) => setPenaltyHome(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-center text-xl font-black outline-none transition-colors focus:border-primary-500"
                  />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="truncate text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    {match.awayTeamName}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={penaltyAway}
                    onChange={(e) => setPenaltyAway(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-center text-xl font-black outline-none transition-colors focus:border-primary-500"
                  />
                </label>
              </div>

              <button
                onClick={handlePenaltySubmit}
                disabled={isSubmitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Terminer le match"}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function TeamScoringCard({
  teamName,
  accent,
  disabled,
  onGoal,
  onYellow,
  onRed,
}: {
  side: Side;
  teamName: string;
  accent: "primary" | "amber";
  disabled: boolean;
  onGoal: () => void;
  onYellow: () => void;
  onRed: () => void;
}) {
  const goalCls =
    accent === "primary"
      ? "bg-primary-600 hover:bg-primary-700 shadow-primary-200"
      : "bg-amber-500 hover:bg-amber-600 shadow-amber-200";

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl shadow-gray-200/40">
      <h3 className="mb-1 text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
        {accent === "primary" ? "Domicile" : "Extérieur"}
      </h3>
      <h2 className="mb-6 max-w-full truncate text-lg font-black tracking-tight text-gray-900">{teamName}</h2>

      {disabled ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 px-4 py-8 text-center text-xs font-bold uppercase tracking-widest text-gray-300">
          Équipe à déterminer
        </div>
      ) : (
        <>
          <button
            onClick={onGoal}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl py-6 text-lg font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 ${goalCls}`}
          >
            <Goal size={24} />
            +1 BUT
          </button>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={onYellow}
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-3 text-xs font-black uppercase tracking-wider text-gray-600 transition-all hover:bg-gray-100 active:scale-95"
            >
              <span className="h-4 w-3 rounded-sm border border-amber-500/20 bg-amber-400" />
              Jaune
            </button>
            <button
              onClick={onRed}
              className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-3 text-xs font-black uppercase tracking-wider text-gray-600 transition-all hover:bg-gray-100 active:scale-95"
            >
              <span className="h-4 w-3 rounded-sm border border-red-700/20 bg-red-600" />
              Rouge
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function EventTimeline({
  events,
  homeTeamId,
  homeTeamName,
  awayTeamName,
}: {
  events: NonNullable<CompMatch["liveState"]>["events"];
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
          <History size={28} className="text-gray-200" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-gray-300 italic">
          Aucun événement pour l&apos;instant
        </p>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar max-h-[350px] space-y-4 overflow-y-auto pr-2">
      {[...events].reverse().map((event) => {
        const isHome = event.teamId === homeTeamId;
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="group flex items-center gap-5"
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-xs font-black shadow-sm">
              {event.minute}&apos;
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {event.type === "goal" && <Goal size={16} className="text-amber-500" />}
                {event.type === "yellow_card" && (
                  <span className="h-5 w-3.5 rounded-sm border border-amber-500/20 bg-amber-400 shadow-sm" />
                )}
                {event.type === "red_card" && (
                  <span className="h-5 w-3.5 rounded-sm border border-red-700/20 bg-red-600 shadow-sm" />
                )}
                <span className="text-sm font-black uppercase tracking-tight text-gray-900">
                  {event.type === "goal"
                    ? "BUT !"
                    : event.type === "yellow_card"
                      ? "Carton Jaune"
                      : "Carton Rouge"}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-tighter text-gray-400">
                {event.playerName ? `${event.playerName} • ` : ""}
                {isHome ? homeTeamName : awayTeamName}
              </p>
            </div>
          </motion.div>
        );
      })}

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
