"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ChevronLeft, ChevronRight, History, Clock,
  CheckCircle2, Loader2, Flame, Trophy, Shield, Goal,
  ArrowRightLeft, AlertTriangle, X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  onCompMatch,
  getCompTeam,
  setCompMatchLineup,
  initLiveCompMatch,
  startCompTimer,
  pauseCompTimer,
  updateCompPeriod,
  addCompEvent,
  finishCompMatch,
} from "@/lib/competition-firestore";
import type { CompMatch, CompPlayer, LineupEntry } from "@/types";

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
type SheetRole = "out" | "starter" | "substitute";

// Player-picker modal (goal / card): pick a scorer from a side's match sheet.
interface PickerState {
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

  // Rosters (loaded once before kickoff for the match-sheet builder).
  const [homeRoster, setHomeRoster] = useState<CompPlayer[] | null>(null);
  const [awayRoster, setAwayRoster] = useState<CompPlayer[] | null>(null);
  const [rostersLoading, setRostersLoading] = useState(false);

  // Per-side match-sheet drafts (playerId -> role). Seeded from any saved lineup.
  const [homeSheet, setHomeSheet] = useState<Record<string, SheetRole>>({});
  const [awaySheet, setAwaySheet] = useState<Record<string, SheetRole>>({});
  const [savingSide, setSavingSide] = useState<Side | null>(null);

  // Player-picker modal (goal / card)
  const [picker, setPicker] = useState<PickerState | null>(null);

  // Substitution modal
  const [subModal, setSubModal] = useState<{ side: Side; teamName: string } | null>(null);
  const [subOut, setSubOut] = useState("");
  const [subIn, setSubIn] = useState("");

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

  // Load both rosters once, before kickoff, for the match-sheet builder. Drafts
  // are seeded from any previously-saved lineup so re-validation overwrites cleanly.
  const isPreKickoff = !!match && match.status !== "live" && match.status !== "completed";
  const homeTeamId = match?.homeTeamId ?? null;
  const awayTeamId = match?.awayTeamId ?? null;

  useEffect(() => {
    if (!isPreKickoff || !cid) return;
    let cancelled = false;
    setRostersLoading(true);
    (async () => {
      try {
        const [home, away] = await Promise.all([
          homeTeamId ? getCompTeam(cid, homeTeamId) : Promise.resolve(null),
          awayTeamId ? getCompTeam(cid, awayTeamId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setHomeRoster(home?.players ?? []);
        setAwayRoster(away?.players ?? []);
      } catch {
        if (!cancelled) {
          setHomeRoster([]);
          setAwayRoster([]);
          toast.error("Erreur de chargement des effectifs");
        }
      } finally {
        if (!cancelled) setRostersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPreKickoff, cid, homeTeamId, awayTeamId]);

  // Seed each draft from the saved lineup whenever the match's lineup changes.
  useEffect(() => {
    if (!match) return;
    setHomeSheet(seedSheet(match.homeLineup));
  }, [match?.homeLineup]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!match) return;
    setAwaySheet(seedSheet(match.awayLineup));
  }, [match?.awayLineup]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handlePauseTimer = useCallback(async () => {
    try {
      await pauseCompTimer(cid, mid, displayTime);
      toast.success("Chronomètre arrêté");
    } catch {
      toast.error("Erreur technique");
    }
  }, [cid, mid, displayTime]);

  // Timer logic — copied verbatim from the referee console. The live_state
  // shapes are identical (timerStartAt / timerOffset / isTimerRunning), so the
  // server-clock computation works unchanged; only the pause writer is
  // retargeted to pauseCompTimer. The `match.status === "live"` guard is a
  // shipped bug fix (freeze the clock at full time) — do NOT regress it.
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

  // ----- Match-sheet builder -----

  const toggleSheetRole = (side: Side, playerId: string) => {
    const setter = side === "home" ? setHomeSheet : setAwaySheet;
    setter((prev) => {
      const current = prev[playerId] ?? "out";
      const next: SheetRole =
        current === "out" ? "starter" : current === "starter" ? "substitute" : "out";
      return { ...prev, [playerId]: next };
    });
  };

  const handleValidateSheet = async (side: Side) => {
    if (!match) return;
    const roster = side === "home" ? homeRoster : awayRoster;
    const sheet = side === "home" ? homeSheet : awaySheet;
    if (!roster) return;

    const entries: LineupEntry[] = roster
      .filter((p) => (sheet[p.id] ?? "out") !== "out")
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        number: p.number,
        role: (sheet[p.id] as "starter" | "substitute"),
      }));

    if (entries.length === 0) {
      toast.error("Ajoute au moins un joueur à la feuille");
      return;
    }

    setSavingSide(side);
    try {
      await setCompMatchLineup(cid, mid, side, entries, true);
      toast.success("Feuille validée");
    } catch {
      toast.error("Erreur lors de la validation");
    } finally {
      setSavingSide(null);
    }
  };

  const handleLaunch = async () => {
    if (!match?.homeLineupReady || !match?.awayLineupReady) return;
    try {
      await initLiveCompMatch(cid, mid);
    } catch {
      toast.error("Erreur technique");
    }
  };

  // ----- Live scoring (player picker) -----

  const openPicker = (type: EventType, side: Side) => {
    if (!match) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    setPicker({ type, side, teamName });
  };

  const recordEvent = async (entry: LineupEntry) => {
    if (!match?.liveState || !picker) return;
    const { type, side } = picker;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }

    setIsSubmitting(true);
    try {
      await addCompEvent(cid, mid, {
        type,
        side,
        team_id: teamId,
        period: match.liveState.currentPeriod ?? 1,
        minute: Math.floor(displayTime / 60000) + 1,
        player_id: entry.playerId,
        player_name: entry.name,
      });
      if (type === "goal") toast.success("BUT !");
      else toast.success("Carton enregistré");
      setPicker(null);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Substitutions -----

  const openSubModal = (side: Side) => {
    if (!match) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    setSubOut("");
    setSubIn("");
    setSubModal({ side, teamName });
  };

  const handleSubmitSub = async () => {
    if (!match?.liveState || !subModal || !subOut || !subIn) return;
    const { side } = subModal;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }
    const lineup = side === "home" ? match.homeLineup : match.awayLineup;
    const outEntry = lineup.find((e) => e.playerId === subOut);
    const inEntry = lineup.find((e) => e.playerId === subIn);
    if (!outEntry || !inEntry) return;

    setIsSubmitting(true);
    try {
      await addCompEvent(cid, mid, {
        type: "substitution",
        side,
        team_id: teamId,
        period: match.liveState.currentPeriod ?? 1,
        minute: Math.floor(displayTime / 60000) + 1,
        player_id: inEntry.playerId,
        player_name: inEntry.name,
        detail: `${outEntry.name} → ${inEntry.name}`,
      });
      toast.success("Changement effectué");
      setSubModal(null);
      setSubOut("");
      setSubIn("");
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

  // ----- Before kickoff → match-sheet builder + two-lineup-ready gate -----
  if (match.status !== "live" && match.status !== "completed") {
    const lineupsReady = match.homeLineupReady && match.awayLineupReady;

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
            <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
              Feuilles de match
            </p>
            <h1 className="font-display text-xl font-extrabold tracking-tight text-gray-900">
              {match.homeTeamName} <span className="mx-1.5 text-gray-300">vs</span> {match.awayTeamName}
            </h1>
          </div>
          <div className="h-11 w-11" />
        </div>

        <p className="px-2 text-center text-sm font-medium text-gray-500">
          Compose les deux feuilles de match. Le coup d&apos;envoi démarre le suivi en{" "}
          <span className="font-bold text-primary-600">Direct</span>.
        </p>

        {rostersLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <p className="text-sm font-bold text-gray-400 italic">Chargement des effectifs...</p>
          </div>
        ) : (
          <div className="grid gap-5 px-1 md:grid-cols-2">
            <LineupBuilder
              side="home"
              teamName={match.homeTeamName}
              accent="primary"
              roster={homeRoster ?? []}
              sheet={homeSheet}
              ready={match.homeLineupReady}
              saving={savingSide === "home"}
              onToggle={(pid) => toggleSheetRole("home", pid)}
              onValidate={() => handleValidateSheet("home")}
            />
            <LineupBuilder
              side="away"
              teamName={match.awayTeamName}
              accent="amber"
              roster={awayRoster ?? []}
              sheet={awaySheet}
              ready={match.awayLineupReady}
              saving={savingSide === "away"}
              onToggle={(pid) => toggleSheetRole("away", pid)}
              onValidate={() => handleValidateSheet("away")}
            />
          </div>
        )}

        {/* Launch gate */}
        <div className="flex flex-col items-center gap-4 px-2 pt-4">
          {!lineupsReady && !rostersLoading && (
            <div className="flex max-w-md items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 text-amber-800">
              <AlertTriangle size={20} className="shrink-0 text-amber-500" />
              <p className="text-xs font-bold leading-relaxed">
                Le match ne peut démarrer que lorsque les deux feuilles de match sont validées.
              </p>
            </div>
          )}
          <button
            onClick={handleLaunch}
            disabled={!lineupsReady}
            className="group relative inline-flex items-center gap-4 rounded-3xl bg-primary-600 px-12 py-6 text-xl font-black uppercase tracking-widest text-white shadow-[0_25px_50px_rgba(37,99,235,0.35)] transition-all hover:scale-105 hover:bg-primary-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            <span className="relative">Lancer le Match</span>
            <Flame size={24} className="relative transition-transform group-hover:rotate-12 group-hover:scale-125" />
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = match.status === "completed";
  const homeLineup = match.homeLineup;
  const awayLineup = match.awayLineup;
  const homeDisabled = match.homeTeamId == null || homeLineup.length === 0;
  const awayDisabled = match.awayTeamId == null || awayLineup.length === 0;
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
              teamName={match.homeTeamName}
              accent="primary"
              disabled={homeDisabled}
              onGoal={() => openPicker("goal", "home")}
              onYellow={() => openPicker("yellow_card", "home")}
              onRed={() => openPicker("red_card", "home")}
              onSub={() => openSubModal("home")}
            />
            <TeamScoringCard
              teamName={match.awayTeamName}
              accent="amber"
              disabled={awayDisabled}
              onGoal={() => openPicker("goal", "away")}
              onYellow={() => openPicker("yellow_card", "away")}
              onRed={() => openPicker("red_card", "away")}
              onSub={() => openSubModal("away")}
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

      {/* Player-picker modal (goal / card — scorer from the match sheet) */}
      <AnimatePresence>
        {picker && (
          <PlayerPickerModal
            picker={picker}
            lineup={picker.side === "home" ? homeLineup : awayLineup}
            minute={Math.floor(displayTime / 60000) + 1}
            isSubmitting={isSubmitting}
            onPick={recordEvent}
            onClose={() => setPicker(null)}
          />
        )}
      </AnimatePresence>

      {/* Substitution modal */}
      <AnimatePresence>
        {subModal && (
          <SubstitutionModal
            teamName={subModal.teamName}
            lineup={subModal.side === "home" ? homeLineup : awayLineup}
            subOut={subOut}
            subIn={subIn}
            setSubOut={setSubOut}
            setSubIn={setSubIn}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmitSub}
            onClose={() => setSubModal(null)}
          />
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

/** Seed a per-side match-sheet draft (playerId -> role) from a saved lineup. */
function seedSheet(lineup: LineupEntry[]): Record<string, SheetRole> {
  const out: Record<string, SheetRole> = {};
  for (const e of lineup) out[e.playerId] = e.role;
  return out;
}

function LineupBuilder({
  teamName,
  accent,
  roster,
  sheet,
  ready,
  saving,
  onToggle,
  onValidate,
}: {
  side: Side;
  teamName: string;
  accent: "primary" | "amber";
  roster: CompPlayer[];
  sheet: Record<string, SheetRole>;
  ready: boolean;
  saving: boolean;
  onToggle: (playerId: string) => void;
  onValidate: () => void;
}) {
  const accentText = accent === "primary" ? "text-primary-600" : "text-amber-500";
  const validateCls =
    accent === "primary"
      ? "bg-primary-600 hover:bg-primary-700 shadow-primary-200"
      : "bg-amber-500 hover:bg-amber-600 shadow-amber-200";

  const starters = roster.filter((p) => sheet[p.id] === "starter").length;
  const subs = roster.filter((p) => sheet[p.id] === "substitute").length;

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl shadow-gray-200/40">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
          {accent === "primary" ? "Domicile" : "Extérieur"}
        </h3>
        {ready && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter text-emerald-600">
            <CheckCircle2 size={12} /> Validée
          </span>
        )}
      </div>
      <h2 className="mb-1 max-w-full truncate text-lg font-black tracking-tight text-gray-900">{teamName}</h2>

      {roster.length === 0 ? (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-gray-200 px-4 py-10 text-center text-xs font-bold leading-relaxed text-gray-400">
          Effectif vide — ajoute les joueurs dans la config de l&apos;équipe
        </div>
      ) : (
        <>
          <p className="mb-4 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <span className={accentText}>{starters}</span> titulaire{starters > 1 ? "s" : ""} ·{" "}
            <span className={accentText}>{subs}</span> remplaçant{subs > 1 ? "s" : ""}
          </p>
          <div className="custom-scrollbar mb-5 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {roster.map((p) => {
              const role = sheet[p.id] ?? "out";
              return (
                <button
                  key={p.id}
                  onClick={() => onToggle(p.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition-all active:scale-[0.99] ${
                    role === "out"
                      ? "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                      : role === "starter"
                        ? "border-emerald-500/30 bg-emerald-50/60"
                        : "border-sky-500/30 bg-sky-50/60"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-gray-900 shadow-sm">
                    {p.number || p.name[0]?.toUpperCase()}
                  </span>
                  <span className="flex-1 truncate text-sm font-bold text-gray-900">{p.name}</span>
                  <RoleBadge role={role} />
                </button>
              );
            })}
          </div>
          <button
            onClick={onValidate}
            disabled={saving}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${validateCls}`}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : ready ? "Mettre à jour la feuille" : "Valider la feuille"}
          </button>
        </>
      )}

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

function RoleBadge({ role }: { role: SheetRole }) {
  if (role === "starter") {
    return (
      <span className="shrink-0 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-white">
        Titulaire
      </span>
    );
  }
  if (role === "substitute") {
    return (
      <span className="shrink-0 rounded-full bg-sky-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-white">
        Remplaçant
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full border border-gray-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-gray-400">
      Hors feuille
    </span>
  );
}

function TeamScoringCard({
  teamName,
  accent,
  disabled,
  onGoal,
  onYellow,
  onRed,
  onSub,
}: {
  teamName: string;
  accent: "primary" | "amber";
  disabled: boolean;
  onGoal: () => void;
  onYellow: () => void;
  onRed: () => void;
  onSub: () => void;
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
          Feuille de match vide
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
          <button
            onClick={onSub}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-100 py-3 text-xs font-black uppercase tracking-wider text-gray-600 transition-all hover:border-gray-300 hover:bg-gray-50 active:scale-95"
          >
            <ArrowRightLeft size={16} />
            Remplacement
          </button>
        </>
      )}
    </div>
  );
}

function PlayerPickerModal({
  picker,
  lineup,
  minute,
  isSubmitting,
  onPick,
  onClose,
}: {
  picker: PickerState;
  lineup: LineupEntry[];
  minute: number;
  isSubmitting: boolean;
  onPick: (entry: LineupEntry) => void;
  onClose: () => void;
}) {
  const title =
    picker.type === "goal" ? "But" : picker.type === "yellow_card" ? "Carton jaune" : "Carton rouge";

  // Starters first, then substitutes, for a natural reading order.
  const ordered = [...lineup].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === "starter" ? -1 : 1;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md rounded-[2rem] bg-white p-7 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={18} />
        </button>
        <h2 className="text-xl font-black text-gray-900">
          {title} — {picker.teamName}
        </h2>
        <p className="mb-6 mt-1 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
          {minute}&apos; · Choisis le joueur
        </p>

        <div className="custom-scrollbar grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {ordered.map((entry) => (
            <button
              key={entry.playerId}
              disabled={isSubmitting}
              onClick={() => onPick(entry)}
              className="group flex items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50/50 px-4 py-3 text-left transition-all hover:border-primary-500 hover:bg-white active:scale-95 disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-sm font-black text-white">
                {entry.number || entry.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-gray-900">{entry.name}</span>
                <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">
                  {entry.role === "starter" ? "Titulaire" : "Remplaçant"}
                </span>
              </span>
            </button>
          ))}
        </div>

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
      </motion.div>
    </div>
  );
}

function SubstitutionModal({
  teamName,
  lineup,
  subOut,
  subIn,
  setSubOut,
  setSubIn,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  teamName: string;
  lineup: LineupEntry[];
  subOut: string;
  subIn: string;
  setSubOut: (v: string) => void;
  setSubIn: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const starters = lineup.filter((e) => e.role === "starter");
  const substitutes = lineup.filter((e) => e.role === "substitute");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-md rounded-[2rem] bg-white p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gray-900 text-white">
            <ArrowRightLeft size={20} />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900">Remplacement</h2>
            <p className="text-xs font-bold uppercase tracking-tight text-gray-400 italic">{teamName}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
              Joueur sortant (titulaire)
            </label>
            <select
              value={subOut}
              onChange={(e) => setSubOut(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-sm font-bold outline-none transition-colors focus:border-red-500"
            >
              <option value="">Sélectionner...</option>
              {starters.map((e) => (
                <option key={e.playerId} value={e.playerId}>
                  {e.number ? `${e.number} · ` : ""}
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg">
              <ArrowRightLeft size={22} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              Joueur entrant (remplaçant)
            </label>
            <select
              value={subIn}
              onChange={(e) => setSubIn(e.target.value)}
              className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 text-sm font-bold outline-none transition-colors focus:border-emerald-500"
            >
              <option value="">Sélectionner...</option>
              {substitutes.map((e) => (
                <option key={e.playerId} value={e.playerId}>
                  {e.number ? `${e.number} · ` : ""}
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={onSubmit}
            disabled={!subOut || !subIn || isSubmitting}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Valider le changement"}
          </button>
        </div>
      </motion.div>
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
        const isSub = event.type === "substitution";
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
                {isSub && <ArrowRightLeft size={16} className="text-sky-500" />}
                <span className="text-sm font-black uppercase tracking-tight text-gray-900">
                  {event.type === "goal"
                    ? "BUT !"
                    : event.type === "yellow_card"
                      ? "Carton Jaune"
                      : event.type === "red_card"
                        ? "Carton Rouge"
                        : "Changement"}
                </span>
              </div>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-tighter text-gray-400">
                {isSub && event.detail ? (
                  <span className="text-sky-600">{event.detail}</span>
                ) : (
                  <>
                    {event.playerName ? `${event.playerName} • ` : ""}
                    {isHome ? homeTeamName : awayTeamName}
                  </>
                )}
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
