"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ChevronLeft, ChevronRight, History, Clock,
  CheckCircle2, Loader2, Flame, Trophy, Shield, Goal,
  ArrowRightLeft, AlertTriangle, X, LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  onCompMatch,
  onCompetition,
  getCompTeam,
  setCompMatchLineup,
  initLiveCompMatch,
  startCompTimer,
  pauseCompTimer,
  updateCompPeriod,
  addCompEvent,
  finishCompMatch,
  updateCompMatch,
} from "@/lib/competition-firestore";
import { useAuth } from "@/contexts/AuthContext";
import { notifyCompetitionFollowers } from "@/lib/competition-notify";
import type { CompMatch, CompPlayer, LineupEntry, Competition } from "@/types";

// Football rule constants.
const STARTERS_MAX = 11;
const SUBS_MAX = 5;
const HALF_MS = 2_700_000;
const FULL_MS = 5_400_000;

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
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const [competition, setCompetition] = useState<Competition | null>(null);
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

  // Subscribe to the competition (for role-based exit/lock logic).
  useEffect(() => {
    if (!cid) return;
    const unsub = onCompetition(cid, setCompetition);
    return () => unsub();
  }, [cid]);

  const isOrganizer = !!(user && competition && competition.organizerIds.includes(user.uid));

  // Goal cooldown: after a goal, both goal buttons are disabled for 60s.
  const [goalCooldown, setGoalCooldown] = useState(0);
  useEffect(() => {
    if (goalCooldown <= 0) return;
    const t = setTimeout(() => setGoalCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [goalCooldown]);

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
        // The operator now controls stoppage manually; no auto-pause.
        setDisplayTime(elapsed);
      }, 100);
    } else {
      setDisplayTime(match.liveState.timerOffset || 0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [match?.liveState, match?.status]);

  const handleStartTimer = async () => {
    try {
      await startCompTimer(cid, mid);
      toast.success("Chronomètre lancé");
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Period 1 → half-time: snap clock to 45:00, stop, move to break (period 2).
  const handleHalfTime = async () => {
    try {
      await pauseCompTimer(cid, mid, HALF_MS);
      await updateCompPeriod(cid, mid, 2);
      if (match) {
        notifyCompetitionFollowers({
          cid,
          title: "⏸️ Mi-temps",
          body: `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName}`,
          link: competition ? `/c/${competition.slug}/matches/${mid}` : "/",
        });
      }
      toast.success("Mi-temps");
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Period 2 (break) → resume from 45:00, move to second half (period 3).
  const handleResume = async () => {
    try {
      await startCompTimer(cid, mid);
      await updateCompPeriod(cid, mid, 3);
      if (match) {
        notifyCompetitionFollowers({
          cid,
          title: "▶️ Reprise du match",
          body: `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName} — 2e mi-temps`,
          link: competition ? `/c/${competition.slug}/matches/${mid}` : "/",
        });
      }
      toast.success("Reprise du jeu");
    } catch {
      toast.error("Erreur technique");
    }
  };

  // ----- Match-sheet builder -----

  const toggleSheetRole = (side: Side, playerId: string) => {
    const sheet = side === "home" ? homeSheet : awaySheet;
    const setter = side === "home" ? setHomeSheet : setAwaySheet;
    const current = sheet[playerId] ?? "out";
    let next: SheetRole =
      current === "out" ? "starter" : current === "starter" ? "substitute" : "out";
    // Hard cap: at most 11 titulaires per side. A 12th starter falls back to substitute.
    // Compute + toast OUTSIDE the state updater (no side effects during render).
    if (next === "starter") {
      const starters = Object.entries(sheet).filter(
        ([id, role]) => role === "starter" && id !== playerId,
      ).length;
      if (starters >= STARTERS_MAX) {
        next = "substitute";
        toast(`11 titulaires maximum — le reste = remplaçants`, { icon: "⚠️" });
      }
    }
    setter((prev) => ({ ...prev, [playerId]: next }));
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

    const starters = entries.filter((e) => e.role === "starter").length;
    if (starters === 0) {
      toast.error("Ajoute au moins un titulaire à la feuille");
      return;
    }
    if (starters > STARTERS_MAX) {
      toast.error("11 titulaires maximum");
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
    const homeOnPitch = match.homeLineup.filter((e) => e.role === "starter").map((e) => e.playerId);
    const awayOnPitch = match.awayLineup.filter((e) => e.role === "starter").map((e) => e.playerId);
    try {
      await initLiveCompMatch(cid, mid);
      await updateCompMatch(cid, mid, { home_on_pitch: homeOnPitch, away_on_pitch: awayOnPitch });
      notifyCompetitionFollowers({
        cid,
        title: "🔴 C'est parti !",
        body: `${match.homeTeamName} – ${match.awayTeamName}, coup d'envoi !`,
        link: competition ? `/c/${competition.slug}/matches/${mid}` : "/",
      });
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Organizer quit during live: navigate back.
  const handleQuit = useCallback(() => {
    router.push(returnHref);
  }, [router, returnHref]);

  // ----- Live scoring (player picker) -----

  const openPicker = (type: EventType, side: Side) => {
    if (!match) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    setPicker({ type, side, teamName });
  };

  const recordEvent = async (entry: LineupEntry) => {
    if (!match?.liveState || !picker) return;
    const { type, side, teamName } = picker;
    const matchLink = competition ? `/c/${competition.slug}/matches/${mid}` : "/";
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }
    const period = match.liveState.currentPeriod ?? 1;
    const minute = Math.floor(displayTime / 60000) + 1;
    const onPitch = side === "home" ? match.homeOnPitch : match.awayOnPitch;
    const onPitchField = side === "home" ? "home_on_pitch" : "away_on_pitch";
    const events = match.liveState.events ?? [];

    setIsSubmitting(true);
    try {
      if (type === "goal") {
        await addCompEvent(cid, mid, {
          type: "goal",
          side,
          team_id: teamId,
          period,
          minute,
          player_id: entry.playerId,
          player_name: entry.name,
        });
        const newHome = (match.scoreHome ?? 0) + (side === "home" ? 1 : 0);
        const newAway = (match.scoreAway ?? 0) + (side === "away" ? 1 : 0);
        notifyCompetitionFollowers({
          cid,
          title: `⚽ BUT ! ${entry.name} (${minute}')`,
          body: `${match.homeTeamName} ${newHome} – ${newAway} ${match.awayTeamName}`,
          link: matchLink,
        });
        toast.success("BUT !");
        setGoalCooldown(60);
      } else if (type === "yellow_card") {
        const priorYellows = events.filter(
          (e) => e.type === "yellow_card" && e.playerId === entry.playerId,
        ).length;
        await addCompEvent(cid, mid, {
          type: "yellow_card",
          side,
          team_id: teamId,
          period,
          minute,
          player_id: entry.playerId,
          player_name: entry.name,
        });
        if (priorYellows >= 1) {
          // Second yellow → automatic send-off.
          await addCompEvent(cid, mid, {
            type: "red_card",
            side,
            team_id: teamId,
            period,
            minute,
            player_id: entry.playerId,
            player_name: entry.name,
            detail: "2e carton jaune",
          });
          await updateCompMatch(cid, mid, {
            [onPitchField]: onPitch.filter((id) => id !== entry.playerId),
          });
          notifyCompetitionFollowers({
            cid,
            title: `🟥 Expulsion (${minute}')`,
            body: `${entry.name} (${teamName}) — 2e carton jaune`,
            link: matchLink,
          });
          toast("2e jaune → exclusion", { icon: "🟥" });
        } else {
          notifyCompetitionFollowers({
            cid,
            title: `🟨 Carton jaune (${minute}')`,
            body: `${entry.name} (${teamName})`,
            link: matchLink,
          });
          toast.success("Carton jaune enregistré");
        }
      } else {
        // Direct red card.
        await addCompEvent(cid, mid, {
          type: "red_card",
          side,
          team_id: teamId,
          period,
          minute,
          player_id: entry.playerId,
          player_name: entry.name,
        });
        await updateCompMatch(cid, mid, {
          [onPitchField]: onPitch.filter((id) => id !== entry.playerId),
        });
        notifyCompetitionFollowers({
          cid,
          title: `🟥 Carton rouge (${minute}')`,
          body: `${entry.name} (${teamName})`,
          link: matchLink,
        });
        toast("Carton rouge → exclusion", { icon: "🟥" });
      }
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

    const events = match.liveState.events ?? [];
    const subsUsed = events.filter((e) => e.type === "substitution" && e.teamId === teamId).length;
    if (subsUsed >= SUBS_MAX) {
      toast.error(`${SUBS_MAX} remplacements maximum`);
      return;
    }
    const onPitch = side === "home" ? match.homeOnPitch : match.awayOnPitch;
    const onPitchField = side === "home" ? "home_on_pitch" : "away_on_pitch";

    setIsSubmitting(true);
    try {
      const subMinute = Math.floor(displayTime / 60000) + 1;
      await addCompEvent(cid, mid, {
        type: "substitution",
        side,
        team_id: teamId,
        period: match.liveState.currentPeriod ?? 1,
        minute: subMinute,
        player_id: inEntry.playerId,
        player_name: inEntry.name,
        detail: `${outEntry.name} → ${inEntry.name}`,
      });
      await updateCompMatch(cid, mid, {
        [onPitchField]: [...onPitch.filter((id) => id !== outEntry.playerId), inEntry.playerId],
      });
      notifyCompetitionFollowers({
        cid,
        title: `🔄 Changement (${subMinute}')`,
        body: `${outEntry.name} → ${inEntry.name} (${subModal.teamName})`,
        link: competition ? `/c/${competition.slug}/matches/${mid}` : "/",
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

  // Whistle for full time: snap the clock to 90:00 and stop, then finish.
  // On a knockout draw, collect penalties first.
  const handleFinishClick = async () => {
    if (!match) return;
    try {
      await pauseCompTimer(cid, mid, FULL_MS);
    } catch {
      // Best-effort clock snap; the finish flow still freezes the clock.
    }
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
      if (match) {
        const scoreLine = `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName}`;
        notifyCompetitionFollowers({
          cid,
          title: "🏁 Score final",
          body: opts ? `${scoreLine} (${opts.penaltyHome} – ${opts.penaltyAway} t.a.b.)` : scoreLine,
          link: competition ? `/c/${competition.slug}/matches/${mid}` : "/",
        });
      }
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
      <div ref={containerRef} className="mx-auto max-w-5xl space-y-7 overflow-y-auto bg-gray-50 pb-28">
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
            <span className="relative">Coup d&apos;envoi</span>
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
  // Players who already have a yellow (for the picker marker). Player ids are unique.
  const yellowCardedIds = new Set(
    events.filter((e) => e.type === "yellow_card" && e.playerId).map((e) => e.playerId as string),
  );

  // Players currently on the pitch for a side (id ∈ on_pitch), resolved to lineup entries.
  const onPitchEntries = (side: Side): LineupEntry[] => {
    const lineup = side === "home" ? homeLineup : awayLineup;
    const onPitch = side === "home" ? match.homeOnPitch : match.awayOnPitch;
    const set = new Set(onPitch);
    return lineup.filter((e) => set.has(e.playerId));
  };

  // Available bench: substitutes not on the pitch and not sent off (no red_card event).
  const benchEntries = (side: Side): LineupEntry[] => {
    const lineup = side === "home" ? homeLineup : awayLineup;
    const onPitch = new Set(side === "home" ? match.homeOnPitch : match.awayOnPitch);
    const sentOff = new Set(
      events.filter((e) => e.type === "red_card" && e.playerId).map((e) => e.playerId as string),
    );
    return lineup.filter(
      (e) => e.role === "substitute" && !onPitch.has(e.playerId) && !sentOff.has(e.playerId),
    );
  };

  // Exit affordance: live → organizer only ("Quitter"); moderator locked out.
  // Completed → everyone gets a normal back control.
  const showQuit = !isCompleted && isOrganizer;
  const showBack = isCompleted;

  return (
    <div ref={containerRef} className="mx-auto max-w-5xl space-y-7 overflow-y-auto bg-gray-50 pb-28 lg:max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between px-2">
        {showBack ? (
          <button
            onClick={() => router.push(returnHref)}
            className="group flex h-11 w-11 items-center justify-center rounded-2xl bg-white shadow-lg shadow-gray-200/60 transition-all hover:scale-110 active:scale-90"
          >
            <ChevronLeft size={22} className="text-gray-400 group-hover:text-gray-900" />
          </button>
        ) : showQuit ? (
          <button
            onClick={handleQuit}
            className="group flex h-11 items-center gap-2 rounded-2xl bg-white px-4 shadow-lg shadow-gray-200/60 transition-all hover:scale-105 active:scale-95"
          >
            <LogOut size={18} className="text-gray-400 group-hover:text-gray-900" />
            <span className="text-xs font-black uppercase tracking-wider text-gray-500 group-hover:text-gray-900">
              Quitter
            </span>
          </button>
        ) : (
          <div className="h-11 w-11" />
        )}
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
          <h1 className="font-display text-base font-extrabold tracking-tight text-gray-900 sm:text-xl">
            {match.homeTeamName} <span className="mx-1.5 text-gray-300">vs</span> {match.awayTeamName}
          </h1>
        </div>
        <div className="h-11 w-11" />
      </div>

      {/* Landscape layout on desktop: scoreboard + status controls on the
          left (sticky), scoring + events on the right. Mobile stays a
          single vertical column. */}
      <div className="space-y-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-7 lg:space-y-0">
      <div className="space-y-7 lg:sticky lg:top-6">
      {/* Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-3xl bg-[#0A0A0B] p-5 text-white shadow-[0_40px_100px_rgba(0,0,0,0.15)] sm:rounded-[2.5rem] sm:p-10"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[80%] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.3),transparent)]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary-500/10 blur-[100px]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="relative z-10 grid grid-cols-3 items-center">
          {/* Home */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-2xl font-black backdrop-blur-md sm:h-20 sm:w-20 sm:rounded-[2rem] sm:text-3xl">
                {match.homeTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="mb-1 max-w-[120px] truncate text-xs font-black uppercase tracking-tight text-white/50">
                {match.homeTeamName}
              </h2>
              <div className="text-5xl font-black tracking-tighter drop-shadow-2xl sm:text-7xl">
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
              <div className="relative font-mono text-4xl font-black leading-none tracking-tighter tabular-nums text-primary-400 sm:text-[4.5rem]">
                {formatTime(displayTime)}
              </div>
            </div>
            {!isCompleted && (match.liveState?.currentPeriod === 1 || match.liveState?.currentPeriod === 3) && (
              <div className="mt-5 flex gap-6 sm:mt-8">
                {match.liveState?.isTimerRunning ? (
                  <button
                    onClick={handlePauseTimer}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-[0_15px_30px_rgba(245,158,11,0.3)] transition-all hover:scale-110 hover:bg-amber-600 active:scale-95 sm:h-16 sm:w-16 sm:rounded-[1.75rem]"
                  >
                    <Pause size={24} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartTimer}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-white shadow-[0_15px_30px_rgba(37,99,235,0.3)] transition-all hover:scale-110 hover:bg-primary-600 active:scale-95 sm:h-16 sm:w-16 sm:rounded-[1.75rem]"
                  >
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-2xl font-black backdrop-blur-md sm:h-20 sm:w-20 sm:rounded-[2rem] sm:text-3xl">
                {match.awayTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="mb-1 max-w-[120px] truncate text-xs font-black uppercase tracking-tight text-white/50">
                {match.awayTeamName}
              </h2>
              <div className="text-5xl font-black tracking-tighter drop-shadow-2xl sm:text-7xl">
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

      {!isCompleted && (
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

          {/* Workflow */}
          <div className="rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl shadow-gray-200/50">
            <div className="mb-5 flex items-center gap-3">
              <Clock className="text-gray-400" size={18} />
              <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Déroulé</h3>
            </div>
            <div className="space-y-3">
              {match.liveState?.currentPeriod === 1 && (
                <button
                  onClick={handleHalfTime}
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-between rounded-2xl bg-gray-900 px-5 py-4 text-sm font-bold text-white transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Mi-temps</span>
                  <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                </button>
              )}
              {match.liveState?.currentPeriod === 2 && (
                <button
                  onClick={handleResume}
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-between rounded-2xl bg-primary-600 px-5 py-4 text-sm font-bold text-white transition-all hover:bg-primary-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Reprise (2e mi-temps)</span>
                  <Play size={18} fill="currentColor" />
                </button>
              )}
              {match.liveState?.currentPeriod === 3 && (
                <button
                  onClick={handleFinishClick}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-between rounded-2xl border-2 border-red-50 bg-red-50/50 px-5 py-4 text-sm font-bold text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Fin du match</span>
                  <CheckCircle2 size={20} />
                </button>
              )}
            </div>
          </div>
        </>
      )}
      </div>

      {/* Right column: scoring + events (or the completed summary) */}
      <div className="space-y-7">
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
          {/* Scoring controls */}
          <div className="grid gap-5 px-1 md:grid-cols-2">
            <TeamScoringCard
              teamName={match.homeTeamName}
              accent="primary"
              disabled={homeDisabled}
              goalCooldown={goalCooldown}
              onGoal={() => openPicker("goal", "home")}
              onYellow={() => openPicker("yellow_card", "home")}
              onRed={() => openPicker("red_card", "home")}
              onSub={() => openSubModal("home")}
            />
            <TeamScoringCard
              teamName={match.awayTeamName}
              accent="amber"
              disabled={awayDisabled}
              goalCooldown={goalCooldown}
              onGoal={() => openPicker("goal", "away")}
              onYellow={() => openPicker("yellow_card", "away")}
              onRed={() => openPicker("red_card", "away")}
              onSub={() => openSubModal("away")}
            />
          </div>

          {/* Events */}
          <div className="rounded-[2rem] border border-gray-100 bg-white p-7 shadow-xl shadow-gray-200/50">
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
        </>
      )}
      </div>
      </div>

      {/* Player-picker modal (goal / card — only players currently on the pitch) */}
      <AnimatePresence>
        {picker && (
          <PlayerPickerModal
            picker={picker}
            entries={onPitchEntries(picker.side)}
            yellowSet={yellowCardedIds}
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
            outEntries={onPitchEntries(subModal.side)}
            inEntries={benchEntries(subModal.side)}
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
            Titulaires{" "}
            <span className={starters > STARTERS_MAX ? "text-red-500" : accentText}>
              {starters}/{STARTERS_MAX}
            </span>{" "}
            · <span className={accentText}>{subs}</span> remplaçant{subs > 1 ? "s" : ""}
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
  goalCooldown,
  onGoal,
  onYellow,
  onRed,
  onSub,
}: {
  teamName: string;
  accent: "primary" | "amber";
  disabled: boolean;
  goalCooldown: number;
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
            disabled={goalCooldown > 0}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl py-6 text-lg font-black uppercase tracking-widest text-white shadow-lg transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 ${goalCls}`}
          >
            <Goal size={24} />
            {goalCooldown > 0 ? `Buts dans ${goalCooldown}s` : "+1 BUT"}
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
  entries,
  yellowSet,
  minute,
  isSubmitting,
  onPick,
  onClose,
}: {
  picker: PickerState;
  entries: LineupEntry[];
  yellowSet: Set<string>;
  minute: number;
  isSubmitting: boolean;
  onPick: (entry: LineupEntry) => void;
  onClose: () => void;
}) {
  const title =
    picker.type === "goal" ? "But" : picker.type === "yellow_card" ? "Carton jaune" : "Carton rouge";

  // Starters first, then substitutes, for a natural reading order.
  const ordered = [...entries].sort((a, b) => {
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
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-gray-900">{entry.name}</span>
                  {yellowSet.has(entry.playerId) && (
                    <span title="Carton jaune" className="h-3 w-2 shrink-0 rounded-sm border border-amber-500/30 bg-amber-400" />
                  )}
                </span>
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
  outEntries,
  inEntries,
  subOut,
  subIn,
  setSubOut,
  setSubIn,
  isSubmitting,
  onSubmit,
  onClose,
}: {
  teamName: string;
  outEntries: LineupEntry[];
  inEntries: LineupEntry[];
  subOut: string;
  subIn: string;
  setSubOut: (v: string) => void;
  setSubIn: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const starters = outEntries;
  const substitutes = inEntries;

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
              Joueur sortant (sur le terrain)
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
