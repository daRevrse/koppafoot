"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ChevronLeft, History,
  CheckCircle2, Loader2, Flame, Trophy, Shield, Goal,
  ArrowRightLeft, AlertTriangle, X, LogOut, GraduationCap,
  MonitorPlay, Ban, Check, Hand, Flag, BarChart3, Info, Target,
  ClipboardList,
} from "lucide-react";
import toast from "react-hot-toast";
import { classerCandidatsMVP, type CandidatMVP } from "@/lib/mvp";
import { useConfirmation } from "@/components/ui/socle";
import { couleursDuMaillot, type CouleursEquipe } from "@/lib/couleurs-equipe";
import { useAuth } from "@/contexts/AuthContext";
import type { PiloteConsole } from "@/lib/console-pilote";
import { normaliserPoste } from "@/lib/postes";
import { gardienDe } from "@/lib/terrain";
import {
  EMOJI_EVENEMENT, EVENEMENTS_EQUIPE, ISSUES_PENALTY, LIBELLE_EVENEMENT,
  LIBELLE_ISSUE_PENALTY, PENALTY_GOAL_DETAIL, RECIT_ISSUE_PENALTY,
  demandeUneVictime, estStatistique, issuePenalty, penaltyDitParSonBut,
  penaltyEnAttente, type IssuePenalty, type TypeEvenementEquipe,
  type TypeEvenementJoueur,
} from "@/lib/evenements";
import {
  POSSESSION_VIDE, basculer, partPossession, reprendre, suspendre, versStockage,
  type Possession,
} from "@/lib/possession";
import { notesDuCamp, type NoteJoueur } from "@/lib/notes";
import { lignesStats } from "@/lib/stats-match";
import MatchStats from "@/components/match/MatchStats";
import TerrainsFaceAFace, { ModaleActionsJoueur, type ActionJoueur } from "@/components/competition/TerrainConsole";
import ConsoleCouchee from "@/components/competition/ConsoleCouchee";
import type { CompMatch, CompPlayer, LineupEntry, Competition, GoalVarStatus } from "@/types";

/** One entry of the live feed. */
type LiveEvent = NonNullable<CompMatch["liveState"]>["events"][number];

// Football rule constants. Le nombre de titulaires et la durée des mi-temps
// viennent du format de la compétition (NvN, durée), voir plus bas.

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

/**
 * Ce qui n'appartient a personne : corner, coup franc, touche, penalty.
 *
 * Il porte sur le camp REGARDE, celui dont le terrain est affiche — pas de
 * selecteur a lui. Un selecteur de plus obligerait a choisir deux fois pour un
 * corner, alors que le scoreur vient justement de basculer sur le camp qui
 * attaque.
 */
/**
 * Les quatre actions qui n'appartiennent a personne, pour UN camp.
 *
 * ELLE A PERDU SON EN-TETE « Pour <equipe> ». Il existait parce que la barre
 * servait le camp affiche par l'onglet, et qu'il fallait donc dire lequel.
 * Couchee, la console en rend une PAR CAMP, sous le nom de son equipe : le
 * repeter serait l'ecrire deux fois a trente pixels d'intervalle.
 *
 * Ce que l'en-tete portait aussi, et qu'on garde : la raison du verrou apres
 * un but. Elle passe sur les boutons eux-memes, qui sont ce qu'elle concerne.
 */
function BandeauEquipe({
  isSubmitting, desactive, onEvenement,
}: {
  isSubmitting: boolean;
  /** La raison du verrou, ou `null`. Voir `SECONDES_JEU_MORT`. */
  desactive: string | null;
  onEvenement: (type: TypeEvenementEquipe) => void;
}) {
  return (
    <div className="relative grid grid-cols-4 border-b border-white/10">
      {EVENEMENTS_EQUIPE.map((type) => (
        <button
          key={type}
          type="button"
          // Les quatre sont des actions de jeu : après un but, aucune ne peut
          // se produire tant que le ballon n'est pas revenu au rond central.
          disabled={isSubmitting || !!desactive}
          onClick={() => onEvenement(type)}
          className="flex min-h-[30px] items-center justify-center gap-1 border-r border-white/[0.07] px-1 py-1 text-white/70 transition-colors last:border-r-0 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30"
        >
          <span aria-hidden className="shrink-0 text-[11px] leading-none">{EMOJI_EVENEMENT[type]}</span>
          <span className="min-w-0 truncate text-[8px] font-black uppercase tracking-tight">
            {/* « Penalty obtenu » ne tient pas dans un quart d'ecran. */}
            {type === "penalty" ? "Penalty" : LIBELLE_EVENEMENT[type]}
          </span>
        </button>
      ))}
      {desactive && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b1512]/75 text-[9px] font-black uppercase tracking-wider text-amber-400">
          {desactive}
        </span>
      )}
    </div>
  );
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
  // « Revoir les feuilles » : quand les deux camps ont validé, l'étape est
  // franchie et la console va au coup d'envoi. Ce drapeau la rouvre à la
  // demande, pour une dernière retouche.
  const [revoirLesFeuilles, setRevoirLesFeuilles] = useState(false);

  /**
   * La possession de balle, tenue ICI et non dans le match.
   *
   * La console est le seul ecrivain : un match n'a qu'un scoreur. L'etat local
   * fait donc autorite tant qu'elle est ouverte, et l'abonnement ne le reseme
   * qu'une fois — au premier match recu. Sans cette regle, chaque ecriture
   * reviendrait par l'abonnement et ecraserait la bascule suivante, qui a eu
   * lieu entre-temps.
   */
  /**
   * Le tiroir « Plus d'infos » : les compteurs et l'historique.
   *
   * FERMÉ PAR DÉFAUT, et c'est le point. Ni l'un ni l'autre ne sert à SAISIR :
   * on les consulte entre deux actions, ou après le match. Ouverts en
   * permanence, ils ajoutaient sept cent cinquante pixels sous le terrain —
   * la console entière faisait alors plus de deux écrans de haut pour un
   * scoreur qui n'en regarde qu'un.
   */
  const [plusDInfos, setPlusDInfos] = useState(false);

  const [possession, setPossession] = useState<Possession>(POSSESSION_VIDE);
  const possessionRef = useRef<Possession | null>(null);
  const flushRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Plus de « camp regarde » : les deux terrains sont a l'ecran en meme temps,
  // et le camp d'une saisie est celui du joueur qu'on touche. Voir
  // TerrainsFaceAFace.
  const [actions, setActions] = useState<ActionsState | null>(null);
  const [victime, setVictime] = useState<VictimeState | null>(null);
  // Second question, asked only after a goal: who laid it on. Optional by
  // design, the scoreboard is already right, this only enriches it.
  const [assistPicker, setAssistPicker] = useState<AssistPickerState | null>(null);

  // Substitution modal
  /**
   * Le remplacement en cours : le camp, et CELUI DES DEUX JOUEURS QU'ON
   * CONNAIT DEJA. On arrive toujours ici en touchant quelqu'un — le sortant
   * sur le terrain, ou l'entrant sur le banc — donc la moitie de la reponse
   * est acquise avant que la question ne se pose.
   */
  /**
   * LA CONFIRMATION DU PRODUIT, ET NON CELLE DU NAVIGATEUR.
   *
   * `window.confirm` gardait le coup de sifflet final. Elle avait deja les
   * defauts que socle lui reproche partout ailleurs — une boite grise hors du
   * produit, en anglais sur certains systemes, qui ne distingue pas le geste
   * dangereux du retour et qu'aucun theme ne touche.
   *
   * Couchee, elle en gagne un dernier, redhibitoire : une boite native
   * s'affiche dans le repere de L'APPAREIL, que le CSS n'atteint pas. Elle
   * serait donc apparue DE TRAVERS, au moment precis ou l'on met fin a un
   * match — le geste le plus definitif de la console.
   */
  const { demander, Dialogue } = useConfirmation();

  /**
   * Ce que les deux equipes portent.
   *
   * Charge une fois, comme les effectifs : une couleur de maillot ne change
   * pas en cours de match. Voir `PiloteConsole.couleurs`, qui sait ou la
   * chercher selon qu'on couvre une competition ou un amical.
   */
  const [couleurs, setCouleurs] = useState<{ home: CouleursEquipe; away: CouleursEquipe } | null>(null);

  const [subModal, setSubModal] = useState<
    { side: Side; teamName: string; sort: string } | { side: Side; teamName: string; entre: string } | null
  >(null);

  // Penalty shootout entry (knockout draw)
  // Non nul = la modale de l'homme du match est ouverte, et elle retient les
  // tirs au but déjà saisis : le coup de sifflet part quand elle se referme.
  const [mvpEnAttente, setMvpEnAttente] = useState<{ tab?: { penaltyHome: number; penaltyAway: number } } | null>(null);
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
  const {
    titulairesMax: startersMax, dureeMiTempsMin: halfMinutes,
    remplacementsMax, retourAutorise,
  } = pilote.regles(competition, match);
  const halfMs = halfMinutes * 60_000;
  const fullMs = halfMs * 2;

  /**
   * Le verrou qui suit un but.
   *
   * IL NE PORTAIT QUE SUR LE BUT. Un but tapé deux fois est un score faux, et
   * le corriger demande une intervention d'organisateur : d'ou soixante
   * secondes de verrou sur ce bouton-la. Mais le raisonnement vaut pour le
   * reste, et pour une raison plus simple encore — APRES UN BUT, LE JEU EST
   * MORT. Celebration, retour au rond central, coup d'envoi : pendant ce
   * temps-la il ne peut y avoir ni tir, ni corner, ni touche, ni hors-jeu. Ce
   * qui s'y saisit est un appui en trop, jamais une action.
   *
   * DEUX DUREES, PARCE QUE LES DEUX RISQUES SONT DIFFERENTS. Le but garde ses
   * soixante secondes : son cout est un score faux. Les actions de jeu n'en
   * ont que quinze, le temps de la celebration — au-dela le jeu a repris pour
   * de bon, et continuer a les bloquer ferait perdre de vraies frappes.
   *
   * LE CARTON ET LE REMPLACEMENT NE SONT PAS VERROUILLES. Ce sont justement
   * les deux choses qui arrivent pendant un arret de jeu : un carton pour une
   * celebration, un changement dans la foulee du but.
   */
  const SECONDES_APRES_BUT = 60;
  const SECONDES_JEU_MORT = 15;
  const [goalCooldown, setGoalCooldown] = useState(0);
  useEffect(() => {
    if (goalCooldown <= 0) return;
    const t = setTimeout(() => setGoalCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [goalCooldown]);

  // Un seul decompte pour les deux durees : le jeu est mort pendant les quinze
  // premieres secondes des soixante. Un second minuteur aurait double l'effet
  // et l'etat pour la meme information.
  const secondesJeuMort = Math.max(0, goalCooldown - (SECONDES_APRES_BUT - SECONDES_JEU_MORT));
  const jeuMort = secondesJeuMort > 0;
  const apresBut = jeuMort ? `Jeu arrêté (${secondesJeuMort}s)` : null;

  // Load both rosters once, before kickoff, for the match-sheet builder. Drafts
  // are seeded from any previously-saved lineup so re-validation overwrites cleanly.
  const isPreKickoff = !!match && match.status !== "live" && match.status !== "completed";
  const homeTeamId = match?.homeTeamId ?? null;
  const awayTeamId = match?.awayTeamId ?? null;

  const idsDesEquipes = `${match?.homeTeamId ?? ""}|${match?.awayTeamId ?? ""}`;
  useEffect(() => {
    if (!match) return;
    let annule = false;
    (async () => {
      try {
        const { home, away } = await pilote.couleurs(match);
        if (annule) return;
        setCouleurs({ home: couleursDuMaillot(home), away: couleursDuMaillot(away) });
      } catch {
        // Le terrain garde le blanc : une couleur manquante ne doit pas
        // empecher de couvrir un match.
      }
    })();
    return () => {
      annule = true;
    };
    // `match` entier changerait a chaque battement du chrono ; seuls les deux
    // identifiants decident d'ou vient la couleur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pilote, idsDesEquipes]);

  /**
   * LA COMPOSITION TYPE DE CHAQUE CLUB, quand il en a préparé une.
   *
   * Elle sert à deux choses ici, et c'est la même idée des deux côtés : que le
   * scoreur n'arrive jamais devant une feuille vide.
   *
   *  — Elle COMPLÈTE L'EFFECTIF. Sur un amical, la console ne propose que les
   *    joueurs qui ont confirmé leur venue : un dimanche où personne n'a
   *    répondu, la liste est vide et il n'y a littéralement rien à cocher,
   *    donc rien à valider, donc pas de coup d'envoi. Les joueurs de la
   *    composition type y entrent, parce que le manager a déjà dit que ce sont
   *    les siens.
   *
   *  — Elle PRÉ-COCHE LA FEUILLE, titulaires et remplaçants, quand le camp n'a
   *    aucune feuille enregistrée. Le scoreur valide en un geste, ou corrige —
   *    il ne part plus de rien.
   *
   * Elle ne touche JAMAIS à une feuille déjà faite : celle qu'un manager a
   * validée depuis la fiche du match est la vraie, et elle décrit ce
   * dimanche-là, ce que la composition type ne fait pas.
   */
  const [compoTypes, setCompoTypes] = useState<{
    home: LineupEntry[] | null;
    away: LineupEntry[] | null;
  }>({ home: null, away: null });

  useEffect(() => {
    if (!isPreKickoff || !match) return;
    let cancelled = false;
    setRostersLoading(true);
    (async () => {
      try {
        const [{ home, away }, compos] = await Promise.all([
          pilote.effectifs(match),
          // Jamais bloquant : le pilote avale ses propres erreurs et rend deux
          // `null`, la console se comporte alors comme avant.
          pilote.compositionsTypes(match, startersMax),
        ]);
        if (cancelled) return;
        setCompoTypes(compos);
        setHomeRoster(fusionnerCompoAuRoster(home, compos.home));
        setAwayRoster(fusionnerCompoAuRoster(away, compos.away));
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
  }, [isPreKickoff, pilote, homeTeamId, awayTeamId, startersMax]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed each draft from the saved lineup whenever the match's lineup changes.
  // À DÉFAUT DE FEUILLE ENREGISTRÉE, la composition type du club prend le
  // relais : c'est la seule différence avec avant, et elle ne joue que sur un
  // camp qui n'a rien.
  useEffect(() => {
    if (!match) return;
    setHomeSheet(seedSheet(match.homeLineup.length > 0 ? match.homeLineup : compoTypes.home ?? []));
  }, [match?.homeLineup, compoTypes.home]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!match) return;
    setAwaySheet(seedSheet(match.awayLineup.length > 0 ? match.awayLineup : compoTypes.away ?? []));
  }, [match?.awayLineup, compoTypes.away]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ---- Le temps additionnel, et la fin de la periode ------------------------
  //
  // IL NE SE DEDUIT DE RIEN. Le chrono de la console monte en continu : il ne
  // sait pas ce qui s'est arrete pendant le jeu — une blessure, une
  // celebration, un changement. Seul l'arbitre l'annonce, et le scoreur le
  // recopie. C'est pour ca que c'est une saisie et non un calcul.

  /** Les minutes annoncees pour chacune des deux mi-temps. */
  const additionnel = match?.liveState?.addedTime ?? null;
  const minutesAdditionnelles = {
    first: additionnel?.first ?? 0,
    second: additionnel?.second ?? 0,
  };

  /** La mi-temps que la periode en cours prolonge, `null` hors du jeu. */
  const mitempsEnCours: "first" | "second" | null =
    match?.liveState?.currentPeriod === 1 ? "first"
      : match?.liveState?.currentPeriod === 3 ? "second"
        : null;

  const minutesDeLaPeriode = mitempsEnCours ? minutesAdditionnelles[mitempsEnCours] : 0;

  /**
   * Ou l'horloge s'arrete toute seule, en millisecondes de chrono.
   *
   * La mi-temps reglementaire, PLUS le temps additionnel annonce. Sans
   * annonce, c'est la minute reglementaire tout court : une premiere periode
   * s'arrete a 45:00, une seconde a 90:00.
   *
   * `null` a la pause et apres le coup de sifflet final : il n'y a alors plus
   * de periode a terminer.
   */
  const cibleDeLaPeriode =
    mitempsEnCours === "first" ? halfMs + minutesAdditionnelles.first * 60_000
      : mitempsEnCours === "second" ? fullMs + minutesAdditionnelles.second * 60_000
        : null;

  /**
   * Poser le temps additionnel de la mi-temps en cours.
   *
   * Borne a zero et a quinze : au-dela ce n'est plus un temps additionnel mais
   * une faute de frappe, et l'horloge s'arreterait un quart d'heure trop tard.
   */
  const poserAdditionnel = async (delta: number) => {
    if (!mitempsEnCours) return;
    const suivant = Math.min(15, Math.max(0, minutesDeLaPeriode + delta));
    if (suivant === minutesDeLaPeriode) return;
    try {
      await pilote.poserTempsAdditionnel(mitempsEnCours, suivant);
    } catch {
      toast.error("Erreur technique");
    }
  };

  // Timer logic, copied verbatim from the referee console. The live_state
  // shapes are identical (timerStartAt / timerOffset / isTimerRunning), so the
  // server-clock computation works unchanged; only the pause writer is
  // retargeted to pauseCompTimer. The `match.status === "live"` guard is a
  // shipped bug fix (freeze the clock at full time), do NOT regress it.
  /** La cible deja servie par l'arret automatique. Voir la boucle ci-dessous. */
  const arretAutoRef = useRef<number | null>(null);

  useEffect(() => {
    if (!match?.liveState) return;

    const cible = cibleDeLaPeriode;
    const mitemps = mitempsEnCours;
    let interval: ReturnType<typeof setInterval>;

    if (match.status === "live" && match.liveState.isTimerRunning && match.liveState.timerStartAt) {
      const start = new Date(match.liveState.timerStartAt).getTime();
      const offset = match.liveState.timerOffset || 0;

      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - start + offset;
        setDisplayTime(elapsed);

        // L'ARRET AUTOMATIQUE EN FIN DE PERIODE.
        //
        // Il avait ete retire — « the operator now controls stoppage
        // manually » — et pour une bonne raison : il tombait a la minute
        // reglementaire, donc AVANT le temps additionnel, et coupait le match
        // en plein jeu. Le scoreur devait relancer a chaque fois.
        //
        // Il revient parce que la cible n'est plus la minute reglementaire
        // seule, mais elle PLUS le temps annonce par l'arbitre. Une periode
        // sans annonce s'arrete a 45:00 ; annoncez trois minutes, elle
        // s'arrete a 48:00.
        //
        // La garde retient la cible deja servie, pas un simple booleen : le
        // temps que l'arret fasse l'aller-retour par la base, la boucle passe
        // plusieurs fois ici. Et si le scoreur rallonge apres coup, la cible
        // change, donc la relance s'arretera bien a la nouvelle.
        if (cible !== null && elapsed >= cible && arretAutoRef.current !== cible) {
          arretAutoRef.current = cible;
          void pilote.pauserChrono(cible).then(() => {
            toast(mitemps === "first" ? "Fin de la 1re mi-temps" : "Fin du temps réglementaire", { icon: "⏱️" });
          }).catch(() => {});
        }
      }, 100);
    } else {
      setDisplayTime(match.liveState.timerOffset || 0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [match?.liveState, match?.status, cibleDeLaPeriode, mitempsEnCours, pilote]);

  const handleStartTimer = async () => {
    try {
      await pilote.demarrerChrono();
      toast.success("Chronomètre lancé");
    } catch {
      toast.error("Erreur technique");
    }
  };

  // ---- La possession de balle ------------------------------------------------
  //
  // Le scoreur tient une bascule : le camp qui a le ballon. Tout le calcul vit
  // dans `lib/possession`, la console ne fait que declarer les bascules et
  // choisir QUAND elles partent en base.

  /**
   * Le delai avant qu'une bascule parte en base.
   *
   * Une possession change jusqu'a trois cents fois dans un match, et chaque
   * ecriture reveille tous ceux qui regardent la fiche publique. On n'ecrit
   * donc qu'une fois par fenetre, en gardant la derniere valeur — celui qui
   * regarde voit de toute facon sa barre avancer entre deux ecritures, puisque
   * le segment en cours se deduit de `since`.
   *
   * Le prix : les deux secondes et demie qui suivent une bascule sont creditees
   * au camp precedent chez le lecteur. Sur quatre-vingt-dix minutes, ces
   * erreurs se compensent d'un camp a l'autre et ne deplacent pas le chiffre.
   */
  const DELAI_ECRITURE_POSSESSION = 2500;

  /** Le chrono du match fait autorite : hors jeu, rien ne s'accumule. */
  const chronoTourne = match?.status === "live" && !!match.liveState?.isTimerRunning;


  const enAttenteRef = useRef<Possession | null>(null);

  const envoyerPossession = useCallback(() => {
    if (flushRef.current) {
      clearTimeout(flushRef.current);
      flushRef.current = null;
    }
    const p = enAttenteRef.current;
    enAttenteRef.current = null;
    if (!p) return;
    // Silencieuse : une possession perdue est un chiffre approximatif, pas un
    // match fausse. Interrompre le scoreur pour ca couterait plus que ca ne
    // rapporte.
    void pilote.poserPossession(versStockage(p)).catch(() => {});
  }, [pilote]);

  const majPossession = useCallback((next: Possession, immediat = false) => {
    possessionRef.current = next;
    setPossession(next);
    enAttenteRef.current = next;
    if (immediat) {
      envoyerPossession();
      return;
    }
    // Une ecriture est deja programmee : elle emportera cette valeur-ci.
    if (flushRef.current) return;
    flushRef.current = setTimeout(envoyerPossession, DELAI_ECRITURE_POSSESSION);
  }, [envoyerPossession]);

  // Semee UNE SEULE FOIS. Voir la declaration de `possessionRef` : l'abonnement
  // renvoie ce que la console vient d'ecrire, et le relire ecraserait la
  // bascule qui a eu lieu depuis.
  useEffect(() => {
    if (possessionRef.current !== null || !match) return;
    const depart = match.liveState?.possession ?? POSSESSION_VIDE;
    possessionRef.current = depart;
    setPossession(depart);
  }, [match]);

  // L'horloge s'arrete, le segment en cours se clot ; elle repart, il reprend.
  // Un effet plutot que des appels dans chaque bouton : la mi-temps, la reprise,
  // la pause et la fin de match passent par quatre chemins differents, et il en
  // manquerait un.
  const chronoTourneRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (possessionRef.current === null) return;
    if (chronoTourneRef.current === chronoTourne) return;
    const premierPassage = chronoTourneRef.current === null;
    chronoTourneRef.current = chronoTourne;
    // Au montage on ne fait qu'enregistrer l'etat : la console rouverte en
    // cours de match trouve `since` deja pose, et le reecrire le decalerait.
    if (premierPassage) return;
    const actuel = possessionRef.current;
    majPossession(chronoTourne ? reprendre(actuel) : suspendre(actuel), true);
  }, [chronoTourne, majPossession]);

  // La derniere bascule part avant que l'ecran ne disparaisse.
  useEffect(() => () => { envoyerPossession(); }, [envoyerPossession]);

  const basculerPossession = (side: Side | null) => {
    const actuel = possessionRef.current ?? POSSESSION_VIDE;
    majPossession(basculer(actuel, side, chronoTourne));
  };

  // ---- Les notes ---------------------------------------------------------------

  /**
   * Les notes des deux camps, recalculees a chaque fait saisi.
   *
   * Elles vivent ici, avec les autres hooks, et non plus bas avec le reste des
   * derivations : la console rend toutes les cent millisecondes tant que le
   * chrono tourne, et ce calcul ne doit pas suivre cette cadence. Il ne depend
   * donc que du match lui-meme, qui ne change qu'a l'ecriture d'un fait.
   */
  const notes = useMemo(() => {
    const faits = match?.liveState?.events ?? [];
    const vide = new Map<string, NoteJoueur>();
    if (!match) return { home: vide, away: vide };
    // Les minutes viennent de `computeMinutesPlayed`, qui lit le match entier.
    // La duree annoncee est celle du format de la competition, pas les deux
    // mi-temps reglementaires par defaut : un 7v7 en deux fois vingt minutes
    // aurait vu tout le monde credite de quatre-vingt-dix.
    return {
      home: notesDuCamp(match, match.homeLineup, faits, match.homeTeamId, halfMinutes * 2),
      away: notesDuCamp(match, match.awayLineup, faits, match.awayTeamId, halfMinutes * 2),
    };
  }, [match, halfMinutes]);

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

  // ----- Le penalty accorde, et ce qu'il devient -----
  //
  // DEUX ETAPES DANS UN SEUL ETAT : sans `issue`, la console demande laquelle
  // des quatre ; avec, elle demande qui a tire. C'est le meme penalty d'un
  // bout a l'autre, et le retour en arriere est l'absence d'`issue`.
  //
  // IL NE PORTE PAS LA LISTE DES PENALTYS EN ATTENTE, qui se lit du match
  // lui-meme (voir `penaltiesEnAttente`) : un scoreur qui recharge sa page au
  // mauvais moment doit retrouver sa question, et non un penalty muet pour
  // toujours.
  const [penaltyOuvert, setPenaltyOuvert] = useState<
    { eventId: string; side: Side; minute: number; issue?: IssuePenalty } | null
  >(null);

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
        setGoalCooldown(SECONDES_APRES_BUT);
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
        // puis on demande sa victime, dans le camp d'en face.
        //
        // Il fallait aussi BASCULER L'ONGLET sur ce camp, sans quoi la
        // question portait sur des joueurs qu'on ne voyait pas. Les deux
        // terrains etant desormais a l'ecran, il n'y a plus rien a basculer.
        if (demandeUneVictime(type)) {
          const autre: Side = side === "home" ? "away" : "home";
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
   * Ce qui n'appartient a personne : corner, coup franc, touche, penalty.
   *
   * Aucun joueur n'est demande, et c'est le point. Demander « lequel ? » sur
   * un corner ajouterait un geste et une liste de quinze noms a lire pour une
   * information que le scoreur n'a pas et que personne ne relira. Un seul
   * appui, sur le camp qui l'a obtenu.
   *
   * AUCUNE NOTIFICATION, ET AUCUNE LIGNE DANS LE FIL non plus, sauf le penalty
   * — voir `estStatistique` dans lib/evenements. Ils remplissent les compteurs
   * de l'onglet Stats, et rien d'autre.
   */
  const enregistrerEvenementEquipe = async (side: Side, type: TypeEvenementEquipe) => {
    if (!match?.liveState) return;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }
    const minute = Math.floor(displayTime / 60000) + 1;
    setIsSubmitting(true);
    try {
      const id = await pilote.ajouterEvenement({
        type,
        side,
        team_id: teamId,
        period: match.liveState.currentPeriod ?? 1,
        minute,
      });
      // LE PENALTY EST LE SEUL DES QUATRE QUI APPELLE UNE SUITE. Un corner est
      // fini quand il est saisi ; un penalty accorde ne veut encore rien dire,
      // et la question part donc immediatement. Elle se referme sans repondre
      // — le scoreur regarde le tir — et le penalty reste alors en attente,
      // visible dans le bandeau jusqu'a ce qu'il dise ce qu'il est devenu.
      if (type === "penalty") {
        setPenaltyOuvert({ eventId: id, side, minute });
      } else {
        toast.success(LIBELLE_EVENEMENT[type]);
      }
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * CE QU'UN PENALTY EST DEVENU, ET CE QUE CELA PRODUIT.
   *
   * L'issue seule ne suffirait pas : un penalty marque doit compter comme un
   * but PARTOUT ou les buts comptent — le tableau d'affichage, le classement
   * des buteurs, la fiche du joueur, l'homme du match. La console ecrit donc
   * a cote le fait de plein droit que le penalty a produit, avec les memes
   * appels que si le scoreur l'avait saisi a la main :
   *
   *   marque  → un BUT, porte par le tireur, marque « sur penalty ».
   *   rate    → un TIR non cadre, porte par le tireur.
   *   arrete  → un ARRET, porte par le GARDIEN D'EN FACE. Pas un tir cadre du
   *             tireur : les compteurs deduisent deja le tir cadre de l'arret
   *             (voir `lignesStats`), et ecrire les deux compterait la meme
   *             frappe deux fois.
   *   retire  → rien. Le penalty n'a jamais eu lieu.
   *
   * L'ISSUE S'ECRIT EN PREMIER, et c'est delibere. Rien dans cette
   * application ne supprime un evenement : un but pose en double y resterait
   * pour toujours. Si la seconde ecriture echoue, le penalty porte donc son
   * issue sans son but — un manque, que le scoreur repare du geste ordinaire
   * en posant le but sur son buteur, et que le message d'erreur lui dit.
   * Dans l'autre ordre, la meme panne aurait laisse un penalty en attente
   * AVEC son but deja au tableau, et la reponse suivante en aurait pose un
   * second.
   */
  const enregistrerIssuePenalty = async (
    eventId: string,
    side: Side,
    minute: number,
    issue: IssuePenalty,
    tireur: LineupEntry | null,
  ) => {
    if (!match?.liveState) return;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }
    const period = match.liveState.currentPeriod ?? 1;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    const autre: Side = side === "home" ? "away" : "home";

    setIsSubmitting(true);
    try {
      await pilote.poserIssuePenalty(
        eventId,
        issue,
        tireur ? { playerId: tireur.playerId, playerName: tireur.name } : null,
      );
    } catch {
      toast.error("Issue non enregistrée");
      setIsSubmitting(false);
      return;
    }

    setPenaltyOuvert(null);
    try {
      if (issue === "marque") {
        await pilote.ajouterEvenement({
          type: "goal",
          side,
          team_id: teamId,
          period,
          minute,
          player_id: tireur?.playerId ?? null,
          player_name: tireur?.name ?? null,
          // Ce qui fait dire « But sur penalty » au fil, et rien d'autre : un
          // but sur penalty vaut un but. Voir PENALTY_GOAL_DETAIL.
          detail: PENALTY_GOAL_DETAIL,
        });
        const newHome = (match.scoreHome ?? 0) + (side === "home" ? 1 : 0);
        const newAway = (match.scoreAway ?? 0) + (side === "away" ? 1 : 0);
        pilote.notifier(
          {
            title: `⚽ BUT SUR PENALTY ! ${tireur?.name ?? teamName} (${minute}')`,
            body: `${match.homeTeamName} ${newHome} – ${newAway} ${match.awayTeamName}`,
          },
          competition,
        );
        toast.success("BUT !");
        setGoalCooldown(SECONDES_APRES_BUT);
      } else if (issue === "rate") {
        await pilote.ajouterEvenement({
          type: "shot",
          side,
          team_id: teamId,
          period,
          minute,
          player_id: tireur?.playerId ?? null,
          player_name: tireur?.name ?? null,
        });
        toast("Penalty raté");
      } else if (issue === "arrete") {
        // LE GARDIEN QUI L'A ARRETE EST CELUI D'EN FACE, et c'est le seul
        // joueur du terrain qui puisse l'avoir fait. On ne le demande donc
        // pas : la feuille le dit. Sur une feuille ou personne n'a declare
        // de gardien — deux tiers d'entre elles n'ont aucun poste — l'arret
        // n'est porte par personne, et l'issue reste vraie.
        const surLeTerrain = new Set(autre === "home" ? match.homeOnPitch : match.awayOnPitch);
        const gardien = gardienDe(
          (autre === "home" ? match.homeLineup : match.awayLineup)
            .filter((e) => surLeTerrain.has(e.playerId)),
        );
        const teamAdverse = autre === "home" ? match.homeTeamId : match.awayTeamId;
        if (gardien && teamAdverse) {
          await pilote.ajouterEvenement({
            type: "save",
            side: autre,
            team_id: teamAdverse,
            period,
            minute,
            player_id: gardien.playerId,
            player_name: gardien.name,
          });
          toast.success(`Penalty arrêté par ${gardien.name}`);
        } else {
          toast("Penalty arrêté");
        }
      } else {
        toast(
          pilote.genre === "competition"
            ? "Penalty retiré par la VAR"
            : "Penalty retiré",
        );
      }
    } catch {
      toast.error(
        issue === "marque"
          ? "Le but n'a pas été enregistré : pose-le sur son buteur"
          : "Issue enregistrée, mais pas ce qu'elle a produit",
      );
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
   * DEUX MENUS DEROULANTS EN MOINS.
   *
   * La modale demandait le sortant ET l'entrant, dans deux `<select>` natifs.
   * Or on y arrive TOUJOURS en touchant quelqu'un : le sortant depuis le
   * terrain, l'entrant depuis le banc. Elle reposait donc une question a
   * laquelle le geste precedent venait de repondre.
   *
   * Et un `<select>` natif est precisement ce qu'une console couchee ne peut
   * pas se permettre : son menu s'ouvre dans le repere de L'APPAREIL, pas dans
   * celui de la page, donc de travers — le CSS ne l'atteint pas.
   *
   * Une seule question, posee dans le selecteur tactile que la console utilise
   * deja pour la victime d'une faute et pour le passeur.
   */
  const openSubModal = (side: Side, prerempli: { sort: string } | { entre: string }) => {
    if (!match) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    setSubModal({ side, teamName, ...prerempli });
  };

  const effectuerRemplacement = async (sortId: string, entreId: string) => {
    if (!match?.liveState || !subModal) return;
    const { side } = subModal;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (!teamId) {
      toast.error("Équipe non définie");
      return;
    }
    const lineup = side === "home" ? match.homeLineup : match.awayLineup;
    const outEntry = lineup.find((e) => e.playerId === sortId);
    const inEntry = lineup.find((e) => e.playerId === entreId);
    if (!outEntry || !inEntry) return;

    const events = match.liveState.events ?? [];
    // `null` : aucun plafond, c'est le cas d'un amical. Le compte n'est meme
    // pas fait — il n'y a rien a comparer.
    if (remplacementsMax !== null) {
      const subsUsed = events.filter((e) => e.type === "substitution" && e.teamId === teamId).length;
      if (subsUsed >= remplacementsMax) {
        toast.error(`${remplacementsMax} remplacements maximum`);
        return;
      }
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
        // Le sortant, par son identifiant et non plus seulement dans le texte
        // de `detail` : c'est ce qui permet de recoller ses minutes, et un
        // aller-retour d'amical en produit plusieurs.
        out_player_id: outEntry.playerId,
        out_player_name: outEntry.name,
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
    const ok = await demander({
      titre: "Terminer le match ?",
      corps: (
        <>
          Score final {match.homeTeamName} {scoreHome} – {scoreAway} {match.awayTeamName}.
          {" "}Les statistiques des joueurs partent, le direct se ferme, et la feuille
          devient définitive.
        </>
      ),
      action: "Coup de sifflet final",
      danger: true,
    });
    if (!ok) return;
    setMvpEnAttente({});
  };

  const finishMatch = async (
    opts?: { penaltyHome: number; penaltyAway: number },
    mvp?: CandidatMVP | null,
  ) => {
    setIsSubmitting(true);
    try {
      // D'ABORD LE MVP, ET SANS JAMAIS BLOQUER : un homme du match qui ne
      // s'écrit pas est un désagrément, un coup de sifflet final qui échoue
      // est une perte. Même arbitrage que le classement plus bas.
      if (mvp && user?.uid) {
        try {
          await pilote.poserMVP(
            { playerId: mvp.playerId, userId: mvp.userId, name: mvp.name, teamId: mvp.teamId },
            user.uid,
          );
        } catch (err) {
          console.error("MVP write failed:", err);
          toast.error("L'homme du match n'a pas pu être enregistré");
        }
      }
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
    // Un champ laissé vide vaut `Number("") === 0` : « pas saisi » passerait
    // pour « zéro tir au but marqué », et une séance oubliée d'un côté se
    // terminerait sur un 0 – 4 que personne n'a tiré.
    if (penaltyHome.trim() === "" || penaltyAway.trim() === "") {
      toast.error("Saisissez les tirs au but des deux équipes");
      return;
    }
    if (!Number.isInteger(ph) || !Number.isInteger(pa) || ph < 0 || pa < 0) {
      toast.error("Saisissez des tirs au but valides");
      return;
    }
    // UNE SÉANCE DE TIRS AU BUT DÉPARTAGE, SINON ELLE CONTINUE. À égalité,
    // `finishCompMatch` ne désigne aucun vainqueur : le match passe quand même
    // en « terminé », et `propagateBracketWinner` laisse la place du tour
    // suivant vide. Personne ne s'en aperçoit avant le jour du match d'après,
    // et la console ne rouvre pas un match terminé pour corriger.
    if (ph === pa) {
      toast.error("Les tirs au but doivent départager les deux équipes");
      return;
    }
    setShowPenaltyModal(false);
    setMvpEnAttente({ tab: { penaltyHome: ph, penaltyAway: pa } });
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

    /**
     * ON NE REDEMANDE PAS UNE FEUILLE DÉJÀ FAITE.
     *
     * La console ouvrait l'atelier des feuilles dès que le match n'était pas
     * commencé, même quand les deux managers avaient composé et validé la
     * leur depuis la fiche du match : l'opérateur arrivait devant un travail
     * déjà fait, et devait deviner qu'il n'avait qu'à lancer.
     *
     * L'atelier ne s'ouvre donc que s'il reste une feuille à faire — ou si
     * on demande à revoir celles qui existent.
     */
    const montrerLAtelier = !lineupsReady || revoirLesFeuilles;
    const titulairesDe = (side: Side) =>
      (side === "home" ? match.homeLineup : match.awayLineup)
        .filter((e) => e.role === "starter").length;

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
        {!rostersLoading && montrerLAtelier && (
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

        {/* LES DEUX FEUILLES SONT FAITES : on le dit, et on laisse la
            barre du coup d'envoi faire le reste. */}
        {!montrerLAtelier ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-10">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={20} className="shrink-0" />
              <p className="text-sm font-black uppercase tracking-[0.15em]">
                Les deux feuilles sont validées
              </p>
            </div>
            <div className="grid w-full max-w-md gap-2">
              {([
                { nom: match.homeTeamName, cote: "home" as Side, label: "Domicile" },
                { nom: match.awayTeamName, cote: "away" as Side, label: "Extérieur" },
              ]).map((t) => (
                <div
                  key={t.cote}
                  className="flex items-center justify-between gap-3 border border-gray-200/70 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                      {t.label}
                    </p>
                    <p className="truncate text-sm font-black text-gray-900">{t.nom}</p>
                  </div>
                  <p className="shrink-0 text-xs font-black tabular-nums text-gray-500">
                    {titulairesDe(t.cote)} titulaire{titulairesDe(t.cote) > 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
            <button
              onClick={() => setRevoirLesFeuilles(true)}
              className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 underline transition-colors hover:text-gray-900"
            >
              Revoir les feuilles
            </button>
          </div>
        ) : rostersLoading ? (
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
                depuisLaCompoType={match.homeLineup.length === 0 && (compoTypes.home?.length ?? 0) > 0}
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
                depuisLaCompoType={match.awayLineup.length === 0 && (compoTypes.away?.length ?? 0) > 0}
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
  /**
   * Le fil de la console, sans les comptables.
   *
   * Le scoreur non plus n'a pas besoin de relire ses quarante touches : il
   * vient de les poser, le toast le lui a confirmé, et elles se lisent en
   * bloc dans les compteurs juste en dessous. Les laisser ici enterrerait
   * l'unique but sous quatre écrans de défilement — exactement ce qu'on évite
   * sur la fiche publique. Voir `estStatistique`.
   */
  const faitsRacontes = events.filter(
    (e) => !estStatistique(e.type) && !penaltyDitParSonBut(e),
  );
  /**
   * Les penaltys accordes dont personne n'a encore dit ce qu'ils sont devenus.
   *
   * ILS SE LISENT DU MATCH, ET NON D'UN ETAT DE LA CONSOLE. Un scoreur qui
   * ferme la question pour regarder le tir, qui recharge sa page, ou qui prend
   * la console en cours de route doit retrouver le penalty en attente : c'est
   * le document du match qui porte l'attente, pas cet ecran-ci.
   */
  const penaltiesEnAttente = events.filter((e) => penaltyEnAttente(e));
  // Les compteurs, calcules comme sur les deux fiches publiques.
  const statRows = lignesStats(
    events,
    match.homeTeamId,
    match.awayTeamId,
    { home: match.scoreHome ?? 0, away: match.scoreAway ?? 0 },
    possession,
    chronoTourne,
    // Zéro, comme la pastille du ballon : ce panneau sert au scoreur à
    // vérifier ce qu'il vient de saisir. Voir lignesStats.
    0,
  );
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

  /**
   * Le banc : qui peut entrer.
   *
   * En competition, les remplacants de la feuille et eux seuls — un titulaire
   * sorti ne revient pas, et le banc ne le reproposait donc jamais. SUR UN
   * AMICAL C'EST L'INVERSE : la sortie n'y est pas definitive, donc tout ce
   * qui est sur la feuille sans etre sur la pelouse peut entrer, un titulaire
   * parti souffler compris. La regle vient du pilote, pas d'ici.
   *
   * Un exclu ne revient dans aucun des deux cas : un carton rouge est un
   * carton rouge, meme entre copains.
   */
  const benchEntries = (side: Side): LineupEntry[] => {
    const lineup = side === "home" ? homeLineup : awayLineup;
    const onPitch = new Set(side === "home" ? match.homeOnPitch : match.awayOnPitch);
    const sentOff = new Set(
      events.filter((e) => e.type === "red_card" && e.playerId).map((e) => e.playerId as string),
    );
    return lineup.filter(
      (e) => !onPitch.has(e.playerId)
        && !sentOff.has(e.playerId)
        && (retourAutorise || e.role === "substitute"),
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

    // Les actions de jeu, verrouillées le temps que le ballon revienne au rond
    // central. Voir `SECONDES_JEU_MORT`.
    const deJeu = (
      cle: TypeEvenementJoueur,
      emoji: string,
      ton?: ActionJoueur["ton"],
    ): ActionJoueur => ({ ...evenement(cle, emoji, ton), desactive: apresBut });

    return [
      {
        ...evenement("goal", "⚽", "vert"),
        // Le verrou du but est le plus long des deux : un but tapé deux fois
        // est un score faux, et le corriger demande une intervention
        // d'organisateur.
        libelle: "But",
        desactive: goalCooldown > 0 ? `But marqué (${goalCooldown}s)` : null,
        onClick: () => {
          if (goalCooldown > 0) return;
          void enregistrerAction(side, entry, "goal");
        },
      },
      // LE TIR CADRE EST AUSSI UN TIR, et il n'est saisi qu'une fois : les
      // compteurs de l'onglet Stats additionnent les deux (voir `statRows`).
      // Demander au scoreur de taper « tir » puis « cadré » aurait double le
      // geste le plus frequent du match pour une information deja contenue
      // dans le second.
      ...(estLeGardien ? [] : [
        deJeu("shot_on_target", EMOJI_EVENEMENT.shot_on_target),
        deJeu("shot", EMOJI_EVENEMENT.shot),
      ]),
      ...(estLeGardien || gardien === null ? [deJeu("save", "🧤")] : []),
      ...(estLeGardien ? [] : [deJeu("offside", "🚩")]),
      deJeu("foul", "⚠️"),
      // Le carton et le remplacement restent ouverts : ce sont les deux choses
      // qui arrivent justement pendant un arrêt de jeu.
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
    <ConsoleCouchee>
    {/* `h-full` et non `min-h-screen` : l'enveloppe donne a la console la
        taille exacte de l'ecran couche, et c'est elle qui fait autorite sur
        cette page. Le defilement reste possible tant que la mise en page n'est
        pas entierement ramenee a un ecran — mais il porte sur la console, pas
        sur la page derriere, qui est bloquee. */}
    <div ref={containerRef} className="flex h-full flex-col overflow-hidden bg-[#0b1512]">
      {/* L'AVERTISSEMENT EN TOUT PREMIER, avant même le tableau d'affichage.
          Il était coincé entre le tableau et le terrain, c'est-à-dire au
          milieu de ce que le scoreur regarde : une consigne qu'on lit une
          seule fois, posée en travers de la zone qu'on consulte cent fois.
          En tête de page, il se lit à l'ouverture et sort du champ dès le
          premier défilement. */}
      {!isCompleted && (
        <div className="flex shrink-0 items-center gap-1.5 bg-amber-500 px-2 py-px text-white">
          <Shield size={10} className="shrink-0" />
          <p className="truncate text-[10px] font-black uppercase tracking-wide">
            Ne quitte pas cette page avant le coup de sifflet final
          </p>
        </div>
      )}

      {/* Sandbox banner, the console is otherwise indistinguishable from the
          real thing, and a trainee must never wonder whether it counts. */}
      {/* LE MODE ENTRAÎNEMENT TIENT SUR UN FILET.

          Il occupait un tiers de la console couchée — un pavé de quatre
          lignes, pour une consigne qu'on lit une fois et jamais plus, posé en
          travers de l'écran où tout se joue. Les terrains y perdaient
          soixante-dix pixels chacun, c'est-à-dire la place des noms.

          Ce qu'il faut vraiment dire tient en cinq mots : ce match ne compte
          pas. Le reste — remise à zéro, absence de notifications — se lit
          dans l'espace live, d'où l'on vient. */}
      {competition?.isSandbox && (
        <div className="flex shrink-0 items-center gap-1.5 bg-emerald-600 px-2 py-px text-white">
          <GraduationCap size={10} className="shrink-0" />
          <p className="truncate text-[10px] font-black uppercase tracking-wide">
            Mode entraînement · rien n&apos;est publié ni compté
          </p>
        </div>
      )}

      {/*
        LE BANDEAU, SUR UN SEUL RANG.

        Le tableau d'affichage occupait 270 des 393 pixels de haut d'un
        téléphone couché — mesuré, pas estimé. Il restait 120 pixels pour les
        deux terrains, c'est-à-dire pour la seule chose qu'on touche. Il
        n'était pas trop grand : il était dessiné pour un écran debout, où la
        hauteur ne manque pas et où l'on défile.

        Couché, la hauteur est la ressource rare et la largeur est abondante.
        Tout ce qui s'empilait se range donc côte à côte, et les deux commandes
        qui vivaient sous le tableau — le déroulé, « Plus d'infos » — le
        rejoignent : elles sont rares, elles tiennent en un bouton chacune, et
        elles coûtaient un rang entier.

        L'ORDRE DE LECTURE EST CELUI DU TERRAIN : l'équipe de gauche à gauche,
        celle de droite à droite, le chrono entre les deux. Le scoreur retrouve
        son score au-dessus de son camp.
      */}
      <div className="relative z-10 flex shrink-0 items-stretch gap-2 border-b border-white/10 bg-[#0A0A0B] px-2 py-1.5 text-white">
        <h1 className="sr-only">
          {match.homeTeamName} contre {match.awayTeamName}
        </h1>

        {/* La sortie, et le score du camp de gauche. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {showBack ? (
            <button
              onClick={() => router.push(returnHref)}
              aria-label="Retour"
              className="shrink-0 text-white/45 transition-colors hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>
          ) : showQuit ? (
            <button
              onClick={handleQuit}
              aria-label="Quitter"
              className="shrink-0 text-white/45 transition-colors hover:text-white"
            >
              <LogOut size={14} />
            </button>
          ) : null}
          <span className="min-w-0 flex-1 truncate text-right text-[10px] font-black uppercase tracking-tight text-white/45">
            {match.homeTeamName}
          </span>
          <span className="shrink-0 text-2xl font-black leading-none tracking-tighter tabular-nums">
            {match.scoreHome ?? 0}
          </span>
        </div>

        {/* Le centre : ce qu'on lit (la minute) et ce qui l'arrête. */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            {!isCompleted && <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />}
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-400">
              {isCompleted
                ? "Terminé"
                : PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label || "Match"}
            </span>
            <span className="font-mono text-lg font-black leading-none tracking-tighter tabular-nums text-emerald-400">
              {formatTime(displayTime)}
            </span>
          </div>

          <div className="flex items-stretch gap-1">
            {!isCompleted && (match.liveState?.currentPeriod === 1 || match.liveState?.currentPeriod === 3) && (
              match.liveState?.isTimerRunning ? (
                <button
                  onClick={handlePauseTimer}
                  className="flex items-center gap-1 bg-amber-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-amber-600 active:scale-95"
                >
                  <Pause size={10} fill="currentColor" /> Arrêter
                </button>
              ) : (
                <button
                  onClick={handleStartTimer}
                  className="flex items-center gap-1 bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-500 active:scale-95"
                >
                  <Play size={10} fill="currentColor" /> Lancer
                </button>
              )
            )}

            {/* Le temps additionnel, à côté du bouton qui arrête l'horloge —
                c'est lui qui dit QUAND elle s'arrêtera. L'arbitre annonce, le
                scoreur recopie. */}
            {!isCompleted && mitempsEnCours && (
              <div className="flex items-stretch border border-white/15">
                <button
                  type="button"
                  onClick={() => void poserAdditionnel(-1)}
                  disabled={minutesDeLaPeriode === 0}
                  aria-label="Retirer une minute de temps additionnel"
                  className="w-5 text-xs font-black text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
                >
                  −
                </button>
                <span className="flex items-center px-1 text-[9px] font-black tabular-nums text-white/70">
                  +{minutesDeLaPeriode}&apos;
                </span>
                <button
                  type="button"
                  onClick={() => void poserAdditionnel(1)}
                  disabled={minutesDeLaPeriode >= 15}
                  aria-label="Ajouter une minute de temps additionnel"
                  className="w-5 text-xs font-black text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-25"
                >
                  +
                </button>
              </div>
            )}

            {/* LE DÉROULÉ N'A JAMAIS QU'UN BOUTON À LA FOIS : mi-temps, ou
                reprise, ou fin de match. Il occupait un rang entier pour lui
                seul, dans une carte à cadre, icône et titre — trois
                décorations pour un bouton qui se nomme déjà. */}
            {!isCompleted && match.liveState?.currentPeriod === 1 && (
              <button
                onClick={handleHalfTime}
                disabled={isSubmitting}
                className="bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-white/20 disabled:opacity-40"
              >
                Mi-temps
              </button>
            )}
            {!isCompleted && match.liveState?.currentPeriod === 2 && (
              <button
                onClick={handleResume}
                disabled={isSubmitting}
                className="flex items-center gap-1 bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
              >
                <Play size={10} fill="currentColor" /> Reprise
              </button>
            )}
            {!isCompleted && match.liveState?.currentPeriod === 3 && (
              <button
                onClick={handleFinishClick}
                disabled={isSubmitting}
                className="flex items-center gap-1 border border-red-400/40 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/15 disabled:opacity-40"
              >
                <CheckCircle2 size={11} /> Fin du match
              </button>
            )}
          </div>
        </div>

        {/* Le score du camp de droite, et le tiroir de ce qu'on ne saisit pas. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-2xl font-black leading-none tracking-tighter tabular-nums">
            {match.scoreAway ?? 0}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-tight text-white/45">
            {match.awayTeamName}
          </span>
          {!isCompleted && (
            <button
              type="button"
              onClick={() => setPlusDInfos((v) => !v)}
              aria-expanded={plusDInfos}
              aria-label="Compteurs et historique"
              className="shrink-0 text-white/45 transition-colors hover:text-white"
            >
              <Info size={15} />
            </button>
          )}
        </div>

        {/* Les tirs au but d'une phase finale, quand il y en a eu. */}
        {isCompleted && match.penaltyHome != null && match.penaltyAway != null && (
          <span className="absolute inset-x-0 bottom-0 text-center text-[8px] font-bold uppercase tracking-widest text-white/40">
            Tirs au but : {match.penaltyHome} – {match.penaltyAway}
          </span>
        )}
      </div>

      {/* UN PENALTY ACCORDE NE SE LAISSE PAS OUBLIER.

          C'est tout ce qui reste de la question quand le scoreur la referme
          pour regarder le tir — et c'est le seul moyen de la lui reposer, y
          compris apres un rechargement de page ou une prise de console en
          cours de match. Il ne prend de la hauteur que s'il y a un penalty a
          jouer, ce qui arrive une fois ou deux par match. */}
      {!isCompleted && penaltiesEnAttente.length > 0 && (
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-amber-400/25 bg-amber-500/15 px-2 py-1">
          <span aria-hidden className="shrink-0 text-[10px] leading-none">
            {EMOJI_EVENEMENT.penalty}
          </span>
          {penaltiesEnAttente.map((p) => {
            const cote: Side = p.teamId === match.homeTeamId ? "home" : "away";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setPenaltyOuvert({ eventId: p.id, side: cote, minute: p.minute })
                }
                className="shrink-0 bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0b1512] transition-colors hover:bg-amber-300"
              >
                Penalty {p.minute}&apos; ·{" "}
                {cote === "home" ? match.homeTeamName : match.awayTeamName} — Issue ?
              </button>
            );
          })}
        </div>
      )}

      {/* LA COLONNE DE GAUCHE A DISPARU AVEC CE QU'ELLE PORTAIT.

          Elle tenait le déroulé et « Plus d'infos », collés en haut sur grand
          écran, à côté de la colonne de saisie. Les deux commandes sont
          remontées dans le bandeau : il n'y avait plus qu'une colonne, et une
          grille de deux colonnes dont l'une est vide décale la seconde d'une
          demi-largeur. */}
      {/* Right column: scoring + events (or the completed summary) */}
      {/* `min-h-0` : sans lui, un enfant en `flex-1` se dimensionne sur son
          contenu et pousse la colonne hors de l'ecran. C'est la regle qui
          fait tenir la console en UN ecran, sans defilement. */}
      <div className="relative flex min-h-0 flex-1 flex-col">
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
          {/* Le terrain et ce qui n'est à personne. La possession avait sa
              propre rangée au-dessus : elle est passée DANS les onglets du
              terrain, qui portaient déjà les deux mêmes noms d'équipe. Voir
              TerrainConsole. */}
          <div className="flex min-h-0 flex-1">
            <TerrainsFaceAFace
              home={{
                name: match.homeTeamName,
                surLeTerrain: homeDisabled ? [] : onPitchEntries("home"),
                banc: homeDisabled ? [] : benchEntries("home"),
                formation: match.homeFormation,
                couleurs: couleurs?.home,
              }}
              away={{
                name: match.awayTeamName,
                surLeTerrain: awayDisabled ? [] : onPitchEntries("away"),
                banc: awayDisabled ? [] : benchEntries("away"),
                formation: match.awayFormation,
                couleurs: couleurs?.away,
              }}
              jaunes={yellowCardedIds}
              ballon={possession.side}
              parts={partPossession(possession, chronoTourne, Date.now(), 0)}
              ballonActif={chronoTourne}
              onBallon={basculerPossession}
              onJoueur={(side, entry) => setActions({ side, entry })}
              // UNE BARRE PAR CAMP, et non une seule pour « le camp affiché » :
              // le corner de gauche est le corner de gauche, il n'y a plus
              // rien à vérifier avant d'appuyer.
              actions={(cote) => (
                <BandeauEquipe
                  isSubmitting={isSubmitting}
                  desactive={apresBut}
                  onEvenement={(type) => void enregistrerEvenementEquipe(cote, type)}
                />
              )}
            />
          </div>

          {/* LE TIROIR « PLUS D'INFOS ».

              Ces deux cartes ne servent pas à SAISIR. On les consulte entre
              deux actions, ou après le match — et elles pesaient sept cent
              cinquante pixels sous le terrain, en permanence, sur un écran de
              téléphone qui en fait huit cents. La console entière faisait donc
              plus de deux écrans de haut pour un scoreur qui n'en regarde
              qu'un.

              Fermées par défaut, ouvertes d'un appui sur le bouton posé à
              côté du déroulé. Sur grand écran, où la place ne manque pas,
              elles restent visibles sans qu'on demande rien. */}
          {/* IL EST POSE PAR-DESSUS, et non inséré dans la colonne.

              Debout, il poussait simplement le terrain vers le bas et on
              défilait. Couché, il n'y a plus de bas où pousser : tout ce qui
              s'insère prend sa hauteur AU TERRAIN. Ces deux cartes ne servent
              pas à saisir — on les consulte entre deux actions — donc elles
              recouvrent, le temps qu'on les lise. */}
          <div
            className={`absolute inset-0 z-20 overflow-y-auto bg-[#0b1512]/95 p-2 space-y-3 backdrop-blur-sm ${
              plusDInfos ? "" : "hidden"
            }`}
          >

          {/* Events */}
          <div className=" border border-gray-200/70 bg-white p-3 shadow-gray-200/50 sm:p-7">
            <div className="mb-3 flex items-center justify-between sm:mb-6">
              <div className="flex items-center gap-3">
                <History className="text-gray-400" size={18} />
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">Événements</h3>
              </div>
              <div className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                {faitsRacontes.length} Total
              </div>
            </div>
            <EventTimeline
              events={faitsRacontes}
              homeTeamId={match.homeTeamId}
              homeTeamName={match.homeTeamName}
              awayTeamName={match.awayTeamName}
              onVarVerdict={handleVarVerdict}
              varPendingId={varPendingId}
            />
          </div>

          {/* Les compteurs, tels que le public les lira — mêmes noms, même
              ordre, même rendu (voir MatchStats). C'est la seule façon pour le
              scoreur de vérifier qu'il saisit ce qu'il croit saisir : la
              plupart de ces lignes n'apparaissent nulle part ailleurs dans la
              console, puisqu'elles ne passent pas dans le fil. */}
          {statRows.length > 0 && (
            <div className="border border-gray-200/70 bg-white p-3 sm:p-7">
              <div className="mb-3 flex items-center gap-3">
                <BarChart3 className="text-gray-400" size={18} />
                <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 italic">
                  Statistiques
                </h3>
              </div>
              <MatchStats
                lignes={statRows}
                homeTeamName={match.homeTeamName}
                awayTeamName={match.awayTeamName}
                compact
              />
            </div>
          )}

          </div>
        </>
      )}
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
            note={notes[actions.side].get(actions.entry.playerId)}
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

      {/* CE QU'UN PENALTY EST DEVENU, EN DEUX TEMPS : l'issue, puis le
          tireur. Le retrait par la VAR saute la seconde question — il n'y a
          pas eu de tir, donc pas de tireur. */}
      <AnimatePresence>
        {penaltyOuvert && !penaltyOuvert.issue && (
          <ModaleIssuePenalty
            teamName={penaltyOuvert.side === "home" ? match.homeTeamName : match.awayTeamName}
            minute={penaltyOuvert.minute}
            // La video-assistance n'existe qu'en competition : ailleurs, le
            // penalty est retire sans qu'on invoque une salle qui n'existe pas.
            varDisponible={pilote.genre === "competition"}
            isSubmitting={isSubmitting}
            onIssue={(issue) => {
              if (issue === "retire") {
                void enregistrerIssuePenalty(
                  penaltyOuvert.eventId, penaltyOuvert.side, penaltyOuvert.minute, issue, null,
                );
              } else {
                setPenaltyOuvert({ ...penaltyOuvert, issue });
              }
            }}
            onClose={() => setPenaltyOuvert(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {penaltyOuvert?.issue && (
          <PlayerPickerModal
            titre={RECIT_ISSUE_PENALTY[penaltyOuvert.issue]}
            sousTitre={`${penaltyOuvert.minute}' · Qui l'a tiré ?`}
            teamName={penaltyOuvert.side === "home" ? match.homeTeamName : match.awayTeamName}
            entries={onPitchEntries(penaltyOuvert.side)}
            yellowSet={yellowCardedIds}
            isSubmitting={isSubmitting}
            onPick={(entry) =>
              void enregistrerIssuePenalty(
                penaltyOuvert.eventId, penaltyOuvert.side, penaltyOuvert.minute,
                penaltyOuvert.issue!, entry,
              )
            }
            // LA CROIX REVIENT A LA QUESTION PRECEDENTE, elle n'abandonne pas :
            // on vient de dire ce qu'est devenu le penalty, et se tromper de
            // bouton ne doit pas obliger a tout reprendre.
            onClose={() => setPenaltyOuvert({ ...penaltyOuvert, issue: undefined })}
            // Celui-ci, lui, REPOND : l'issue est posee sans tireur. Le
            // penalty sort de l'attente, ce qui est le but — un scoreur qui
            // n'a pas vu qui a tire sait quand meme si le ballon est entre.
            ignorer="Tireur inconnu"
            onIgnorer={() =>
              void enregistrerIssuePenalty(
                penaltyOuvert.eventId, penaltyOuvert.side, penaltyOuvert.minute,
                penaltyOuvert.issue!, null,
              )
            }
          />
        )}
      </AnimatePresence>

      {/* LE REMPLACEMENT NE POSE PLUS QU'UNE QUESTION, et dans le même
          sélecteur tactile que la victime d'une faute ou le passeur : celui
          qu'on a touché est déjà la moitié de la réponse. */}
      <AnimatePresence>
        {subModal && (
          "sort" in subModal ? (
            <PlayerPickerModal
              titre="Qui entre ?"
              sousTitre={`${Math.floor(displayTime / 60000) + 1}' · À la place de ${
                (subModal.side === "home" ? match.homeLineup : match.awayLineup)
                  .find((e) => e.playerId === subModal.sort)?.name ?? "ce joueur"
              }`}
              teamName={subModal.teamName}
              entries={benchEntries(subModal.side)}
              yellowSet={yellowCardedIds}
              isSubmitting={isSubmitting}
              onPick={(entry) => void effectuerRemplacement(subModal.sort, entry.playerId)}
              onClose={() => setSubModal(null)}
            />
          ) : (
            <PlayerPickerModal
              titre="Qui sort ?"
              sousTitre={`${Math.floor(displayTime / 60000) + 1}' · Pour faire entrer ${
                (subModal.side === "home" ? match.homeLineup : match.awayLineup)
                  .find((e) => e.playerId === subModal.entre)?.name ?? "ce joueur"
              }`}
              teamName={subModal.teamName}
              entries={onPitchEntries(subModal.side)}
              yellowSet={yellowCardedIds}
              isSubmitting={isSubmitting}
              onPick={(entry) => void effectuerRemplacement(entry.playerId, subModal.entre)}
              onClose={() => setSubModal(null)}
            />
          )
        )}
      </AnimatePresence>

      {/* L'homme du match, au coup de sifflet. */}
      <AnimatePresence>
        {mvpEnAttente && match && (
          <ModaleMVP
            candidats={classerCandidatsMVP(match, pilote.campsEligiblesMVP(), halfMinutes * 2)}
            homeTeamId={match.homeTeamId}
            homeTeamName={match.homeTeamName}
            awayTeamName={match.awayTeamName}
            isSubmitting={isSubmitting}
            onChoisir={(c) => { const t = mvpEnAttente.tab; setMvpEnAttente(null); void finishMatch(t, c); }}
            onPasser={() => { const t = mvpEnAttente.tab; setMvpEnAttente(null); void finishMatch(t, null); }}
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

      {/* RENDUE DANS LA CONSOLE, et c'est ce qui compte ici : couchee, elle
          tourne avec elle. Montee dans le layout racine, elle serait restee
          dans le repere de l'appareil, donc de travers. */}
      <Dialogue />
    </div>
    </ConsoleCouchee>
  );
}

// ============================================
// Sub-components
// ============================================

/**
 *  * L'effectif du match, complété par la composition type du club.
 *
 * Les joueurs que la console propose viennent du match : les inscrits d'une
 * équipe de compétition, les présents confirmés d'un amical. Les seconds
 * manquent souvent — personne n'a répondu à la convocation —, et la feuille
 * n'a alors littéralement personne à cocher : pas de feuille, pas de coup
 * d'envoi, un match paralysé pour une raison administrative.
 *
 * Ceux de la composition type entrent donc dans la liste, à la suite : le
 * manager a déjà déclaré que ce sont ses joueurs. L'EFFECTIF DU MATCH RESTE
 * PRIORITAIRE, y compris sur son propre poste et son numéro — il dit qui est
 * là aujourd'hui, la composition type dit comment on joue en général.
 *
 * Personne n'est retiré : un joueur présent mais absent de la composition type
 * reste cochable. Le scoreur voit tout le monde, et tranche.
 */
function fusionnerCompoAuRoster(
  duMatch: CompPlayer[],
  compo: LineupEntry[] | null,
): CompPlayer[] {
  if (!compo || compo.length === 0) return duMatch;
  const connus = new Set(duMatch.map((j) => j.id));
  const ajouts = compo
    .filter((e) => !connus.has(e.playerId))
    .map<CompPlayer>((e) => ({
      id: e.playerId,
      name: e.name,
      number: e.number,
      user_id: e.userId ?? null,
      position: e.position ?? undefined,
    }));
  return [...duMatch, ...ajouts];
}

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
  depuisLaCompoType,
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
  /** La feuille affichee vient de la composition type du club, pas du match. */
  depuisLaCompoType: boolean;
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

      {/* D'OÙ VIENT CE QUI EST DÉJÀ COCHÉ.

          Une feuille pré-remplie sans explication est pire qu'une feuille
          vide : le scoreur la valide en croyant que les managers l'ont faite,
          et onze noms entrent au match sans que personne les ait confirmés ce
          jour-là. La ligne dit donc ce que c'est — la composition habituelle
          du club — et, implicitement, ce qu'il reste à faire : vérifier qui
          est là. */}
      {depuisLaCompoType && (
        <p className="mb-3 flex items-start gap-1.5 border border-sky-200 bg-sky-50/70 px-3 py-2 text-[11px] font-bold leading-snug text-sky-800">
          <ClipboardList size={13} className="mt-px shrink-0 text-sky-500" />
          <span>
            Composition habituelle du club, proposée. Vérifie qui est présent
            avant de valider.
          </span>
        </p>
      )}

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
          <div
            style={{ maxHeight: "min(calc(var(--console-h, 100dvh) * 0.5), 320px)" }}
            className="custom-scrollbar mb-4 space-y-2 overflow-y-auto pr-1"
          >
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

/**
 * LA QUESTION QU'UN PENALTY POSE, ET QU'IL FAUT BIEN POSER.
 *
 * Elle s'ouvre d'elle-meme des que le penalty est accorde, parce que c'est le
 * seul moment ou le scoreur regarde son telephone : trente secondes plus tard
 * le ballon est sur le point, et il regarde le terrain. Elle se referme sans
 * repondre — il a le droit de regarder, lui aussi — et le penalty passe alors
 * dans le bandeau d'attente, d'ou elle revient d'un appui.
 *
 * QUATRE BOUTONS, PAS UN MENU. Ce sont quatre issues et il n'y en a pas de
 * cinquieme ; un menu deroulant demanderait deux gestes, et un `<select>`
 * natif s'ouvre de travers dans une console couchee — voir `openSubModal`.
 */
function ModaleIssuePenalty({
  teamName,
  minute,
  varDisponible,
  isSubmitting,
  onIssue,
  onClose,
}: {
  teamName: string;
  minute: number;
  /** La VAR n'existe qu'en competition : ailleurs le penalty est « retiré ». */
  varDisponible: boolean;
  isSubmitting: boolean;
  onIssue: (issue: IssuePenalty) => void;
  onClose: () => void;
}) {
  const EMOJIS: Record<IssuePenalty, string> = {
    // Le retrait porte une interdiction et non un écran de VAR : la salle de
    // vidéo n'existe qu'en compétition, l'annulation existe partout.
    marque: "⚽", rate: "👟", arrete: "🧤", retire: "🚫",
  };
  const TONS: Record<IssuePenalty, string> = {
    marque: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    rate: "border-gray-200/70 bg-gray-50 text-gray-600 hover:bg-gray-100",
    arrete: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    retire: "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
  };

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
        // `var(--console-h)` : la hauteur REELLE de la console, qui n'est pas
        // celle de l'appareil quand elle est couchee. Voir ConsoleCouchee.
        style={{ maxHeight: "calc(var(--console-h, 100dvh) - 2rem)" }}
        className="relative w-full max-w-md overflow-y-auto bg-white p-4 shadow-2xl sm:p-7"
      >
        <button
          onClick={onClose}
          aria-label="Plus tard"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-50 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
        >
          <X size={16} />
        </button>
        <h2 className="text-lg font-black text-gray-900">Penalty</h2>
        <p className="mb-4 mt-0.5 text-xs font-bold uppercase tracking-tight text-gray-400 italic">
          {teamName} · {minute}&apos; · Que devient-il ?
        </p>

        <div className="grid grid-cols-2 gap-2">
          {ISSUES_PENALTY.map((issue) => (
            <button
              key={issue}
              type="button"
              disabled={isSubmitting}
              onClick={() => onIssue(issue)}
              className={`flex items-center gap-2 border px-3 py-3 text-left transition-colors active:scale-95 disabled:opacity-40 ${TONS[issue]}`}
            >
              <span aria-hidden className="text-lg leading-none">{EMOJIS[issue]}</span>
              <span className="min-w-0 truncate text-sm font-black uppercase tracking-tight">
                {issue === "retire" && varDisponible
                  ? "Retiré (VAR)"
                  : LIBELLE_ISSUE_PENALTY[issue]}
              </span>
            </button>
          ))}
        </div>

        <p className="mt-3 text-[11px] font-medium leading-relaxed text-gray-400">
          Tant que rien n&apos;est dit, le penalty reste en attente et s&apos;affiche
          en haut de la console.
        </p>
      </motion.div>
    </div>
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
  onIgnorer,
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
  /**
   * Ce que fait ce bouton, quand refermer n'est pas ce qu'il veut dire.
   *
   * Sur le tireur d'un penalty, « tireur inconnu » est une RÉPONSE : elle pose
   * l'issue sans nom, et sort le penalty de l'attente. Refermer, là, le
   * laisserait en attente pour toujours.
   */
  onIgnorer?: () => void;
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

        <div
              // `vh` designe la hauteur de l'APPAREIL, qui ne tourne pas :
              // couchee, la console fait 393 px de haut quand `vh` en compte
              // 852. Voir ConsoleCouchee et `--console-h`, qui vaut la hauteur
              // reelle de la console — ou celle de la fenetre hors console.
          style={{ maxHeight: "calc(var(--console-h, 100dvh) * 0.55)" }}
          className="custom-scrollbar grid grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
        >
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
            onClick={onIgnorer ?? onClose}
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

/**
 * Qui a été l'homme du match ?
 *
 * Trois noms proposés, classés par ce que la timeline a retenu, et le motif
 * sous chacun pour que le scoreur voie sur quoi la suggestion repose. IL
 * TRANCHE, la liste ne décide pas : « Un autre joueur » ouvre toute la feuille,
 * et « Terminer sans désigner » existe parce qu'un match sans homme du match
 * est un cas normal — rien ici ne doit retenir un coup de sifflet.
 */
function ModaleMVP({
  candidats, homeTeamId, homeTeamName, awayTeamName, isSubmitting, onChoisir, onPasser,
}: {
  candidats: CandidatMVP[];
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  isSubmitting: boolean;
  onChoisir: (c: CandidatMVP) => void;
  onPasser: () => void;
}) {
  const [tout, setTout] = useState(false);
  const proposes = candidats.filter((c) => !c.exclu);
  const visibles = tout ? candidats : proposes.slice(0, 3);

  return (
    <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        style={{ maxHeight: "calc(var(--console-h, 100dvh) * 0.85)" }}
        className="relative flex w-full max-w-md flex-col bg-white p-5 shadow-2xl sm:p-8"
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-amber-400 text-white">
            <Trophy size={20} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-black text-gray-900">Homme du match</h2>
            <p className="text-xs font-bold uppercase tracking-tight text-gray-400 italic">
              Les deux équipes sont éligibles
            </p>
          </div>
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {visibles.length === 0 ? (
            <p className="py-6 text-center text-sm font-semibold text-gray-400">
              Aucune feuille de match : personne à désigner.
            </p>
          ) : (
            <div className="space-y-2">
              {visibles.map((c) => (
                <button
                  key={`${c.teamId}-${c.playerId}`}
                  onClick={() => onChoisir(c)}
                  disabled={isSubmitting}
                  className={`flex w-full items-center gap-3 border p-3 text-left transition-colors disabled:opacity-50 ${
                    c.exclu ? "border-red-100 bg-red-50/40 hover:border-red-300" : "border-gray-200/70 hover:border-gray-900"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-gray-900">{c.name}</p>
                    <p className="truncate text-[11px] font-semibold text-gray-400">
                      {c.teamId === homeTeamId ? homeTeamName : awayTeamName}
                      {c.motif ? ` · ${c.motif}` : ""}
                      {c.exclu ? " · Expulsé" : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!tout && candidats.length > visibles.length && (
            <button
              onClick={() => setTout(true)}
              className="mt-3 w-full text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 underline transition-colors hover:text-gray-900"
            >
              Un autre joueur
            </button>
          )}
        </div>

        <button
          onClick={onPasser}
          disabled={isSubmitting}
          className="mt-4 w-full border border-gray-200/70 px-4 py-3 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          {isSubmitting ? "Fin du match..." : "Terminer sans désigner"}
        </button>
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
    <div className="custom-scrollbar max-h-[220px] space-y-3 overflow-y-auto pr-2 sm:max-h-[350px] sm:space-y-4">
      {[...events].reverse().map((event) => {
        const isHome = event.teamId === homeTeamId;
        const isSub = event.type === "substitution";
        const isGoal = event.type === "goal";
        const checking = isGoal && event.varStatus === "checking";
        const issue = event.type === "penalty" ? issuePenalty(event.detail) : null;
        // Un penalty retiré se barre comme un but refusé, et pour la même
        // raison : le stade l'a vu accorder, et le fil doit expliquer
        // pourquoi il ne s'est rien passé ensuite.
        const cancelled = (isGoal && event.varStatus === "cancelled") || issue === "retire";
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
                {event.type === "penalty" && (
                  <Target size={16} className={cancelled ? "text-gray-300" : "text-amber-500"} />
                )}
                <span
                  className={`text-sm font-black uppercase tracking-tight ${
                    cancelled ? "text-gray-400 line-through" : "text-gray-900"
                  }`}
                >
                  {isGoal
                    ? event.detail === PENALTY_GOAL_DETAIL ? "BUT SUR PENALTY !" : "BUT !"
                    : issue
                      ? RECIT_ISSUE_PENALTY[issue]
                      : LIBELLE_EVENEMENT[event.type]}
                </span>

                {/* Un penalty accordé et rien de plus : le scoreur n'a pas
                    encore dit ce qu'il est devenu, et cela se voit ici comme
                    dans le bandeau. */}
                {event.type === "penalty" && !issue && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    En attente
                  </span>
                )}

                {checking && (
                  <span className="inline-flex items-center gap-1 bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    VAR en cours
                  </span>
                )}
                {cancelled && (
                  <span className="inline-flex items-center gap-1 bg-red-100 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-700">
                    <Ban size={10} />
                    {/* « Retiré » tout court : la VAR n'existe pas sur un
                        amical, et ce fil est le meme des deux cotes. C'est le
                        bouton qui l'a retiré qui la nomme, là où elle existe. */}
                    {issue === "retire" ? "Retiré" : "But refusé"}
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
