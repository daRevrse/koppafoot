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

/**
 * Le nom tel qu'il tient dans une case de grille : le patronyme, seul.
 *
 * Une case fait un cinquième de la largeur d'un téléphone. « Sergio Ramos » n'y
 * entre pas, « RAMOS » si — et c'est de toute façon ce qu'on lit sur un maillot
 * et ce qu'on crie depuis la touche.
 */
const nomDeMaillot = (nomComplet: string, numero?: string): string => {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  const nom = (mots.length > 1 ? mots[mots.length - 1] : mots[0] ?? "").toUpperCase();
  // « Joueur 9 » donne « 9 », soit le numéro déjà écrit juste au-dessus. Les
  // joueurs d'un adversaire hors plateforme s'appellent tous ainsi : la case
  // afficherait deux fois le même chiffre.
  return nom === (numero ?? "").trim().toUpperCase() ? "" : nom;
};

const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Fin de match" }
];

/** Une mi-temps, puis le match entier. Mêmes durées que la pause automatique. */
const MI_TEMPS_MS = 45 * 60_000;
const MATCH_MS = MI_TEMPS_MS * 2;

// Un joueur tel que la console le manipule, qu'il ait un compte (participation)
// ou non (feuille de match d'une équipe hors plateforme).
type ConsolePlayer = {
  playerId: string;
  playerName: string;
  squadNumber?: string;
  isStarter: boolean;
};

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
  const [selectedPlayer, setSelectedPlayer] = useState<{ player: ConsolePlayer, teamId: string, teamName: string } | null>(null);
  const [subInPlayer, setSubInPlayer] = useState("");
  const [subOutPlayer, setSubOutPlayer] = useState("");
  /**
   * Verrou du bouton BUT : soixante secondes après chaque but.
   *
   * Un but se saisit dans la seconde qui suit, au bord du terrain, sur un
   * téléphone tenu d'une main — et c'est précisément là qu'on tape deux fois.
   * Le score d'un match ne se rattrape pas : `addMatchEvent` incrémente, il ne
   * corrige pas. Une minute est plus long qu'un doigt qui tremble, et plus
   * court que le temps qu'il faut au jeu pour produire le but suivant.
   *
   * La console de compétition a ce verrou depuis toujours (voir
   * LiveMatchConsole) ; celle-ci ne l'a jamais eu.
   */
  const [goalCooldown, setGoalCooldown] = useState(0);
  useEffect(() => {
    if (goalCooldown <= 0) return;
    const t = setTimeout(() => setGoalCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [goalCooldown]);

  /**
   * Quel panneau occupe l'écran sur mobile.
   *
   * La console empilait tout à la verticale : tableau d'affichage, les deux
   * grilles d'équipe, le déroulé du match, les événements. Sur un téléphone,
   * saisir un but demandait de faire défiler pendant que le jeu continue.
   * Un seul panneau à la fois, le reste à un geste. Au-delà de `md`, la
   * disposition d'origine reprend : l'écran y tient tout.
   */
  const [panneau, setPanneau] = useState<"home" | "away" | "events">("home");

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

  // Only the two managers, a confirmed referee and the match's own moderators
  // may operate it. The console had no guard at all while it lived in the
  // shelved referee panel, reachable by URL alone. Server-side enforcement is
  // the Firestore rules' job; this just keeps the wrong people out of the
  // controls.
  useEffect(() => {
    if (!match || !user) return;
    const canOperate =
      user.uid === match.managerId ||
      user.uid === match.awayManagerId ||
      (match.moderatorIds ?? []).includes(user.uid) ||
      (match.refereeId === user.uid && match.refereeStatus === "confirmed");
    if (!canOperate) {
      toast.error("Tu n'es pas chargé de couvrir ce match.");
      router.replace(`/matches/${id}`);
    }
  }, [match, user, router, id]);

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

    // Le sortant/entrant peut venir d'une participation ou de la feuille d'une
    // équipe hors plateforme.
    const nameOf = (playerId: string) =>
      participations.find(p => p.playerId === playerId)?.playerName
      ?? [...(match?.homeGhostLineup ?? []), ...(match?.awayGhostLineup ?? [])]
           .find(e => e.playerId === playerId)?.name;

    const inName = nameOf(subInPlayer);
    const outName = nameOf(subOutPlayer);

    if (!inName || !outName) return;

    await handleAddEvent(
      "substitution",
      showSubModal.teamId,
      undefined,
      undefined,
      `${outName} ➔ ${inName}`
    );

    setShowSubModal(null);
    setSubInPlayer("");
    setSubOutPlayer("");
  };

  /**
   * Changer de période, c'est piloter le chronomètre.
   *
   * Il ne suivait pas : la transition se contentait de mettre en pause SI le
   * chrono tournait. Passer de la mi-temps à la seconde période ne relançait
   * donc rien — le chrono était déjà arrêté — et le match repartait sur le
   * terrain pendant que la console restait figée à 45:00, jusqu'à ce que
   * quelqu'un pense à rappuyer sur lecture.
   *
   * Les trois transitions, avec les mêmes conventions que la console de
   * compétition (voir LiveMatchConsole) :
   *   → Mi-temps      : le chrono se cale sur 45:00 et s'arrête. On le cale
   *                     plutôt que de le figer où il est, parce que le coup de
   *                     sifflet tombe rarement à la seconde près et que la
   *                     seconde période doit repartir de 45:00.
   *   → 2ème mi-temps : il repart de là, tout seul.
   *   → Fin de match  : il se cale sur 90:00 et s'arrête.
   */
  const handleNextPeriod = async () => {
    if (!match?.liveState) return;
    const next = match.liveState.currentPeriod + 1;
    if (next > 4) return;

    try {
      await updateMatchPeriod(id, next);

      if (next === 2) {
        await pauseMatchTimer(id, MI_TEMPS_MS);
        toast.success("Mi-temps · chrono arrêté à 45:00");
      } else if (next === 3) {
        // Déjà lancé (quelqu'un a rappuyé sur lecture avant de changer de
        // période) : on n'y retouche pas, redémarrer perdrait le temps écoulé
        // depuis ce départ.
        if (!match.liveState.isTimerRunning) await startMatchTimer(id);
        toast.success("2ème mi-temps · chrono relancé");
      } else {
        await pauseMatchTimer(id, MATCH_MS);
        toast.success("Fin du temps réglementaire · chrono arrêté à 90:00");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erreur technique");
    }
  };

  const handleFinishMatch = async () => {
    if (!window.confirm("Confirmer la fin du match ? Les scores seront définitifs.")) return;
    setIsSubmitting(true);
    try {
       await updateMatchStatus(id, "completed");
       toast.success("Match terminé ! Le résultat est enregistré.");
       router.push(`/matches/${id}`);
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

  /**
   * Un match terminé n'a plus de console.
   *
   * La garde ci-dessous laissait passer « completed » vers la console
   * COMPLÈTE : chronomètre, grilles de joueurs, « Siffler la fin ». Un match
   * fini rouvrait donc comme s'il était en cours, et un but ajouté par
   * mégarde incrémentait son score pour de bon — `addMatchEvent` ajoute, il
   * ne corrige pas. Le résultat était déjà consolidé sur les clubs et les
   * joueurs à ce moment-là.
   *
   * Même chose pour un match annulé : il n'y a rien à couvrir.
   *
   * Ce n'est pas une redirection muette : on arrive ici par un lien gardé
   * dans un fil de discussion ou par l'historique du navigateur, et il vaut
   * mieux dire pourquoi la porte est fermée que de renvoyer sans un mot.
   */
  if (match.status === "completed" || match.status === "cancelled") {
    const termine = match.status === "completed";
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50/30 p-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center bg-white text-gray-300">
          {termine ? <CheckCircle2 size={40} /> : <AlertTriangle size={40} />}
        </div>
        <h2 className="mt-8 font-display text-3xl font-black tracking-tight text-gray-900">
          {termine ? "Match terminé" : "Match annulé"}
        </h2>
        <p className="mt-3 max-w-sm text-base font-medium leading-relaxed text-gray-500">
          {termine ? (
            <>
              {match.homeTeamName} {match.scoreHome ?? 0} – {match.scoreAway ?? 0} {match.awayTeamName}.
              {" "}Le direct est clos : la feuille, le déroulé et le rapport se lisent sur la fiche du match.
            </>
          ) : (
            <>Cette rencontre n&apos;aura pas lieu, il n&apos;y a rien à couvrir.</>
          )}
        </p>
        <button
          onClick={() => router.push(`/matches/${id}`)}
          className="mt-10 inline-flex items-center gap-2 bg-gray-900 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-black"
        >
          <ChevronLeft size={16} /> Voir la fiche du match
        </button>
      </div>
    );
  }

  // Initialize if not live
  if (match.status !== "live") {
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
          <div className="flex items-center justify-between p-6 bg-white border border-gray-200/70 shadow-gray-200/50">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 flex items-center justify-center ${match.homeLineupReady ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {match.homeLineupReady ? <CheckCircle2 size={24} /> : <Clock size={24} />}
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Home Lineup</p>
                <p className="text-sm font-black text-gray-900">{match.homeTeamName}</p>
              </div>
            </div>
            {!match.homeLineupReady && <span className="text-[10px] font-black text-amber-500 bg-amber-50 px-3 py-1 rounded-full uppercase tracking-tighter">Attente</span>}
          </div>

          <div className="flex items-center justify-between p-6 bg-white border border-gray-200/70 shadow-gray-200/50">
            <div className="flex items-center gap-4">
              <div className={`h-10 w-10 flex items-center justify-center ${match.awayLineupReady ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
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
          /* Cet écran occupe tout l'affichage et n'offrait AUCUNE sortie quand
             les feuilles n'étaient pas prêtes : on arrivait sur la console, on
             apprenait qu'elle ne pouvait pas démarrer, et il fallait la touche
             retour du navigateur pour s'en extraire. */
          <div className="mt-12 flex w-full max-w-sm flex-col items-center gap-4">
            <div className="flex w-full flex-col items-center gap-4 border border-amber-100/50 bg-amber-50 p-8 text-sm font-bold text-amber-800">
              <div className="flex h-14 w-14 items-center justify-center bg-white text-amber-500">
                <AlertTriangle size={24} />
              </div>
              <p className="leading-relaxed">
                L&apos;arbitre ne peut lancer le match que lorsque les deux managers ont <span className="text-amber-900 underline decoration-amber-500/30 underline-offset-4">validé leurs feuilles de match</span>.
              </p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => initLiveMatch(id)}
            className="mt-12 group relative inline-flex items-center gap-6 bg-emerald-600 px-14 py-8 text-2xl font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 hover:scale-105 active:scale-95"
          >
            <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative">Lancer le Match</span>
            <Flame size={28} className="relative transition-transform group-hover:scale-125 group-hover:rotate-12" />
          </button>
        )}

        {/* La sortie vaut pour tout l'écran d'avant-match, pas seulement quand
            les feuilles bloquent : tant que le direct n'a pas commencé, on peut
            très bien être venu voir et vouloir repartir. Cet écran occupe la
            hauteur entière, il ne laissait que la touche retour du navigateur. */}
        <button
          onClick={() => router.push(`/matches/${id}`)}
          className="mt-8 inline-flex items-center gap-2 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-gray-400 transition-colors hover:text-gray-900"
        >
          <ChevronLeft size={16} /> Retour au match
        </button>
      </div>
    );
  }

  /**
   * La grille d'un camp, ses DEUX origines réunies.
   *
   * Les joueurs qui ont un compte viennent des participations confirmées ; ceux
   * qui n'en ont pas viennent de la feuille dénormalisée sur le match. On
   * additionne au lieu de choisir : un adversaire hors plateforme n'a que la
   * seconde, mais une vraie équipe a souvent les deux — et ses joueurs sans
   * compte n'apparaissaient nulle part dans la console, donc aucun de leurs
   * buts n'était attribuable.
   */
  const playersOf = (teamId: string, ghostEntries: typeof match.homeGhostLineup): ConsolePlayer[] => [
    ...participations
      .filter((p) => p.teamId === teamId && p.status === "confirmed")
      .map((p) => ({
        playerId: p.playerId, playerName: p.playerName,
        squadNumber: p.squadNumber, isStarter: p.matchRole === "starter",
      })),
    ...ghostEntries.map((e) => ({
      playerId: e.playerId, playerName: e.name,
      squadNumber: e.number, isStarter: e.role === "starter",
    })),
  ];

  /** Le camp hors plateforme : ses joueurs sont anonymes, son club ne l'est pas. */
  const estAmical = !match.awayManagerId;
  const idEquipeFantome = !estAmical ? null : match.isHome ? match.awayTeamId : match.homeTeamId;

  const homePlayers = playersOf(match.homeTeamId, match.homeGhostLineup);
  const awayPlayers = playersOf(match.awayTeamId, match.awayGhostLineup);

  return (
    /* Mobile : une hauteur d'écran, pas une de plus. La console est un poste
       de commande qu'on tient d'une main pendant que le match se joue ; ce qui
       dépasse du pli n'existe pas.
       Les 10.5rem retirées sont mesurées, pas devinées : en-tête collant du
       shell 78px, marge haute du <main> 12px, marge basse 72px — celle-là même
       qui réserve la place de la barre de navigation (55px). Sous-estimer ce
       retrait glisse le déroulé du match SOUS la barre du bas, hors d'atteinte
       au moment où on en a le plus besoin. */
    <div className="mx-auto flex h-[calc(100dvh-10.5rem)] max-w-6xl flex-col gap-2 overflow-hidden md:block md:h-auto md:space-y-8 md:overflow-visible md:pb-32">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-1 md:px-4">
        <button
          onClick={() => router.back()}
          className="group flex h-9 w-9 shrink-0 items-center justify-center bg-white shadow-gray-200/50 transition-all hover:scale-110 active:scale-90 md:h-12 md:w-12"
        >
          <ChevronLeft size={20} className="text-gray-400 group-hover:text-gray-900 md:h-6 md:w-6" />
        </button>
        <div className="min-w-0 text-center">
          <div className="flex items-center justify-center gap-2 md:mb-1">
             <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 md:text-[10px]">Match en Direct</span>
          </div>
          <h1 className="truncate text-sm font-black text-gray-900 font-display tracking-tight md:text-2xl">
            {match.homeTeamName} <span className="mx-1 text-gray-300 md:mx-2">vs</span> {match.awayTeamName}
          </h1>
        </div>
        <button className="flex h-9 w-9 shrink-0 items-center justify-center bg-white shadow-gray-200/50 text-gray-400 transition-all hover:text-gray-900 md:h-12 md:w-12">
          <Settings2 size={18} className="md:h-[22px] md:w-[22px]" />
        </button>
      </div>

      {/* Main Scoreboard & Timer */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative shrink-0 overflow-hidden bg-[#0A0A0B] p-3 text-white md:p-10"
      >
        {/* Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-full bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.3),transparent)] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="relative z-10 grid grid-cols-3 items-center">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-1.5 md:gap-6">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-white/10 rounded-full" />
              <div className="relative flex h-10 w-10 items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-base font-black border border-white/10 shadow-2xl backdrop-blur-md md:h-24 md:w-24 md:text-4xl">
                {match.homeTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="max-w-[80px] truncate text-[9px] font-black uppercase tracking-tight text-white/50 md:mb-1 md:max-w-[120px] md:text-sm">{match.homeTeamName}</h2>
              <div className="text-4xl font-black tracking-tighter drop-shadow-2xl md:text-8xl">{match.scoreHome || 0}</div>
            </div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center">
            <div className="mb-1.5 rounded-full border border-white/5 bg-white/10 px-2.5 py-0.5 text-center text-[8px] font-black uppercase leading-tight tracking-[0.15em] text-emerald-400 backdrop-blur-xl md:mb-6 md:px-6 md:py-2 md:text-[11px] md:tracking-[0.2em]">
              {PERIODS.find(p => p.id === match.liveState?.currentPeriod)?.label || "Match"}
            </div>
            <div className="relative flex flex-col items-center">
               <div className="absolute -inset-10 blur-3xl bg-emerald-500/10 rounded-full" />
               <div className="relative font-mono text-2xl font-black leading-none tracking-tighter text-emerald-500 tabular-nums md:text-[5.5rem]">
                 {formatTime(displayTime)}
               </div>
            </div>
            <div className="mt-2 flex gap-6 md:mt-10">
              {match.liveState?.isTimerRunning ? (
                <button
                  onClick={handlePauseTimer}
                  className="group relative flex h-11 w-11 items-center justify-center bg-amber-500 text-white transition-all hover:bg-amber-600 hover:scale-110 active:scale-95 md:h-20 md:w-20"
                >
                  <Pause size={20} fill="currentColor" className="md:h-8 md:w-8" />
                </button>
              ) : (
                <button
                  onClick={handleStartTimer}
                  className="group relative flex h-11 w-11 items-center justify-center bg-emerald-500 text-white transition-all hover:bg-emerald-600 hover:scale-110 active:scale-95 md:h-20 md:w-20"
                >
                  <Play size={20} fill="currentColor" className="ml-0.5 md:ml-1 md:h-8 md:w-8" />
                </button>
              )}
            </div>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-1.5 md:gap-6">
            <div className="relative">
              <div className="absolute inset-0 blur-xl bg-white/10 rounded-full" />
              <div className="relative flex h-10 w-10 items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-base font-black border border-white/10 shadow-2xl backdrop-blur-md md:h-24 md:w-24 md:text-4xl">
                {match.awayTeamName[0]}
              </div>
            </div>
            <div className="text-center">
              <h2 className="max-w-[80px] truncate text-[9px] font-black uppercase tracking-tight text-white/50 md:mb-1 md:max-w-[120px] md:text-sm">{match.awayTeamName}</h2>
              <div className="text-4xl font-black tracking-tighter drop-shadow-2xl md:text-8xl">{match.scoreAway || 0}</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Match Lock Banner */}
      {match.status === 'live' && (
        <div className="flex shrink-0 items-center justify-between bg-amber-500 p-1.5 text-white shadow-amber-500/20 md:mx-0 md:p-4">
           <div className="flex min-w-0 items-center gap-2 md:gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center bg-white/20 md:h-10 md:w-10">
                 <Shield size={13} className="md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                 <p className="text-[8px] font-black uppercase tracking-widest text-white/70 md:text-[10px]">Session Arbitrage Active</p>
                 {/* Le rappel complet ne tient pas sur un téléphone sans manger
                     la place des grilles : le titre dit déjà l'essentiel. */}
                 <p className="hidden text-xs font-bold font-display italic md:block">Veuillez ne pas quitter cette page avant le coup de sifflet final</p>
              </div>
           </div>
           {/* Le compte à rebours du bouton BUT, à l'écran.
               Il ne vivait que dans la fiche d'un joueur : on tapait, rien ne
               se passait, et il fallait deviner pourquoi. La pastille qui
               occupait cette place annonçait « Contrôles verrouillés » en
               permanence, alors que rien ne l'était jamais. */}
           {goalCooldown > 0 && (
             <div className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest md:px-4 md:py-1.5 md:text-[10px]">
               But dans {goalCooldown}s
             </div>
           )}
        </div>
      )}

      {/* Sélecteur de panneau, mobile seulement. Les flèches font défiler les
          trois panneaux dans l'ordre : on change de camp d'un pouce, sans viser
          un onglet de six millimètres pendant qu'une action se joue. */}
      <div className="flex shrink-0 items-stretch gap-1 md:hidden">
        {(() => {
          const PANNEAUX = [
            { id: "home" as const, label: match.homeTeamName },
            { id: "away" as const, label: match.awayTeamName },
            { id: "events" as const, label: "Événements" },
          ];
          const index = PANNEAUX.findIndex((x) => x.id === panneau);
          const glisser = (pas: number) =>
            setPanneau(PANNEAUX[(index + pas + PANNEAUX.length) % PANNEAUX.length].id);
          return (
            <>
              <button
                onClick={() => glisser(-1)}
                aria-label="Panneau précédent"
                className="flex w-9 shrink-0 items-center justify-center border border-gray-200/70 bg-white text-gray-400 active:bg-gray-100"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="flex min-w-0 flex-1 gap-1">
                {PANNEAUX.map((x) => (
                  <button
                    key={x.id}
                    onClick={() => setPanneau(x.id)}
                    className={`min-w-0 flex-1 truncate px-1 py-2 text-[9px] font-black uppercase tracking-wider transition-colors ${
                      panneau === x.id
                        ? "bg-gray-900 text-white"
                        : "border border-gray-200/70 bg-white text-gray-400"
                    }`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => glisser(1)}
                aria-label="Panneau suivant"
                className="flex w-9 shrink-0 items-center justify-center border border-gray-200/70 bg-white text-gray-400 active:bg-gray-100"
              >
                <ChevronRight size={16} />
              </button>
            </>
          );
        })()}
      </div>

      {/* Control Panel: 2 Grids. `contents` sur mobile : les deux grilles
          deviennent des enfants directs de la colonne, chacune pilotée par le
          sélecteur ci-dessus. Au-delà de `md`, la grille à deux colonnes
          d'origine reprend. */}
      <div className="contents md:grid md:gap-6 md:grid-cols-2 md:px-0">
        {/* Home Team Grid */}
        <div className={`relative border border-gray-200/70 bg-white p-3 shadow-2xl shadow-gray-200/40 group md:block md:overflow-hidden md:p-8 ${
          panneau === "home" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full opacity-50 bg-emerald-100" />
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between md:mb-8">
               <div className="flex min-w-0 flex-col">
                 <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-600 md:mb-1 md:text-[10px]">Dominateurs (Grille)</h3>
                 <h2 className="max-w-[200px] truncate text-sm font-black tracking-tighter text-gray-900 md:text-xl">{match.homeTeamName}</h2>
               </div>
               <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-emerald-50 font-black text-emerald-600 md:h-12 md:w-12">
                 {match.scoreHome || 0}
               </div>
            </div>

            <div className="grid grid-cols-5 gap-2 md:gap-3">
              {homePlayers.map(p => (
                <button
                  key={p.playerId}
                  onClick={() => setSelectedPlayer({ player: p, teamId: match.homeTeamId, teamName: match.homeTeamName })}
                  className="group relative flex h-14 flex-col items-center justify-center gap-0.5 overflow-hidden border-2 border-gray-200/70 bg-gray-50/50 px-0.5 text-sm font-black transition-all hover:border-emerald-500 hover:bg-white hover:text-emerald-600 hover:scale-105 active:scale-95 md:h-[4.5rem]"
                >
                  <span className="text-base leading-none md:text-xl">{p.squadNumber || p.playerName[0].toUpperCase()}</span>
                  {/* Le nom était une infobulle en position absolue sous la
                      case. Sur un téléphone il n'y a pas de survol, donc pas de
                      nom du tout ; et quand elles s'affichaient, chacune était
                      plus large que sa case et débordait sur les voisines. Il
                      est dans la case, comme sur un maillot. */}
                  {nomDeMaillot(p.playerName, p.squadNumber) && (
                    <span className="w-full truncate text-center text-[8px] font-bold uppercase leading-none tracking-tight text-gray-400 md:text-[10px]">
                      {nomDeMaillot(p.playerName, p.squadNumber)}
                    </span>
                  )}
                  {p.isStarter && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowSubModal({ teamId: match.homeTeamId, teamName: match.homeTeamName })}
                className="flex h-14 flex-col items-center justify-center gap-1 border border-dashed border-gray-200/70 text-gray-400 md:h-[4.5rem] hover:border-emerald-500 hover:text-emerald-500 transition-all"
              >
                <Plus size={16} />
                <span className="text-[8px] font-black uppercase">Sub</span>
              </button>
            </div>
          </div>
        </div>

        {/* Away Team Grid */}
        <div className={`relative border border-gray-200/70 bg-white p-3 shadow-2xl shadow-gray-200/40 group md:block md:overflow-hidden md:p-8 ${
          panneau === "away" ? "min-h-0 flex-1 overflow-y-auto" : "hidden"
        }`}>
          <div className="absolute top-0 right-0 w-32 h-32 blur-[80px] rounded-full opacity-50 bg-blue-100" />
          <div className="relative z-10">
            <div className="mb-3 flex items-center justify-between md:mb-8">
               <div className="flex min-w-0 flex-col">
                 <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-600 md:mb-1 md:text-[10px]">Visiteurs (Grille)</h3>
                 <h2 className="max-w-[200px] truncate text-sm font-black tracking-tighter text-gray-900 md:text-xl">{match.awayTeamName}</h2>
               </div>
               <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-blue-50 font-black text-blue-600 md:h-12 md:w-12">
                 {match.scoreAway || 0}
               </div>
            </div>

            <div className="grid grid-cols-5 gap-2 md:gap-3">
              {awayPlayers.map(p => (
                <button
                  key={p.playerId}
                  onClick={() => setSelectedPlayer({ player: p, teamId: match.awayTeamId, teamName: match.awayTeamName })}
                  className="group relative flex h-14 flex-col items-center justify-center gap-0.5 overflow-hidden border-2 border-gray-200/70 bg-gray-50/50 px-0.5 text-sm font-black transition-all hover:border-blue-600 hover:bg-white hover:text-blue-600 hover:scale-105 active:scale-95 md:h-[4.5rem]"
                >
                  <span className="text-base leading-none md:text-xl">{p.squadNumber || p.playerName[0].toUpperCase()}</span>
                  {/* Le nom était une infobulle en position absolue sous la
                      case. Sur un téléphone il n'y a pas de survol, donc pas de
                      nom du tout ; et quand elles s'affichaient, chacune était
                      plus large que sa case et débordait sur les voisines. Il
                      est dans la case, comme sur un maillot. */}
                  {nomDeMaillot(p.playerName, p.squadNumber) && (
                    <span className="w-full truncate text-center text-[8px] font-bold uppercase leading-none tracking-tight text-gray-400 md:text-[10px]">
                      {nomDeMaillot(p.playerName, p.squadNumber)}
                    </span>
                  )}
                  {p.isStarter && (
                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full border-2 border-white bg-blue-600" />
                  )}
                </button>
              ))}
              <button
                onClick={() => setShowSubModal({ teamId: match.awayTeamId, teamName: match.awayTeamName })}
                className="flex h-14 flex-col items-center justify-center gap-1 border border-dashed border-gray-200/70 text-gray-400 md:h-[4.5rem] hover:border-blue-600 hover:text-blue-600 transition-all"
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
              className="relative w-full max-w-sm bg-white p-10 shadow-3xl text-center"
            >
              <div className="mb-8">
                 <div className="mx-auto h-20 w-20 bg-gray-900 text-white flex items-center justify-center text-3xl font-black mb-4">
                   {selectedPlayer.player.squadNumber || selectedPlayer.player.playerName[0].toUpperCase()}
                 </div>
                 <h2 className="text-2xl font-black text-gray-900 leading-tight">{selectedPlayer.player.playerName}</h2>
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1 italic">{selectedPlayer.teamName}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <EventButton
                    label={goalCooldown > 0 ? `${goalCooldown}s` : "BUT !"}
                    icon={<Trophy size={20} />}
                    color="amber"
                    disabled={goalCooldown > 0}
                    onClick={() => {
                        handleAddEvent("goal", selectedPlayer.teamId, selectedPlayer.player.playerId, selectedPlayer.player.playerName);
                        setGoalCooldown(60);
                        setSelectedPlayer(null);
                    }}
                  />
                  <EventButton
                    label="JAUNE"
                    icon={<div className="h-6 w-4 bg-amber-400 border border-amber-500/20" />}
                    color="gray"
                    onClick={() => {
                        handleAddEvent("yellow_card", selectedPlayer.teamId, selectedPlayer.player.playerId, selectedPlayer.player.playerName);
                        setSelectedPlayer(null);
                    }}
                  />
                  <EventButton
                    label="ROUGE"
                    icon={<div className="h-6 w-4 bg-red-600 border border-red-700/20 shadow-inner" />}
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

      {/* Timeline & Flow Control. `contents` sur mobile, pour la même raison
          que les grilles : le déroulé se colle en bas de l'écran et reste
          atteignable quel que soit le panneau ouvert, les événements deviennent
          l'un des panneaux. */}
      <div className="contents md:grid md:gap-8 md:grid-cols-3 md:px-2">
        {/* Timeline */}
        <div className={`border border-gray-200/70 bg-white p-3 shadow-2xl shadow-gray-200/50 md:order-2 md:col-span-2 md:block md:p-8 ${
          panneau === "events" ? "flex min-h-0 flex-1 flex-col" : "hidden"
        }`}>
          <div className="mb-3 flex items-center justify-between md:mb-8">
            <div className="flex items-center gap-2 md:gap-3">
              <History className="text-gray-400" size={16} />
              <h3 className="text-xs font-black uppercase tracking-tight text-gray-900 italic md:text-sm">Événements</h3>
            </div>
            <div className="rounded-full bg-gray-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-gray-400 md:px-3 md:py-1 md:text-[10px]">
              {match.liveState?.events?.length || 0} Total
            </div>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 md:max-h-[350px] md:space-y-4 md:pr-4">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event, i) => (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={event.id}
                  className="flex items-center gap-6 group"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center bg-gray-50 text-xs font-black border border-gray-200/70 transition-colors group-hover:bg-emerald-50/50 group-hover:border-emerald-100 group-hover:text-emerald-600">
                    {event.minute}&apos;
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                       {event.type === "goal" && <Trophy size={16} className="text-amber-500" />}
                       {event.type === "yellow_card" && <div className="h-5 w-3.5 bg-amber-400 border border-amber-500/20" />}
                       {event.type === "red_card" && <div className="h-5 w-3.5 bg-red-600 border border-red-700/20" />}
                       {event.type === "substitution" && <ArrowRightLeft size={16} className="text-blue-500" />}
                       <span className="text-sm font-black text-gray-900 uppercase tracking-tight">
                         {event.type === "goal" ? "BUT !" : event.type === "yellow_card" ? "Carton Jaune" : event.type === "red_card" ? "Carton Rouge" : "Changement"}
                       </span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-gray-400 uppercase tracking-tighter">
                      {event.detail ? (
                        <span className="text-blue-600">{event.detail}</span>
                      ) : event.teamId === idEquipeFantome ? (
                        /* « Joueur 9 • FC BALL » : le nom générique de
                           l'adversaire hors plateforme n'apporte rien à côté du
                           nom de son club. Voir la fiche du match. */
                        <span>{event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName}</span>
                      ) : (
                        <span>{event.playerName || "Joueur Inconnu"} • {event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName}</span>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center md:py-16">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 md:mb-4 md:h-16 md:w-16">
                   <History size={22} className="text-gray-200 md:h-8 md:w-8" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-300 italic md:text-sm">Le match attend ses premiers coups d&apos;éclat</p>
              </div>
            )}
          </div>
        </div>

        {/* Flow Control. Toujours visible sur mobile, sous les panneaux : c'est
            le geste qu'on ne doit jamais avoir à chercher, et il ne dépend
            d'aucun camp. */}
        <div className="shrink-0 border border-gray-200/70 bg-white p-2 shadow-2xl shadow-gray-200/50 backdrop-blur-sm md:order-1 md:p-8">
           <div className="mb-6 hidden items-center gap-3 md:flex">
              <Clock className="text-gray-400" size={20} />
              <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Match Workflow</h3>
           </div>
           <div className="flex gap-2 md:block md:space-y-4">
              <button
                disabled={match.liveState?.currentPeriod === 4}
                onClick={handleNextPeriod}
                className="group flex flex-1 items-center justify-center gap-1.5 bg-gray-900 px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-white transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50 md:w-full md:justify-between md:px-6 md:py-5 md:text-sm md:normal-case md:tracking-normal"
              >
                <span className="md:hidden">Période suivante</span>
                <span className="hidden md:inline">Passer à la période suivante</span>
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1 md:h-[18px] md:w-[18px]" />
              </button>
              <button
                 onClick={handleFinishMatch}
                 className="flex flex-1 items-center justify-center gap-1.5 border-2 border-red-50 bg-red-50/50 px-2 py-3 text-[10px] font-bold uppercase tracking-wider text-red-600 transition-all hover:bg-red-50 active:scale-[0.98] md:w-full md:justify-between md:px-6 md:py-5 md:text-sm md:normal-case md:tracking-normal"
              >
                <span className="md:hidden">Fin du match</span>
                <span className="hidden md:inline">Siffler la fin du match</span>
                <CheckCircle2 size={16} className="md:h-5 md:w-5" />
              </button>
           </div>
        </div>
      </div>

      {/* Substitution Modal */}
      <AnimatePresence>
        {showSubModal && (
          <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
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
              className="relative w-full max-w-md bg-white p-10 shadow-2xl"
            >
              <h2 className="mb-2 text-2xl font-black text-gray-900">Nouveau changement</h2>
              <p className="mb-8 text-sm font-bold text-gray-400 italic uppercase tracking-tight">{showSubModal.teamName}</p>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-red-500">Joueur Sortant</label>
                  <select
                    value={subOutPlayer}
                    onChange={(e) => setSubOutPlayer(e.target.value)}
                    className="w-full border-2 border-gray-200/70 bg-gray-50 p-4 text-sm font-bold outline-none focus:border-red-500 transition-colors"
                  >
                    <option value="">Sélectionner...</option>
                    {(showSubModal.teamId === match.homeTeamId ? homePlayers : awayPlayers).map(p => (
                      <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-center">
                   <div className="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center text-white">
                      <ArrowRightLeft size={24} />
                   </div>
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">Joueur Entrant</label>
                  <select
                    value={subInPlayer}
                    onChange={(e) => setSubInPlayer(e.target.value)}
                    className="w-full border-2 border-gray-200/70 bg-gray-50 p-4 text-sm font-bold outline-none focus:border-emerald-500 transition-colors"
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
                  className="mt-4 w-full bg-gray-900 py-5 text-sm font-black uppercase tracking-widest text-white transition-all hover:bg-black active:scale-95 disabled:opacity-50"
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

function EventButton({ label, icon, color, onClick, disabled }: { label: string; icon: any; color: string; onClick: () => void; disabled?: boolean }) {
  const colorBgs: Record<string, string> = {
    amber: "bg-amber-500 text-white shadow-amber-500/20",
    red: "bg-red-600 text-white shadow-red-600/20",
    gray: "bg-gray-100 text-gray-900 shadow-gray-200/50",
    light: "bg-gray-50 text-gray-400"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center justify-center gap-2 p-6 transition-all hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 ${colorBgs[color] || colorBgs.gray}`}
    >
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}
