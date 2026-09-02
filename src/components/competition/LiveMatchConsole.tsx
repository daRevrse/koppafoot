"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ChevronLeft, ChevronRight, History, Clock,
  CheckCircle2, Loader2, Flame, Trophy, Shield, Goal,
  ArrowRightLeft, AlertTriangle, X, LogOut, GraduationCap,
  MonitorPlay, Ban, Check, Hand, Flag,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { PiloteConsole } from "@/lib/console-pilote";
import { normaliserPoste } from "@/lib/postes";
import { gardienDe } from "@/lib/terrain";
import { LIBELLE_EVENEMENT, demandeUneVictime, type TypeEvenementJoueur } from "@/lib/evenements";
import TerrainConsole, { ModaleActionsJoueur, type ActionJoueur } from "@/components/competition/TerrainConsole";
import type { CompMatch, CompPlayer, LineupEntry, Competition, GoalVarStatus } from "@/types";

/** One entry of the live feed. */
type LiveEvent = NonNullable<CompMatch["liveState"]>["events"][number];

// Football rule constants. Le nombre de titulaires et la durée des mi-temps
// viennent du format de la compétition (NvN, durée), voir plus bas.
const SUBS_MAX = 5;

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
type SheetRole = "out" | "starter" | "substitute";

/** Le joueur qu'on vient de toucher, et le camp d'ou il vient. */
interface ActionsState {
  side: Side;
  entry: LineupEntry;
}

/** La faute est posee, reste a nommer celui qui l'a subie, en face. */
interface VictimeState {
  eventId: string;
  /** Le camp de la VICTIME, donc l'oppose de celui de l'auteur. */
  side: Side;
  teamName: string;
  auteur: string;
}

// Follow-up modal: the passer on a goal that is already recorded.
interface AssistPickerState {
  eventId: string;
  side: Side;
  teamName: string;
  scorerId: string;
  scorerName: string;
}

/**
 * Demande au serveur de refaire le classement des joueurs.
 *
 * Silencieuse de bout en bout : l'appelant n'attend rien et ne veut rien
 * savoir. Le calcul se refait au match suivant de toute façon.
 */
async function recalculerLeClassement(fbUser: { getIdToken: () => Promise<string> } | null) {
  if (!fbUser) return;
  try {
    const token = await fbUser.getIdToken();
    await fetch("/api/rankings/rebuild", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Voir plus haut : rien à faire, et surtout rien à dire au scoreur.
  }
}

// ============================================
// Component
// ============================================

export default function LiveMatchConsole({
  pilote, returnHref,
}: {
  /**
   * Ou et comment ecrire : competition ou amical (voir lib/console-pilote).
   *
   * DOIT ETRE MEMOISE par l'appelant. Il est en dependance des abonnements,
   * et un objet neuf a chaque rendu les demonterait et remonterait en boucle.
   */
  pilote: PiloteConsole;
  returnHref: string;
}) {
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
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
  // Mobile shows ONE match sheet at a time: stacking both put the kickoff
  // button several screens down. On md+ the two sit side by side and this
  // is ignored.
  const [sheetSide, setSheetSide] = useState<Side>("home");

  // Le camp regarde sur le terrain, et le joueur touche.
  const [coteTerrain, setCoteTerrain] = useState<Side>("home");
  const [actions, setActions] = useState<ActionsState | null>(null);
  const [victime, setVictime] = useState<VictimeState | null>(null);
  // Second question, asked only after a goal: who laid it on. Optional by
  // design, the scoreboard is already right, this only enriches it.
  const [assistPicker, setAssistPicker] = useState<AssistPickerState | null>(null);

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
    const unsub = pilote.onMatch((m) => {
      setMatch(m);
      setLoading(false);
    });
    return () => unsub();
  }, [pilote]);

  // Subscribe to the competition (for role-based exit/lock logic).
  useEffect(() => {
    const unsub = pilote.onCompetition(setCompetition);
    return () => unsub();
  }, [pilote]);

  // Qui peut sortir sans terminer : l'organisateur en competition, le manager
  // sur un amical. Le pilote repond, la console ne connait pas les roles.
  const isOrganizer = pilote.autoriseAQuitter(user?.uid ?? null, competition, match);

  // Règles de jeu de la compétition : le NvN plafonne les titulaires, la durée
  // d'une mi-temps cale l'horloge (pause, puis coup de sifflet final à 2×).
  // La compétition arrive une frame après le match, d'où les valeurs par défaut.
  const { titulairesMax: startersMax, dureeMiTempsMin: halfMinutes } =
    pilote.regles(competition, match);
  const halfMs = halfMinutes * 60_000;
  const fullMs = halfMs * 2;

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
    if (!isPreKickoff || !match) return;
    let cancelled = false;
    setRostersLoading(true);
    (async () => {
      try {
        const { home, away } = await pilote.effectifs(match);
        if (cancelled) return;
        setHomeRoster(home);
        setAwayRoster(away);
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
    // `match` est lu mais volontairement hors dependances : il change a chaque
    // but, et les effectifs, eux, ne bougent pas d'un evenement a l'autre.
  }, [isPreKickoff, pilote, homeTeamId, awayTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await pilote.pauserChrono(displayTime);
      toast.success("Chronomètre arrêté");
    } catch {
      toast.error("Erreur technique");
    }
  }, [pilote, displayTime]);

  // Timer logic, copied verbatim from the referee console. The live_state
  // shapes are identical (timerStartAt / timerOffset / isTimerRunning), so the
  // server-clock computation works unchanged; only the pause writer is
  // retargeted to pauseCompTimer. The `match.status === "live"` guard is a
  // shipped bug fix (freeze the clock at full time), do NOT regress it.
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
      await pilote.demarrerChrono();
      toast.success("Chronomètre lancé");
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Period 1 → half-time: snap the clock to the end of the first half, stop,
  // move to break (period 2).
  const handleHalfTime = async () => {
    try {
      await pilote.pauserChrono(halfMs);
      await pilote.changerPeriode(2);
      if (match) {
        pilote.notifier(
          { title: "⏸️ Mi-temps", body: `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName}` },
          competition,
        );
      }
      toast.success("Mi-temps");
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Period 2 (break) → resume where the first half stopped, move to second
  // half (period 3).
  const handleResume = async () => {
    try {
      await pilote.demarrerChrono();
      await pilote.changerPeriode(3);
      if (match) {
        pilote.notifier(
          { title: "▶️ Reprise du match", body: `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName}, 2e mi-temps` },
          competition,
        );
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
    // Hard cap: at most `startersMax` titulaires per side (le NvN du format).
    // Un titulaire de trop bascule en remplaçant.
    // Compute + toast OUTSIDE the state updater (no side effects during render).
    if (next === "starter") {
      const starters = Object.entries(sheet).filter(
        ([id, role]) => role === "starter" && id !== playerId,
      ).length;
      if (starters >= startersMax) {
        next = "substitute";
        toast(`${startersMax} titulaires maximum, le reste = remplaçants`, { icon: "⚠️" });
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
        // Le compte, quand la ligne a ete revendiquee : c'est lui qui permet
        // de reconnaitre le joueur d'une equipe a l'autre (voir lib/types).
        userId: p.user_id ?? null,
        // Le poste suit le joueur sur la feuille, sous sa forme canonique. La
        // console en a besoin pour savoir qui est le gardien, et le terrain
        // pour placer les maillots. La ligne d'effectif l'ecrit en trois
        // orthographes, d'ou le normaliseur.
        position: normaliserPoste(p.position),
      }));

    const starters = entries.filter((e) => e.role === "starter").length;
    if (starters === 0) {
      toast.error("Ajoute au moins un titulaire à la feuille");
      return;
    }
    if (starters > startersMax) {
      toast.error(`${startersMax} titulaires maximum`);
      return;
    }

    setSavingSide(side);
    try {
      await pilote.poserFeuille(side, entries, true);
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
      await pilote.lancer({ home: homeOnPitch, away: awayOnPitch });
      pilote.notifier(
        { title: "🔴 C'est parti !", body: `${match.homeTeamName} – ${match.awayTeamName}, coup d'envoi !` },
        competition,
      );
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Organizer quit during live: navigate back.
  const handleQuit = useCallback(() => {
    router.push(returnHref);
  }, [router, returnHref]);

  // ----- VAR: review a goal already on the board -----
  //
  // A goal stands until the referee says otherwise, so "checking" leaves the
  // score alone and only announces the review. The scoreboard is moved by
  // `setCompGoalVarStatus`; here we tell the crowd what was decided.

  const [varPendingId, setVarPendingId] = useState<string | null>(null);

  const handleVarVerdict = async (event: LiveEvent, status: GoalVarStatus) => {
    if (!match) return;
    const teamName = event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName;
    const who = event.playerName ? `${event.playerName} (${teamName})` : teamName;

    setVarPendingId(event.id);
    try {
      await pilote.poserVar?.(event.id, status);
      if (status === "checking") {
        toast("But en cours de vérification");
        pilote.notifier(
          { title: "📺 VAR en cours", body: `Le but de ${who} est en cours de vérification` },
          competition,
        );
      } else if (status === "cancelled") {
        toast.success("But refusé");
        pilote.notifier(
          { title: "❌ But refusé", body: `Le but de ${who} est annulé` },
          competition,
        );
      } else {
        toast.success("But accordé");
        pilote.notifier(
          { title: "✅ But accordé", body: `Le but de ${who} est validé` },
          competition,
        );
      }
    } catch (err) {
      console.error("VAR verdict error:", err);
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la décision");
    } finally {
      setVarPendingId(null);
    }
  };

  // ----- La saisie, joueur par joueur -----

  /**
   * Enregistre ce qu'un joueur vient de faire.
   *
   * Un seul point d'entrée pour les six événements joueur : ils partagent
   * tout ce qui compte — la période, la minute, le camp, et le fait qu'une
   * erreur d'écriture doive laisser le match en état. Ce qui les distingue
   * tient dans les branches : le score, la notification, l'expulsion.
   */
  const enregistrerAction = async (
    side: Side,
    entry: LineupEntry,
    type: TypeEvenementJoueur,
  ) => {
    if (!match?.liveState) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }
    const period = match.liveState.currentPeriod ?? 1;
    const minute = Math.floor(displayTime / 60000) + 1;
    const onPitch = side === "home" ? match.homeOnPitch : match.awayOnPitch;
    const events = match.liveState.events ?? [];

    setIsSubmitting(true);
    try {
      if (type === "goal") {
        const goalId = await pilote.ajouterEvenement({
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
        pilote.notifier(
          { title: `⚽ BUT ! ${entry.name} (${minute}')`, body: `${match.homeTeamName} ${newHome} – ${newAway} ${match.awayTeamName}` },
          competition,
        );
        toast.success("BUT !");
        setGoalCooldown(60);
        // The goal is on the board; now the optional question.
        setAssistPicker({
          eventId: goalId,
          side,
          teamName,
          scorerId: entry.playerId,
          scorerName: entry.name,
        });
      } else if (type === "yellow_card") {
        const priorYellows = events.filter(
          (e) => e.type === "yellow_card" && e.playerId === entry.playerId,
        ).length;
        await pilote.ajouterEvenement({
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
          await pilote.ajouterEvenement({
            type: "red_card",
            side,
            team_id: teamId,
            period,
            minute,
            player_id: entry.playerId,
            player_name: entry.name,
            detail: "2e carton jaune",
          });
          await pilote.poserSurLeTerrain(side, onPitch.filter((id) => id !== entry.playerId));
          pilote.notifier(
            { title: `🟥 Expulsion (${minute}')`, body: `${entry.name} (${teamName}), 2e carton jaune` },
            competition,
          );
          toast("2e jaune → exclusion", { icon: "🟥" });
        } else {
          pilote.notifier(
            { title: `🟨 Carton jaune (${minute}')`, body: `${entry.name} (${teamName})` },
            competition,
          );
          toast.success("Carton jaune enregistré");
        }
      } else if (type === "red_card") {
        // Direct red card.
        await pilote.ajouterEvenement({
          type: "red_card",
          side,
          team_id: teamId,
          period,
          minute,
          player_id: entry.playerId,
          player_name: entry.name,
        });
        await pilote.poserSurLeTerrain(side, onPitch.filter((id) => id !== entry.playerId));
        pilote.notifier(
          { title: `🟥 Carton rouge (${minute}')`, body: `${entry.name} (${teamName})` },
          competition,
        );
        toast("Carton rouge → exclusion", { icon: "🟥" });
      } else {
        // Arrêt, faute, hors-jeu : l'historique du match, et rien d'autre.
        //
        // AUCUNE NOTIFICATION, volontairement. On réveille le téléphone d'un
        // supporter pour un but ou une expulsion, pas pour un hors-jeu à la
        // 12e. Ces trois-là existent pour les statistiques et pour le récit
        // d'après-match ; les pousser noierait les deux qui comptent.
        const id = await pilote.ajouterEvenement({
          type,
          side,
          team_id: teamId,
          period,
          minute,
          player_id: entry.playerId,
          player_name: entry.name,
        });
        toast.success(LIBELLE_EVENEMENT[type]);

        // La faute a deux acteurs. On la pose d'abord — elle est certaine —
        // puis on bascule sur le camp d'en face pour nommer la victime.
        if (demandeUneVictime(type)) {
          const autre: Side = side === "home" ? "away" : "home";
          setCoteTerrain(autre);
          setVictime({
            eventId: id,
            side: autre,
            teamName: autre === "home" ? match.homeTeamName : match.awayTeamName,
            auteur: entry.name,
          });
        }
      }
      setActions(null);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Hang the passer on the goal just recorded. Never blocks the console: if
   * the write fails the goal itself is already safe on the board, so the
   * error is worth a toast and nothing more.
   */
  const recordAssist = async (entry: LineupEntry) => {
    if (!assistPicker) return;
    setIsSubmitting(true);
    try {
      await pilote.poserPasseur(assistPicker.eventId, {
        playerId: entry.playerId,
        playerName: entry.name,
      });
      toast.success(`Passe décisive, ${entry.name}`);
      setAssistPicker(null);
    } catch {
      toast.error("Passe non enregistrée");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Nommer celui qui a subi la faute. Jamais bloquant : la faute est déjà
   * dans l'historique, la victime ne fait que l'enrichir.
   */
  const enregistrerVictime = async (entry: LineupEntry) => {
    if (!victime) return;
    setIsSubmitting(true);
    try {
      await pilote.poserVictime(victime.eventId, {
        playerId: entry.playerId,
        playerName: entry.name,
      });
      toast.success(`Faute sur ${entry.name}`);
      setVictime(null);
    } catch {
      toast.error("Victime non enregistrée");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----- Substitutions -----

  /**
   * `prerempli` vient du terrain : on touche le joueur qui sort (ou celui qui
   * entre, depuis le banc), et la modale s'ouvre avec la moitié de la réponse
   * déjà donnée. Ouverte sans lui, elle pose les deux questions.
   */
  const openSubModal = (
    side: Side,
    prerempli?: { sort?: string; entre?: string },
  ) => {
    if (!match) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    setSubOut(prerempli?.sort ?? "");
    setSubIn(prerempli?.entre ?? "");
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

    setIsSubmitting(true);
    try {
      const subMinute = Math.floor(displayTime / 60000) + 1;
      await pilote.ajouterEvenement({
        type: "substitution",
        side,
        team_id: teamId,
        period: match.liveState.currentPeriod ?? 1,
        minute: subMinute,
        player_id: inEntry.playerId,
        player_name: inEntry.name,
        detail: `${outEntry.name} → ${inEntry.name}`,
      });
      await pilote.poserSurLeTerrain(
        side,
        [...onPitch.filter((id) => id !== outEntry.playerId), inEntry.playerId],
      );
      pilote.notifier(
        { title: `🔄 Changement (${subMinute}')`, body: `${outEntry.name} → ${inEntry.name} (${subModal.teamName})` },
        competition,
      );
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

  // Whistle for full time: snap the clock to the end of the second half and
  // stop, then finish. On a knockout draw, collect penalties first.
  const handleFinishClick = async () => {
    if (!match) return;
    try {
      await pilote.pauserChrono(fullMs);
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
      await pilote.terminer(opts);
      if (match) {
        const scoreLine = `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName}`;
        pilote.notifier(
          { title: "🏁 Score final", body: opts ? `${scoreLine} (${opts.penaltyHome} – ${opts.penaltyAway} t.a.b.)` : scoreLine },
          competition,
        );
      }
      // Le classement des joueurs se recalcule à la fin de chaque match : c'est
      // le seul moment où il change. En arrière-plan et SANS BLOQUER — un
      // classement en retard d'un match est un désagrément, un coup de sifflet
      // final qui échoue est une perte.
      void recalculerLeClassement(firebaseUser);
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
        <Loader2 className="h-10 w-10 animate-spin text-emerald-700" />
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
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
        >
          Retour au calendrier
        </button>
      </div>
    );
  }

  // ----- Before kickoff → match-sheet builder + two-lineup-ready gate -----
  if (match.status !== "live" && match.status !== "completed") {
    const lineupsReady = match.homeLineupReady && match.awayLineupReady;

    // Full-height column: header and kickoff bar are pinned, only the roster
    // scrolls. `pt-safe` keeps the header clear of the status bar, the
    // console renders without the app shell, so nothing else provides it.
    return (
      <div
        ref={containerRef}
        className="mx-auto flex min-h-[100dvh] max-w-5xl flex-col bg-gray-50 pt-safe"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 px-2 pt-2">
          <button
            onClick={() => router.push(returnHref)}
            className="group flex h-10 w-10 shrink-0 items-center justify-center bg-white shadow-gray-200/60 transition-all hover:scale-110 active:scale-90"
          >
            <ChevronLeft size={20} className="text-gray-400 group-hover:text-gray-900" />
          </button>
          <div className="min-w-0 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">
              Feuilles de match
            </p>
            <h1 className="truncate font-display text-base font-black uppercase tracking-tight text-gray-900 sm:text-xl">
              {match.homeTeamName} <span className="mx-1 text-gray-300">vs</span> {match.awayTeamName}
            </h1>
            {/* Les règles du match, là où l'opérateur compose la feuille. */}
            <p className="mt-0.5 text-[11px] font-bold text-gray-400">
              {startersMax}v{startersMax} · 2 × {halfMinutes} min
            </p>
          </div>
          <div className="h-10 w-10 shrink-0" />
        </div>

        {/* Team switch, mobile only. Carries each side's validation state,
            since only one sheet is visible at a time. */}
        {!rostersLoading && (
          <div className="mx-2 mt-3 flex shrink-0 gap-1 bg-gray-200/70 p-1 md:hidden">
            {([
              { side: "home" as Side, label: "Domicile", name: match.homeTeamName, ready: match.homeLineupReady },
              { side: "away" as Side, label: "Extérieur", name: match.awayTeamName, ready: match.awayLineupReady },
            ]).map((t) => (
              <button
                key={t.side}
                onClick={() => setSheetSide(t.side)}
                className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-black transition-colors ${
                  sheetSide === t.side ? "bg-white text-gray-900" : "text-gray-500"
                }`}
              >
                {t.ready && <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />}
                <span className="truncate">{t.name || t.label}</span>
              </button>
            ))}
          </div>
        )}

        {rostersLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
            <p className="text-sm font-bold text-gray-400 italic">Chargement des effectifs...</p>
          </div>
        ) : (
          <div className="grid flex-1 gap-3 px-1 py-3 sm:gap-5 md:grid-cols-2">
            <div className={sheetSide === "home" ? "" : "hidden md:block"}>
              <LineupBuilder
                side="home"
                teamName={match.homeTeamName}
                accent="primary"
                roster={homeRoster ?? []}
                sheet={homeSheet}
                startersMax={startersMax}
                ready={match.homeLineupReady}
                saving={savingSide === "home"}
                onToggle={(pid) => toggleSheetRole("home", pid)}
                onValidate={() => handleValidateSheet("home")}
              />
            </div>
            <div className={sheetSide === "away" ? "" : "hidden md:block"}>
              <LineupBuilder
                side="away"
                teamName={match.awayTeamName}
                accent="amber"
                roster={awayRoster ?? []}
                sheet={awaySheet}
                startersMax={startersMax}
                ready={match.awayLineupReady}
                saving={savingSide === "away"}
                onToggle={(pid) => toggleSheetRole("away", pid)}
                onValidate={() => handleValidateSheet("away")}
              />
            </div>
          </div>
        )}

        {/* Launch gate, pinned, so kickoff is always one tap away instead of
            two rosters further down. */}
        <div className="sticky bottom-0 z-10 shrink-0 border-t border-gray-200/70 bg-white/95 px-3 py-3 pb-safe backdrop-blur">
          {!lineupsReady && !rostersLoading && (
            <div className="mb-2 flex items-center justify-center gap-2 text-amber-700">
              <AlertTriangle size={15} className="shrink-0 text-amber-500" />
              <p className="text-[11px] font-bold leading-tight">
                Valide les deux feuilles pour lancer le match.
              </p>
            </div>
          )}
          <button
            onClick={handleLaunch}
            disabled={!lineupsReady}
            className="group relative inline-flex w-full items-center justify-center gap-3 bg-gray-900 px-6 py-4 text-base font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-lg"
          >
            <span className="relative">Coup d&apos;envoi</span>
            <Flame size={20} className="relative transition-transform group-hover:rotate-12 group-hover:scale-125" />
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

  /**
   * Les actions proposées pour ce joueur.
   *
   * Elles dépendent de lui, et c'est tout l'intérêt d'être parti du joueur :
   * l'arrêt n'a de sens que pour un gardien, le hors-jeu n'en a aucun pour
   * lui, et un remplaçant ne peut ni marquer ni sortir — il entre.
   *
   * L'ARRÊT S'OUVRE À TOUT LE MONDE QUAND AUCUN GARDIEN N'EST DÉCLARÉ. Deux
   * tiers des lignes d'effectif n'ont pas de poste : réserver l'arrêt au
   * gardien déclaré le rendrait impossible à saisir sur la plupart des
   * feuilles. Le scoreur touche alors le bon joueur lui-même.
   */
  const actionsPour = (side: Side, entry: LineupEntry): ActionJoueur[] => {
    const surLeTerrain = new Set(
      side === "home" ? match.homeOnPitch : match.awayOnPitch,
    ).has(entry.playerId);
    const gardien = gardienDe(side === "home" ? homeLineup : awayLineup);
    const estLeGardien = gardien?.playerId === entry.playerId;

    const evenement = (
      cle: TypeEvenementJoueur,
      emoji: string,
      ton?: ActionJoueur["ton"],
    ): ActionJoueur => ({
      cle,
      libelle: LIBELLE_EVENEMENT[cle],
      emoji,
      ton,
      onClick: () => void enregistrerAction(side, entry, cle),
    });

    const jaune = evenement("yellow_card", "🟨", "jaune");
    const rouge = evenement("red_card", "🟥", "rouge");

    // Sur le banc : il ne joue pas, donc il n'a rien pu faire sur le terrain.
    // Il peut en revanche entrer, et prendre un carton en attendant.
    if (!surLeTerrain) {
      return [
        {
          cle: "entrer",
          libelle: "Faire entrer",
          emoji: "🔄",
          ton: "vert",
          onClick: () => {
            setActions(null);
            openSubModal(side, { entre: entry.playerId });
          },
        },
        jaune,
        rouge,
      ];
    }

    return [
      {
        ...evenement("goal", "⚽", "vert"),
        // Le délai anti-double-appui du but, hérité des cartes d'équipe : un
        // but tapé deux fois est un score faux, et le corriger demande une
        // intervention d'organisateur.
        libelle: goalCooldown > 0 ? `But (${goalCooldown}s)` : "But",
        onClick: () => {
          if (goalCooldown > 0) return;
          void enregistrerAction(side, entry, "goal");
        },
      },
      ...(estLeGardien || gardien === null ? [evenement("save", "🧤")] : []),
      ...(estLeGardien ? [] : [evenement("offside", "🚩")]),
      evenement("foul", "⚠️"),
      jaune,
      rouge,
      {
        cle: "remplacer",
        libelle: "Remplacer",
        emoji: "🔄",
        onClick: () => {
          setActions(null);
          openSubModal(side, { sort: entry.playerId });
        },
      },
    ];
  };

  // Exit affordance: live → organizer only ("Quitter"); moderator locked out.
  // Completed → everyone gets a normal back control.
  const showQuit = !isCompleted && isOrganizer;
  const showBack = isCompleted;

  return (
    <div ref={containerRef} className="mx-auto max-w-5xl space-y-4 overflow-y-auto bg-gray-50 pb-28 pt-safe sm:space-y-7 lg:max-w-7xl">
      {/* Sandbox banner, the console is otherwise indistinguishable from the
          real thing, and a trainee must never wonder whether it counts. */}
      {competition?.isSandbox && (
        <div className="mx-2 flex items-start gap-3 border border-emerald-200 bg-emerald-50 p-4">
          <GraduationCap size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-black text-emerald-900">Mode entraînement</p>
            <p className="mt-0.5 text-xs font-semibold leading-relaxed text-emerald-800">
              Ce match est fictif. Rien n&apos;est publié, aucune notification n&apos;est
              envoyée, aucune statistique n&apos;est comptée, essaie tout ce que tu
              veux. Tu peux le remettre à zéro depuis l&apos;espace live.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-2">
        {showBack ? (
          <button
            onClick={() => router.push(returnHref)}
            className="group flex h-11 w-11 items-center justify-center bg-white shadow-gray-200/60 transition-all hover:scale-110 active:scale-90"
          >
            <ChevronLeft size={22} className="text-gray-400 group-hover:text-gray-900" />
          </button>
        ) : showQuit ? (
          <button
            onClick={handleQuit}
            className="group flex h-11 items-center gap-2 bg-white px-4 shadow-gray-200/60 transition-all hover:scale-105 active:scale-95"
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
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-900" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                  Match en Direct
                </span>
              </>
            )}
          </div>
          <h1 className="font-display text-base font-black uppercase tracking-tight text-gray-900 sm:text-xl">
            {match.homeTeamName} <span className="mx-1.5 text-gray-300">vs</span> {match.awayTeamName}
          </h1>
        </div>
        <div className="h-11 w-11" />
      </div>

      {/* Landscape layout on desktop: scoreboard + status controls on the
          left (sticky), scoring + events on the right. Mobile stays a
          single vertical column. */}
      <div className="space-y-4 sm:space-y-7 lg:grid lg:grid-cols-2 lg:items-start lg:gap-7 lg:space-y-0">
      <div className="space-y-4 sm:space-y-7 lg:sticky lg:top-6">
      {/* Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-[#0A0A0B] p-4 text-white sm:p-10"
      >
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-[80%] -translate-x-1/2 bg-[radial-gradient(circle_at_50%_0%,rgba(37,99,235,0.3),transparent)]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-50 blur-[100px]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />

        <div className="relative z-10 grid grid-cols-3 items-center">
          {/* Home */}
          <div className="flex flex-col items-center gap-2.5 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex h-11 w-11 items-center justify-center border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-xl font-black backdrop-blur-md sm:h-20 sm:w-20 sm:text-3xl">
                {match.homeTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="mb-1 max-w-[120px] truncate text-xs font-black uppercase tracking-tight text-white/50">
                {match.homeTeamName}
              </h2>
              <div className="text-4xl font-black tracking-tighter drop-shadow-2xl sm:text-7xl">
                {match.scoreHome ?? 0}
              </div>
            </div>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center">
            <div className="mb-3 rounded-full border border-white/5 bg-white/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-500 backdrop-blur-xl sm:mb-5 sm:px-5 sm:py-1.5 sm:text-[10px] sm:tracking-[0.2em]">
              {PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label || "Match"}
            </div>
            <div className="relative flex flex-col items-center">
              <div className="absolute -inset-8 rounded-full bg-emerald-50 blur-3xl" />
              <div className="relative font-mono text-3xl font-black leading-none tracking-tighter tabular-nums text-emerald-500 sm:text-[4.5rem]">
                {formatTime(displayTime)}
              </div>
            </div>
            {!isCompleted && (match.liveState?.currentPeriod === 1 || match.liveState?.currentPeriod === 3) && (
              <div className="mt-3.5 flex gap-6 sm:mt-8">
                {match.liveState?.isTimerRunning ? (
                  <button
                    onClick={handlePauseTimer}
                    className="flex h-11 w-11 items-center justify-center bg-amber-500 text-white transition-all hover:scale-110 hover:bg-amber-600 active:scale-95 sm:h-16 sm:w-16"
                  >
                    <Pause size={24} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    onClick={handleStartTimer}
                    className="flex h-11 w-11 items-center justify-center bg-gray-900 text-white transition-all hover:scale-110 hover:bg-gray-900 active:scale-95 sm:h-16 sm:w-16"
                  >
                    <Play size={24} fill="currentColor" className="ml-1" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Away */}
          <div className="flex flex-col items-center gap-2.5 sm:gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-white/10 blur-xl" />
              <div className="relative flex h-11 w-11 items-center justify-center border border-white/10 bg-gradient-to-br from-white/10 to-white/5 text-xl font-black backdrop-blur-md sm:h-20 sm:w-20 sm:text-3xl">
                {match.awayTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="mb-1 max-w-[120px] truncate text-xs font-black uppercase tracking-tight text-white/50">
                {match.awayTeamName}
              </h2>
              <div className="text-4xl font-black tracking-tighter drop-shadow-2xl sm:text-7xl">
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
          <div className="flex items-center justify-between bg-amber-500 p-3 text-white shadow-amber-500/20 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center bg-white/20">
                <Shield size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Session live active</p>
                <p className="font-display text-xs font-bold italic">Ne quittez pas cette page avant le coup de sifflet final</p>
              </div>
            </div>
          </div>

          {/* Workflow */}
          <div className=" border border-gray-200/70 bg-white p-4 shadow-gray-200/50 sm:p-7">
            <div className="mb-3.5 flex items-center gap-3 sm:mb-5">
              <Clock className="text-gray-400" size={18} />
              <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Déroulé</h3>
            </div>
            <div className="space-y-3">
              {match.liveState?.currentPeriod === 1 && (
                <button
                  onClick={handleHalfTime}
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-between bg-gray-900 px-4 py-3 text-sm font-bold text-white sm:px-5 sm:py-4 transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Mi-temps</span>
                  <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
                </button>
              )}
              {match.liveState?.currentPeriod === 2 && (
                <button
                  onClick={handleResume}
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-between bg-gray-900 px-4 py-3 text-sm font-bold text-white sm:px-5 sm:py-4 transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50"
                >
                  <span>Reprise (2e mi-temps)</span>
                  <Play size={18} fill="currentColor" />
                </button>
              )}
              {match.liveState?.currentPeriod === 3 && (
                <button
                  onClick={handleFinishClick}
                  disabled={isSubmitting}
                  className="flex w-full items-center justify-between border border-red-50 bg-red-50/50 px-4 py-3 text-sm font-bold text-red-600 sm:px-5 sm:py-4 transition-all hover:bg-red-50 active:scale-[0.98] disabled:opacity-50"
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
      <div className="space-y-4 sm:space-y-7">
      {isCompleted ? (
        /* ----- Read-only completed summary ----- */
        <div className=" border border-gray-200/70 bg-white p-5 shadow-gray-200/40 sm:p-8">
          <div className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="flex h-10 w-10 items-center justify-center bg-emerald-50 text-emerald-600">
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
          {/* Le terrain : on touche un joueur, on dit ce qu'il a fait. */}
          <div className="px-1">
            <TerrainConsole
              home={{
                name: match.homeTeamName,
                surLeTerrain: homeDisabled ? [] : onPitchEntries("home"),
                banc: homeDisabled ? [] : benchEntries("home"),
              }}
              away={{
                name: match.awayTeamName,
                surLeTerrain: awayDisabled ? [] : onPitchEntries("away"),
                banc: awayDisabled ? [] : benchEntries("away"),
              }}
              cote={coteTerrain}
              onCote={setCoteTerrain}
              jaunes={yellowCardedIds}
              onJoueur={(side, entry) => setActions({ side, entry })}
            />
          </div>

          {/* Events */}
          <div className=" border border-gray-200/70 bg-white p-4 shadow-gray-200/50 sm:p-7">
            <div className="mb-4 flex items-center justify-between sm:mb-6">
              <div className="flex items-center gap-3">
                <History className="text-gray-400" size={18} />
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Événements</h3>
              </div>
              <div className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {events.length} Total
              </div>
            </div>
            <EventTimeline
              events={events}
              homeTeamId={match.homeTeamId}
              homeTeamName={match.homeTeamName}
              awayTeamName={match.awayTeamName}
              onVarVerdict={handleVarVerdict}
              varPendingId={varPendingId}
            />
          </div>
        </>
      )}
      </div>
      </div>

      {/* Ce qu'un joueur vient de faire. La liste dépend de lui : son poste,
          et s'il est sur le terrain ou sur le banc. */}
      <AnimatePresence>
        {actions && (
          <ModaleActionsJoueur
            entry={actions.entry}
            teamName={actions.side === "home" ? match.homeTeamName : match.awayTeamName}
            minute={Math.floor(displayTime / 60000) + 1}
            isSubmitting={isSubmitting}
            actions={actionsPour(actions.side, actions.entry)}
            onClose={() => setActions(null)}
          />
        )}
      </AnimatePresence>

      {/* La victime de la faute, dans le camp d'en face. Facultative. */}
      <AnimatePresence>
        {victime && (
          <PlayerPickerModal
            titre={`Faute de ${victime.auteur}`}
            sousTitre={`${Math.floor(displayTime / 60000) + 1}' · Sur qui ?`}
            teamName={victime.teamName}
            entries={onPitchEntries(victime.side)}
            yellowSet={yellowCardedIds}
            isSubmitting={isSubmitting}
            onPick={enregistrerVictime}
            onClose={() => setVictime(null)}
            ignorer="Victime inconnue"
          />
        )}
      </AnimatePresence>

      {/* Passer on the goal just scored, skippable, and the scorer is out. */}
      <AnimatePresence>
        {assistPicker && (
          <PlayerPickerModal
            titre="Passe décisive"
            sousTitre={`${Math.floor(displayTime / 60000) + 1}' · Qui a servi ${assistPicker.scorerName} ?`}
            teamName={assistPicker.teamName}
            entries={onPitchEntries(assistPicker.side).filter(
              (e) => e.playerId !== assistPicker.scorerId,
            )}
            yellowSet={yellowCardedIds}
            isSubmitting={isSubmitting}
            onPick={recordAssist}
            onClose={() => setAssistPicker(null)}
            ignorer="Aucune passe décisive"
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
          <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
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
              className="relative w-full max-w-sm bg-white p-5 shadow-2xl sm:p-8"
            >
              <div className="mb-4 flex items-center gap-3 sm:mb-6">
                <div className="flex h-10 w-10 items-center justify-center bg-amber-50 text-amber-600">
                  <Trophy size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900">Tirs au but</h2>
                  <p className="text-xs font-medium text-gray-400">Match nul, départage requis</p>
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
                    className="w-full border border-gray-200/70 bg-gray-50 p-4 text-center text-xl font-black outline-none transition-colors focus:border-gray-900"
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
                    className="w-full border border-gray-200/70 bg-gray-50 p-4 text-center text-xl font-black outline-none transition-colors focus:border-gray-900"
                  />
                </label>
              </div>

              <button
                onClick={handlePenaltySubmit}
                disabled={isSubmitting}
                className="mt-6 flex w-full items-center justify-center gap-2 bg-gray-900 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black active:scale-95 disabled:opacity-50"
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
  startersMax,
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
  /** Titulaires autorisés, le NvN de la compétition. */
  startersMax: number;
  ready: boolean;
  saving: boolean;
  onToggle: (playerId: string) => void;
  onValidate: () => void;
}) {
  const accentText = accent === "primary" ? "text-emerald-700" : "text-amber-500";
  const validateCls =
    accent === "primary"
      ? "bg-gray-900 hover:bg-emerald-700"
      : "bg-amber-500 hover:bg-amber-600 shadow-amber-200";

  const starters = roster.filter((p) => sheet[p.id] === "starter").length;
  const subs = roster.filter((p) => sheet[p.id] === "substitute").length;

  return (
    <div className="relative overflow-hidden border border-gray-200/70 bg-white p-4 shadow-gray-200/40 sm:p-7">
      {/* Side label and team name are already in the mobile tab above, so
          they only appear from md up where both sheets show at once. */}
      <div className="mb-1 hidden items-center justify-between md:flex">
        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
          {accent === "primary" ? "Domicile" : "Extérieur"}
        </h3>
        {ready && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-tighter text-emerald-600">
            <CheckCircle2 size={12} /> Validée
          </span>
        )}
      </div>
      <h2 className="mb-1 hidden max-w-full truncate text-lg font-black tracking-tight text-gray-900 md:block">
        {teamName}
      </h2>

      {roster.length === 0 ? (
        <div className="mt-4 border border-dashed border-gray-200/70 px-4 py-10 text-center text-xs font-bold leading-relaxed text-gray-400">
          Effectif vide, ajoute les joueurs dans la config de l&apos;équipe
        </div>
      ) : (
        <>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Titulaires{" "}
            <span className={starters > startersMax ? "text-red-500" : accentText}>
              {starters}/{startersMax}
            </span>{" "}
            · <span className={accentText}>{subs}</span> remplaçant{subs > 1 ? "s" : ""}
          </p>
          {/* The roster is the only thing that scrolls. On mobile it takes
              the viewport minus header, tabs and the pinned kickoff bar. */}
          <div className="custom-scrollbar mb-4 max-h-[calc(100dvh-20rem)] space-y-2 overflow-y-auto pr-1 md:max-h-[320px]">
            {roster.map((p) => {
              const role = sheet[p.id] ?? "out";
              return (
                <button
                  key={p.id}
                  onClick={() => onToggle(p.id)}
                  className={`flex w-full items-center gap-3 border px-4 py-3 text-left transition-all active:scale-[0.99] ${
                    role === "out"
                      ? "border-gray-200/70 bg-gray-50/50 hover:border-gray-200/70"
                      : role === "starter"
                        ? "border-emerald-500/30 bg-emerald-50/60"
                        : "border-sky-500/30 bg-sky-50/60"
                  }`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-white text-sm font-black text-gray-900">
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
            className={`flex w-full items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 ${validateCls}`}
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
    <span className="shrink-0 rounded-full border border-gray-200/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-tighter text-gray-400">
      Hors feuille
    </span>
  );
}

function PlayerPickerModal({
  titre,
  sousTitre,
  teamName,
  entries,
  yellowSet,
  isSubmitting,
  onPick,
  onClose,
  ignorer,
}: {
  /** Ce qu'on demande. La modale ne devine plus rien du type d'événement. */
  titre: string;
  sousTitre: string;
  teamName: string;
  entries: LineupEntry[];
  yellowSet: Set<string>;
  isSubmitting: boolean;
  onPick: (entry: LineupEntry) => void;
  onClose: () => void;
  /**
   * Le libellé du bouton qui referme sans répondre. Présent uniquement sur les
   * questions FACULTATIVES — la passe décisive, la victime d'une faute : le
   * fait principal est déjà enregistré, la console ne doit pas retenir le
   * scoreur pour un détail.
   */
  ignorer?: string;
}) {

  // Starters first, then substitutes, for a natural reading order.
  const ordered = [...entries].sort((a, b) => {
    if (a.role === b.role) return 0;
    return a.role === "starter" ? -1 : 1;
  });

  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
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
        className="relative w-full max-w-md bg-white p-5 shadow-2xl sm:p-7"
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={18} />
        </button>
        <h2 className="text-xl font-black text-gray-900">
          {titre}
        </h2>
        <p className="mb-6 mt-1 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
          {teamName} · {sousTitre}
        </p>

        <div className="custom-scrollbar grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {ordered.map((entry) => (
            <button
              key={entry.playerId}
              disabled={isSubmitting}
              onClick={() => onPick(entry)}
              className="group flex items-center gap-3 border border-gray-200/70 bg-gray-50/50 px-4 py-3 text-left transition-all hover:border-gray-900 hover:bg-white active:scale-95 disabled:opacity-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-gray-900 text-sm font-black text-white">
                {entry.number || entry.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-gray-900">{entry.name}</span>
                  {yellowSet.has(entry.playerId) && (
                    <span title="Carton jaune" className="h-3 w-2 shrink-0 border border-amber-500/30 bg-amber-400" />
                  )}
                </span>
                <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">
                  {entry.role === "starter" ? "Titulaire" : "Remplaçant"}
                </span>
              </span>
            </button>
          ))}
        </div>

        {ignorer && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="mt-3 w-full border border-gray-200/70 py-2.5 text-sm font-bold text-gray-400 transition-colors hover:border-gray-200/70 hover:text-gray-600 disabled:opacity-50"
          >
            {ignorer}
          </button>
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
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
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
        className="relative w-full max-w-md bg-white p-5 shadow-2xl sm:p-8"
      >
        <div className="mb-4 flex items-center gap-3 sm:mb-6">
          <div className="flex h-10 w-10 items-center justify-center bg-gray-900 text-white">
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
              className="w-full border border-gray-200/70 bg-gray-50 p-4 text-sm font-bold outline-none transition-colors focus:border-red-500"
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
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-900 text-white">
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
              className="w-full border border-gray-200/70 bg-gray-50 p-4 text-sm font-bold outline-none transition-colors focus:border-emerald-500"
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
            className="mt-2 flex w-full items-center justify-center gap-2 bg-gray-900 py-4 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black active:scale-95 disabled:opacity-50"
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
  onVarVerdict,
  varPendingId,
}: {
  events: NonNullable<CompMatch["liveState"]>["events"];
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  /** Omitted on a finished match: the feed is then read-only. */
  onVarVerdict?: (event: LiveEvent, status: GoalVarStatus) => void;
  varPendingId?: string | null;
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

  // The VAR is called on the goal that just happened, and play is stopped
  // while it runs, so no other goal can come in and push the review down the
  // feed. The controls therefore hang off the last goal alone, and disappear
  // once it has been ruled on: a verdict is final.
  const lastGoalId = [...events].reverse().find((e) => e.type === "goal")?.id ?? null;

  return (
    <div className="custom-scrollbar max-h-[350px] space-y-3 overflow-y-auto pr-2 sm:space-y-4">
      {[...events].reverse().map((event) => {
        const isHome = event.teamId === homeTeamId;
        const isSub = event.type === "substitution";
        const isGoal = event.type === "goal";
        const checking = isGoal && event.varStatus === "checking";
        const cancelled = isGoal && event.varStatus === "cancelled";
        const confirmed = isGoal && event.varStatus === "confirmed";
        const varBusy = varPendingId === event.id;
        const reviewable =
          isGoal && !!onVarVerdict && event.id === lastGoalId && !confirmed && !cancelled;
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="group flex items-center gap-3.5 sm:gap-5"
          >
            <div
              className={`relative flex h-11 w-11 shrink-0 items-center justify-center border text-xs font-black ${
                cancelled
                  ? "border-gray-200/70 bg-gray-50 text-gray-300"
                  : checking
                    ? "border-amber-200 bg-amber-50 text-amber-600"
                    : "border-gray-200/70 bg-gray-50"
              }`}
            >
              {/* 0 = minute unknown (goal entered after the fact, off-clock). */}
              {event.minute ? `${event.minute}'` : ","}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {isGoal && (
                  <Goal size={16} className={cancelled ? "text-gray-300" : "text-amber-500"} />
                )}
                {event.type === "yellow_card" && (
                  <span className="h-5 w-3.5 border border-amber-500/20 bg-amber-400" />
                )}
                {event.type === "red_card" && (
                  <span className="h-5 w-3.5 border border-red-700/20 bg-red-600" />
                )}
                {isSub && <ArrowRightLeft size={16} className="text-sky-500" />}
                {event.type === "save" && <Hand size={16} className="text-emerald-600" />}
                {event.type === "foul" && <AlertTriangle size={16} className="text-orange-500" />}
                {event.type === "offside" && <Flag size={16} className="text-gray-400" />}
                <span
                  className={`text-sm font-black uppercase tracking-tight ${
                    cancelled ? "text-gray-400 line-through" : "text-gray-900"
                  }`}
                >
                  {isGoal ? "BUT !" : LIBELLE_EVENEMENT[event.type]}
                </span>

                {checking && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    VAR en cours
                  </span>
                )}
                {cancelled && (
                  <span className="inline-flex items-center gap-1 bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                    <Ban size={10} />
                    But refusé
                  </span>
                )}
                {confirmed && (
                  <span className="inline-flex items-center gap-1 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                    <Check size={10} />
                    Accordé VAR
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-tighter text-gray-400">
                {isSub && event.detail ? (
                  <span className="text-sky-600">{event.detail}</span>
                ) : (
                  <>
                    {event.playerName ? `${event.playerName} • ` : ""}
                    {isHome ? homeTeamName : awayTeamName}
                    {/* Une faute a deux acteurs : la nommer sans sa victime
                        n'apprend que la moitié de ce qui s'est passé. */}
                    {event.type === "foul" && event.victimPlayerName
                      ? ` • sur ${event.victimPlayerName}`
                      : ""}
                  </>
                )}
              </p>

              {/* VAR controls, last goal only, while the match is running */}
              {reviewable && onVarVerdict && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {varBusy && <Loader2 size={13} className="animate-spin text-gray-300" />}
                  {!checking && (
                    <button
                      type="button"
                      disabled={varBusy}
                      onClick={() => onVarVerdict(event, "checking")}
                      className="inline-flex items-center gap-1 border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                    >
                      <MonitorPlay size={12} />
                      Vérifier (VAR)
                    </button>
                  )}
                  {checking && (
                    <button
                      type="button"
                      disabled={varBusy}
                      onClick={() => onVarVerdict(event, "confirmed")}
                      className="inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Check size={12} />
                      But accordé
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={varBusy}
                    onClick={() => onVarVerdict(event, "cancelled")}
                    className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  >
                    <Ban size={12} />
                    Refuser le but
                  </button>
                </div>
              )}
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
