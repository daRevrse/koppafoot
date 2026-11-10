"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Play, Pause, ChevronLeft, History, CheckCircle2, Loader2, Flame, Trophy, AlertTriangle, LogOut,
  GraduationCap, Hand, BarChart3, Info, ClipboardList, Ellipsis, ArrowLeftRight, Timer,
  CloudLightning, Shirt,
} from "lucide-react";
import toast from "react-hot-toast";
import { classerCandidatsMVP, type CandidatMVP } from "@/lib/mvp";
import { useConfirmation } from "@/components/ui/socle";
import { couleursDuMaillot, type CouleursEquipe } from "@/lib/couleurs-equipe";
import { useAuth } from "@/contexts/AuthContext";
import type { PiloteConsole } from "@/lib/console-pilote";
import { gardienDe } from "@/lib/terrain";
import {
  EMOJI_EVENEMENT, LIBELLE_EVENEMENT, PENALTY_FOUL_DETAIL, PENALTY_GOAL_DETAIL,
  RECIT_ISSUE_PENALTY, demandeUneVictime, estStatistique, nouvelIdEvenement, penaltyDitParSonBut,
  penaltyEnAttente, type IssuePenalty, type TypeEvenementEquipe, type TypeEvenementJoueur,
} from "@/lib/evenements";
import { partPossession } from "@/lib/possession";
import { notesDuCamp, type NoteJoueur } from "@/lib/notes";
import { libelleMinute } from "@/lib/minute-du-match";
import { SEANCE_VIDE, etatDeLaSeance, type Seance, type Tir } from "@/lib/tirs-au-but";
import {
  JEU_AVANT, apresBut, apresIssuePenalty, apresPenaltyAccorde, apresRetraitDuBut, arretDeJeu,
  autre, balleApres, campsSousLeMinimum, interrompre, lireJeu,
  miTemps, pause, relancer, reprendreLeMatch, scoreDeForfait, seanceDeTirs, verrou, type Jeu,
  type Transition,
} from "@/lib/etat-du-jeu";
import { lignesStats } from "@/lib/stats-match";
import {
  gardienDeDepart, gardienEnPlace, gardienExige, lignesSurLaPelouse,
  regleDuGardienDesigne, type GardienEnPlace,
} from "@/lib/gardiens";
import { annonceDuRetrait, DETAIL_SECOND_JAUNE, planDuRetrait } from "@/lib/retrait-evenement";
import { sansLesEvenements } from "@/lib/retouches-en-attente";
import { useEnLigne } from "@/hooks/useEnLigne";
import { useMedia } from "@/hooks/useMedia";
import MatchStats from "@/components/match/MatchStats";
import TerrainsFaceAFace, { ModaleActionsJoueur, type ActionJoueur } from "@/components/competition/TerrainConsole";
import { appliquerNumeros } from "@/lib/numeros-du-jour";
import ConsoleCouchee from "@/components/competition/ConsoleCouchee";
import type { CompMatch, LineupEntry, GoalVarStatus } from "@/types";
import { isSuperAdmin } from "@/lib/hats";
import { demanderLeRecalculDuClassement } from "@/lib/classement-client";
import { actionsDuJoueur } from "@/lib/actions-joueur";
import { avertis, leBanc, remplacementsEpuises, surLaPelouse } from "@/lib/banc";
import {
  CONSIGNE_ENGAGEMENT, apresLeTempsDeJeu, attenteDesCamps, boutonDuDeroule, estUnePeriodeDeJeu,
} from "@/lib/deroule";
import type { LiveEvent, Side } from "@/components/competition/console/types";
import { BandeauEquipe } from "@/components/competition/console/BandeauEquipe";
import { BandeauDEtat } from "@/components/competition/console/BandeauDEtat";
import { LineupBuilder } from "@/components/competition/console/FeuilleDeMatch";
import { ModaleDossards } from "@/components/competition/console/ModaleDossards";
import { SeanceDeTirs } from "@/components/competition/console/SeanceDeTirs";
import { ModaleCartonPenalty, ModaleIssuePenalty } from "@/components/competition/console/ModalesPenalty";
import { PlayerPickerModal } from "@/components/competition/console/PlayerPickerModal";
import { ModaleMVP } from "@/components/competition/console/ModaleMVP";
import { EventTimeline } from "@/components/competition/console/EventTimeline";
import { useAbonnements } from "@/components/competition/console/useAbonnements";
import { useRetouchesEnAttente } from "@/components/competition/console/useRetouchesEnAttente";
import { useEcrituresEnVol } from "@/components/competition/console/useEcrituresEnVol";
import { useChrono } from "@/components/competition/console/useChrono";
import { usePossession } from "@/components/competition/console/usePossession";
import { useFeuilles } from "@/components/competition/console/useFeuilles";

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

// Le 4 reste « fin de match » : les matchs déjà joués le portent. Les
// prolongations et la séance de tirs au but prennent les numéros suivants.
const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Fin de match" },
  { id: 5, label: "Pause" },
  { id: 6, label: "Prolongation 1" },
  { id: 7, label: "Pause" },
  { id: 8, label: "Prolongation 2" },
  { id: 9, label: "Tirs au but" },
];

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
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  const { competition, matchBrut, loading } = useAbonnements(pilote);

  const enLigne = useEnLigne();
  /**
   * Le match tel qu'il sera, retouches en attente appliquées, et la file de
   * ces retouches : voir useRetouchesEnAttente.
   */
  const { match, retouches, majRetouches, retoucher } = useRetouchesEnAttente(pilote, matchBrut, enLigne);
  /** Le match du dernier rendu, pour les gestes lancés depuis un message. */
  const matchRef = useRef<CompMatch | null>(null);
  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  /** La consigne « ne quitte pas » : le temps de la lire, à l'ouverture. */
  const [consigneVisible, setConsigneVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setConsigneVisible(false), 20_000);
    return () => clearTimeout(t);
  }, []);
  /**
   * UN GRAND ÉCRAN GARDE L'HISTORIQUE OUVERT, sous les terrains. Sur un
   * ordinateur, la console laissait deux bandes vides au-dessus et en dessous
   * des terrains, pendant qu'il fallait ouvrir un tiroir pour relire le match.
   */
  const panneauFixe = useMedia("(min-width: 1024px) and (min-height: 720px)");
  /** Les écritures parties et pas encore confirmées : voir useEcrituresEnVol. */
  const { enVol, suivre } = useEcrituresEnVol();
  const displayTime = useChrono(match);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mobile shows ONE match sheet at a time: stacking both put the kickoff
  // button several screens down. On md+ the two sit side by side and this
  // is ignored.
  const [sheetSide, setSheetSide] = useState<Side>("home");
  // « Revoir les feuilles » : quand les deux camps ont validé, l'étape est
  // franchie et la console va au coup d'envoi. Ce drapeau la rouvre à la
  // demande, pour une dernière retouche.
  const [revoirLesFeuilles, setRevoirLesFeuilles] = useState(false);
  /**
   * LA CASE « SANS GARDIEN », avant le coup d'envoi. Elle ne peut pas vivre
   * dans le match : `live_state` n'existe pas encore, et le lancement le
   * réécrit en entier. Elle part donc avec le lancement (voir lib/gardiens),
   * et le menu ⋯ la change ensuite dans le match lui-même.
   */
  const [caseSansGardien, setCaseSansGardien] = useState<boolean | null>(null);

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

  // Plus de « camp regarde » : les deux terrains sont a l'ecran en meme temps,
  // et le camp d'une saisie est celui du joueur qu'on touche. Voir
  // TerrainsFaceAFace.
  const [actions, setActions] = useState<ActionsState | null>(null);
  const [victime, setVictime] = useState<VictimeState | null>(null);
  // Le gardien vient de quitter la pelouse sans remplaçant à son poste : qui
  // prend les gants ? Facultative — un gardien remplaçant peut encore entrer.
  // `eventId` : l'exclusion qui a vidé les cages ; la retirer ferme la question.
  const [gantsAPrendre, setGantsAPrendre] = useState<{ side: Side; sortant: string; eventId: string } | null>(null);
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

  // Qui peut sortir sans terminer : l'organisateur en competition, le manager
  // sur un amical. Le pilote repond, la console ne connait pas les roles.
  // L'administration aussi, comme partout ailleurs dans l'espace organisateur.
  const isOrganizer = pilote.autoriseAQuitter(user?.uid ?? null, competition, match) || isSuperAdmin(user);

  // Règles de jeu de la compétition : le NvN plafonne les titulaires, la durée
  // d'une mi-temps cale l'horloge (pause, puis coup de sifflet final à 2×).
  // La compétition arrive une frame après le match, d'où les valeurs par défaut.
  const {
    titulairesMax: startersMax, dureeMiTempsMin: halfMinutes,
    remplacementsMax, retourAutorise, minimumJoueurs, prolongationMin,
  } = pilote.regles(competition, match);
  const halfMs = halfMinutes * 60_000;
  const fullMs = halfMs * 2;
  /**
   * Une minute telle qu'on l'écrit : « 45+2' » et non « 47' ». Voir
   * lib/minute-du-match — la même notation que le fil public et le Direct.
   */
  const ecrireMinute = (periode: number | null | undefined, minute: number) =>
    libelleMinute(periode, minute, halfMinutes, "'", prolongationMin ?? undefined);
  /** Une prolongation, en millisecondes de chrono ; zéro sans prolongations. */
  const etMs = (prolongationMin ?? 0) * 60_000;
  /** La durée jouée : le temps réglementaire, et les prolongations si on y est. */
  const dureeJoueeMin = halfMinutes * 2
    + ((matchBrut?.liveState?.currentPeriod ?? 0) >= 6 ? (prolongationMin ?? 0) * 2 : 0);
  /** La minute du chrono à l'instant, écrite : celle que montrent les questions. */
  const minuteLue = ecrireMinute(
    matchBrut?.liveState?.currentPeriod,
    Math.floor(displayTime / 60000) + 1,
  );

  /**
   * L'ÉTAT DU JEU : ballon en jeu, ou mort et pourquoi. Voir lib/etat-du-jeu.
   *
   * Il remplace les deux minuteurs qui suivaient un but — quinze secondes de
   * verrou sur les actions de jeu, soixante sur le bouton But. Ils devinaient
   * la durée d'une célébration, et se trompaient dans les deux sens : corners
   * et touches se rouvraient ballon encore mort, et l'équipe qui engageait ne
   * pouvait pas marquer de la minute. Le ballon est désormais mort jusqu'à
   * l'engagement, que le scoreur donne d'un geste — et on ne marque pas deux
   * fois sans engagement entre les deux.
   *
   * LE CARTON ET LE REMPLACEMENT NE SONT JAMAIS VERROUILLÉS. Ce sont justement
   * les deux choses qui arrivent pendant un arrêt de jeu.
   */
  const jeu: Jeu = match ? lireJeu(match) : JEU_AVANT;
  /** Pourquoi les actions de jeu sont fermées, ou `null`. */
  const verrouDuJeu = match?.status === "live" ? verrou(jeu) : null;

  /**
   * LE GARDIEN, voir lib/gardiens. `regleDuGardien` : le match a été lancé
   * avec la case, et suit la règle du gardien désigné ; sinon, tout reste
   * comme avant. `sansGardien` vaut la case : celle du match une fois lancé,
   * celle de l'écran des feuilles avant.
   */
  const regleDuGardien = regleDuGardienDesigne(match?.liveState);
  const sansGardien = match?.status === "live" || match?.status === "completed"
    ? match?.liveState?.sansGardien === true
    : caseSansGardien ?? false;
  /** Le gardien en place d'un camp, d'après les événements. */
  const gardienDuCamp = (side: Side): GardienEnPlace | null => {
    const teamId = side === "home" ? match?.homeTeamId : match?.awayTeamId;
    if (!match || teamId == null || sansGardien) return null;
    return gardienEnPlace(
      side === "home" ? match.homeLineup : match.awayLineup,
      match.liveState?.events ?? [],
      teamId,
    );
  };

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

  /** L'atelier des feuilles, avant le coup d'envoi : voir useFeuilles. */
  const {
    homeRoster, awayRoster, rostersLoading, homeSheet, awaySheet, savingSide, compoTypes,
    numeroDuJour, changerNumero, toggleSheetRole, gardienDeLaFeuille, designerGardien,
    tirerDossards, dossardsRestants, handleValidateSheet, gardienManquant, handleLaunch,
  } = useFeuilles({ pilote, match, startersMax, sansGardien });

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

  /**
   * Un geste et tout ce qu'il change — état du jeu, période, chrono — en une
   * écriture. Elle part dans la file de Firestore comme le reste : sans réseau,
   * l'écran suit quand même. Voir `suivre`.
   */
  const appliquer = (t: Transition, echec: string) => suivre(pilote.transition(t), echec);
  /** Poser un nouvel état du jeu, s'il change. */
  const poserJeu = (suivant: Jeu) => {
    if (JSON.stringify(suivant) === JSON.stringify(jeu)) return;
    appliquer({ jeu: suivant }, "L'état du jeu n'a pas été enregistré");
  };

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
   * Quand la période devrait finir, en millisecondes de chrono : la mi-temps
   * réglementaire PLUS le temps additionnel annoncé.
   *
   * L'HORLOGE NE S'Y ARRÊTE PLUS. Le temps additionnel est un minimum, et
   * l'arbitre siffle quand il veut : l'arrêt automatique coupait la dernière
   * action, saisie ensuite à une minute figée et sans possession. Passé ce
   * moment, le bouton de fin de période clignote, et c'est le scoreur qui
   * siffle avec l'arbitre.
   *
   * `null` à la pause et après le coup de sifflet final.
   */
  const cibleDeLaPeriode =
    mitempsEnCours === "first" ? halfMs + minutesAdditionnelles.first * 60_000
      : mitempsEnCours === "second" ? fullMs + minutesAdditionnelles.second * 60_000
        : match?.liveState?.currentPeriod === 6 ? fullMs + etMs
          : match?.liveState?.currentPeriod === 8 ? fullMs + 2 * etMs
            : null;

  /**
   * Poser le temps additionnel de la mi-temps en cours.
   *
   * Borne a zero et a quinze : au-dela ce n'est plus un temps additionnel mais
   * une faute de frappe.
   */
  const poserAdditionnel = (delta: number) => {
    if (!mitempsEnCours) return;
    const suivant = Math.min(15, Math.max(0, minutesDeLaPeriode + delta));
    if (suivant === minutesDeLaPeriode) return;
    suivre(pilote.poserTempsAdditionnel(mitempsEnCours, suivant), "Le temps additionnel n'a pas été enregistré");
  };

  /** Le temps additionnel annoncé est écoulé : l'arbitre va siffler. */
  const tempsEcoule = cibleDeLaPeriode !== null && displayTime >= cibleDeLaPeriode;

  /**
   * LA POSSESSION NE COMPTE QUE BALLON EN JEU. Elle suivait le chrono, qui
   * tourne aussi ballon mort : l'équipe qui venait de marquer accumulait
   * toute la célébration, alors que le ballon revient à celle qui engage.
   */
  const ballonEnJeu =
    match?.status === "live" && !!match.liveState?.isTimerRunning && jeu.balle === "en_jeu";

  /** La possession de balle, tenue ici : voir usePossession. */
  const { possession, basculerPossession, appuyerSur, jeterLaPossession } = usePossession(pilote, match, ballonEnJeu);

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
      home: notesDuCamp(match, match.homeLineup, faits, match.homeTeamId, dureeJoueeMin),
      away: notesDuCamp(match, match.awayLineup, faits, match.awayTeamId, dureeJoueeMin),
    };
  }, [match, dureeJoueeMin]);

  // ---- Le déroulé : coup d'envoi, reprises, mi-temps, interruption ------------

  const nomDe = (c: Side) => (c === "home" ? match?.homeTeamName : match?.awayTeamName) ?? "";

  /**
   * LE BALLON REPART, PAR `cote`.
   *
   * C'est le seul geste de reprise, quelle que soit la raison de l'arrêt : un
   * appui sur la pelouse du camp qui repart, sur sa pastille, ou sur le bouton
   * central (« Engagement · <équipe> », « Reprise »). Ballon en jeu, le même
   * appui ne fait que donner le ballon — c'est le geste de toujours.
   *
   * Au coup d'envoi et à la reprise de la seconde période, le chrono part avec
   * le ballon : c'est le même coup de sifflet. Il ne s'arrête jamais sur un
   * but ou un arrêt de jeu, il n'a donc pas à repartir.
   */
  const remettreEnJeu = (cote: Side) => {
    if (!match?.liveState || match.status !== "live") return;
    if (jeu.balle === "en_jeu" || jeu.raison === "interruption") {
      appuyerSur(cote);
      return;
    }
    const t: Transition = { jeu: relancer(jeu, cote) };
    const periode = match.liveState.currentPeriod ?? 1;
    if (jeu.raison === "mi_temps") {
      t.periode = 3;
      t.chrono = { demarrer: true };
    } else if (jeu.raison === "pause") {
      // Pause → prolongation : 5 → 6, 7 → 8.
      t.periode = periode + 1;
      t.chrono = { demarrer: true };
    } else if (!match.liveState.isTimerRunning) {
      // Le coup d'envoi, ou un match arrêté par l'ancien bouton « Arrêter ».
      t.chrono = { demarrer: true };
    }
    appliquer(t, "La reprise n'a pas été enregistrée");
    basculerPossession(cote);

    if (jeu.raison === "avant") {
      // LE PUSH PART AU VRAI COUP D'ENVOI, et non plus à l'ouverture du
      // direct : « C'est parti ! » sonnait pendant que le chrono attendait.
      pilote.notifier(
        { title: "🔴 C'est parti !", body: `${match.homeTeamName} – ${match.awayTeamName}, coup d'envoi !` },
        competition,
      );
      toast.success(`Coup d'envoi · ${nomDe(cote)}`);
    } else if (jeu.raison === "mi_temps") {
      // PAS DE PUSH À LA REPRISE. La mi-temps en envoie un, le prochain but
      // aussi : entre les deux, « le match reprend » ne disait rien que
      // l'abonné ait besoin de savoir, pour chacun des matchs qu'il suit.
      toast.success("Seconde période");
    } else if (jeu.raison === "pause") {
      toast.success(periode === 5 ? "Prolongations" : "Seconde prolongation");
    }
  };

  /** Le scoreur déclare un arrêt de jeu : blessure, bagarre, VAR... */
  const declarerArretDeJeu = () => poserJeu(arretDeJeu(jeu));

  /**
   * LA MI-TEMPS, AVEC UNE GARDE ET UN RETOUR.
   *
   * Le bouton était disponible dès la première minute, sans confirmation ni
   * annulation : un appui malheureux à la 12e coupait la première mi-temps
   * pour de bon. Avant le temps réglementaire, on confirme ; après, on siffle
   * aussitôt — c'est le geste de l'arbitre, il ne doit pas attendre —, et
   * « Annuler » reste offert quelques secondes, comme après un but.
   *
   * Le chrono revient à la fin réglementaire, pour que la seconde période
   * démarre au bon endroit. L'état, la période et le chrono partent ensemble.
   */
  const sifflerLaMiTemps = async () => {
    if (!match?.liveState) return;
    if (displayTime < halfMs) {
      const ok = await demander({
        titre: `Siffler la mi-temps à ${minuteLue} ?`,
        corps: <>Le temps réglementaire n&apos;est pas écoulé.</>,
        action: "Mi-temps",
        danger: true,
      });
      if (!ok) return;
    }
    const avant = { jeu, ecoule: displayTime, arreteA: Date.now() };
    appliquer({ jeu: miTemps(jeu), periode: 2, chrono: { arreterA: halfMs } }, "La mi-temps n'a pas été enregistrée");
    pilote.notifier(
      { title: "⏸️ Mi-temps", body: `${match.homeTeamName} ${match.scoreHome ?? 0} – ${match.scoreAway ?? 0} ${match.awayTeamName}` },
      competition,
    );
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span className="min-w-0">⏸️ Mi-temps</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              // Le chrono reprend comme s'il ne s'était jamais arrêté.
              appliquer(
                {
                  jeu: avant.jeu,
                  periode: 1,
                  chrono: { demarrer: true, depuis: avant.ecoule + (Date.now() - avant.arreteA) },
                },
                "La mi-temps n'a pas été annulée",
              );
            }}
            className="shrink-0 border border-gray-300 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-100"
          >
            Annuler
          </button>
        </span>
      ),
      { id: "annuler", duration: DUREE_ANNULATION },
    );
  };

  /**
   * L'INTERRUPTION : orage, incident. Le seul état où le chrono s'arrête — et
   * le seul arrêt que le public voit, « Match interrompu ».
   */
  const interrompreLeMatch = async () => {
    const ok = await demander({
      titre: "Interrompre le match ?",
      corps: <>Le chrono s&apos;arrête jusqu&apos;à la reprise. Les spectateurs voient « Match interrompu ».</>,
      action: "Interrompre",
      danger: true,
    });
    if (!ok) return;
    appliquer({ jeu: interrompre(jeu), chrono: { arreterA: displayTime } }, "L'interruption n'a pas été enregistrée");
  };

  /**
   * LE MINIMUM DE JOUEURS. Une équipe qui tombe dessous — exclusions, sorties
   * sans remplaçant — ne peut plus jouer : l'arbitre arrête le match. La
   * console l'interrompt d'elle-même et le dit ; le scoreur reprend s'il
   * s'agissait d'une erreur de saisie, ou l'organisateur prononce l'arrêt
   * définitif.
   */
  const verifierMinimum = (side: Side, restants: number) => {
    if (restants >= minimumJoueurs || jeu.raison === "interruption") return;
    appliquer({ jeu: interrompre(jeu), chrono: { arreterA: displayTime } }, "L'interruption n'a pas été enregistrée");
    setAlerteMinimumFermee(false);
    toast.error(`${nomDe(side)} n'a plus que ${restants} joueur${restants > 1 ? "s" : ""}`);
  };
  const [alerteMinimumFermee, setAlerteMinimumFermee] = useState(false);

  const reprendreApresInterruption = () => {
    appliquer({ jeu: reprendreLeMatch(jeu), chrono: { demarrer: true } }, "La reprise n'a pas été enregistrée");
    toast.success("Le match reprend");
  };

  /**
   * RECALER LE CHRONO sur la montre de l'arbitre : un chrono lancé quarante
   * secondes trop tard restait faux tout le match, et le seul outil —
   * Arrêter/Lancer — ne savait que creuser le retard. Le décalage est borné au
   * début de la période : la seconde mi-temps ne repasse pas sous 45:00.
   */
  const [recalage, setRecalage] = useState<number | null>(null);
  const debutDePeriode = {
    3: halfMs, 6: fullMs, 8: fullMs + etMs,
  }[match?.liveState?.currentPeriod ?? 1] ?? 0;
  const appliquerRecalage = () => {
    if (recalage === null || !match?.liveState) return;
    const ecoule = Math.max(debutDePeriode, displayTime + recalage);
    const delta = ecoule - displayTime;
    appliquer(
      { chrono: { decalage: (match.liveState.timerOffset || 0) + delta } },
      "Le chrono n'a pas été recalé",
    );
    setRecalage(null);
    toast.success("Chrono recalé");
  };

  /**
   * LES CÔTÉS, TELS QUE LE SCOREUR LES VOIT. Domicile était toujours à gauche,
   * gardien au bord gauche : quand l'équipe à domicile défend en réalité le but
   * de droite, tout était à l'envers, à chaque action.
   *
   * C'est le regard du scoreur, pas un fait du match : le réglage reste sur
   * l'appareil, par match. Les équipes changent de côté à la mi-temps, l'écran
   * aussi.
   */
  const cleCotes = match ? `koppafoot:console-cotes:${match.competitionId}:${match.id}` : null;
  const [cotesInverses, setCotesInverses] = useState(false);
  useEffect(() => {
    if (!cleCotes) return;
    try {
      setCotesInverses(localStorage.getItem(cleCotes) === "1");
    } catch {
      // Stockage refusé : domicile à gauche, comme avant.
    }
  }, [cleCotes]);
  const inverserLesCotes = () => {
    const suivant = !cotesInverses;
    setCotesInverses(suivant);
    if (!cleCotes) return;
    try {
      localStorage.setItem(cleCotes, suivant ? "1" : "0");
    } catch {
      // Voir plus haut.
    }
  };
  /** Le camp affiché à gauche, à cet instant du match. */
  // Les équipes changent de côté à la mi-temps, puis entre les deux
  // prolongations : inversées de la pause jusqu'à la première prolongation.
  const periodeCotes = match?.liveState?.currentPeriod ?? 1;
  const aGauche: Side = cotesInverses !== (periodeCotes >= 2 && periodeCotes <= 6) ? "away" : "home";

  const [menuOuvert, setMenuOuvert] = useState(false);
  // La fenêtre des dossards du direct (voir ModaleDossards).
  const [dossardsOuverts, setDossardsOuverts] = useState(false);

  // ----- Match-sheet builder -----

  /**
   * Les nouveaux numéros d'une feuille DÉJÀ JOUÉE, depuis le direct. Seuls les
   * camps qui changent s'écrivent, et leur feuille garde son état : on corrige
   * un numéro, on ne revalide rien.
   */
  const enregistrerDossards = (numeros: { home: Record<string, string>; away: Record<string, string> }) => {
    if (!match) return;
    let ecrits = 0;
    for (const side of ["home", "away"] as const) {
      const feuille = appliquerNumeros(side === "home" ? match.homeLineup : match.awayLineup, numeros[side]);
      if (!feuille) continue;
      ecrits += 1;
      suivre(
        pilote.poserFeuille(side, feuille, side === "home" ? match.homeLineupReady : match.awayLineupReady),
        "Les dossards n'ont pas été enregistrés",
      );
    }
    setDossardsOuverts(false);
    if (ecrits > 0) toast.success("Dossards mis à jour pour ce match");
  };

  /**
   * RETOUR AUX FEUILLES, tant que personne n'a engagé.
   *
   * « Aller au coup d'envoi » ouvre le direct, et il n'y avait plus de chemin
   * vers les feuilles : un titulaire qui se blesse à l'échauffement, un numéro
   * mal saisi, et le scoreur n'avait plus que les remplacements — qui comptent
   * dans le quota du match. Avant le coup d'envoi, rien n'est encore arrivé :
   * le direct se referme, le match redevient à venir, et l'atelier se rouvre
   * sur les feuilles telles qu'elles ont été validées.
   *
   * La possession en attente d'écriture est jetée AVANT : partie après, elle
   * recréerait un état du direct sur un match qui n'en a plus.
   */
  const handleRevenirAuxFeuilles = async () => {
    const ok = await demander({
      titre: "Revenir aux feuilles ?",
      corps: (
        <>
          Le direct se referme : le match redevient « à venir » le temps de
          retoucher les feuilles, puis tu relances comme avant.
        </>
      ),
      action: "Revenir aux feuilles",
    });
    if (!ok) return;
    jeterLaPossession();
    try {
      await pilote.revenirAuxFeuilles();
      setRevoirLesFeuilles(true);
    } catch {
      toast.error("Le retour aux feuilles n'a pas été enregistré");
    }
  };

  // Organizer quit during live: navigate back — after saying what it means.
  // Rien ne se perd (le match vit en base, le chrono continue), mais plus
  // personne ne saisit : c'était la raison du bandeau permanent.
  const handleQuit = useCallback(async () => {
    const ok = await demander({
      titre: "Quitter la console ?",
      corps: (
        <>
          Le match continue et le chrono tourne, mais plus rien ne sera saisi tant
          que personne ne reviendra sur cette page.
        </>
      ),
      action: "Quitter",
      danger: true,
    });
    if (ok) router.push(returnHref);
  }, [demander, router, returnHref]);

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
    { eventId: string; side: Side; minute: number; periode: number; issue?: IssuePenalty } | null
  >(null);

  /**
   * AVANT L'ISSUE, LA FAUTE. Un penalty vient toujours d'une faute — ou d'une
   * main — d'un défenseur, et s'accompagne souvent d'un carton : la console ne
   * demandait ni l'un ni l'autre. Deux questions, chacune facultative, posées
   * au moment où le scoreur regarde encore son téléphone : qui a fait la
   * faute, puis quel carton. Vient ensuite l'issue, comme avant.
   */
  const [fautePenalty, setFautePenalty] = useState<
    { eventId: string; side: Side; minute: number; periode: number; fautif?: LineupEntry } | null
  >(null);

  const handleVarVerdict = async (event: LiveEvent, status: GoalVarStatus) => {
    if (!match) return;
    // Une décision de VAR se prend sur l'état du serveur (voir
    // `setCompGoalVarStatus`) : sans réseau, elle ne peut pas partir.
    if (!enLigne) {
      toast.error("La VAR demande le réseau : attends son retour.");
      return;
    }
    const teamName = event.teamId === match.homeTeamId ? match.homeTeamName : match.awayTeamName;
    const who = event.playerName ? `${event.playerName} (${teamName})` : teamName;

    setVarPendingId(event.id);
    try {
      await pilote.poserVar?.(event.id, status);
      // UN SEUL PUSH SUR TROIS : le but refusé. L'abonné a reçu « BUT ! » ; il
      // doit apprendre qu'il ne compte plus. « VAR en cours » puis « But
      // accordé » lui faisaient sonner deux fois le téléphone pour lui
      // confirmer ce qu'il savait déjà.
      if (status === "checking") {
        toast("But en cours de vérification");
      } else if (status === "cancelled") {
        toast.success("But refusé");
        pilote.notifier(
          { title: "❌ But refusé", body: `Le but de ${who} est annulé` },
          competition,
        );
      } else {
        toast.success("But accordé");
      }
    } catch (err) {
      console.error("VAR verdict error:", err);
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer la décision");
    } finally {
      setVarPendingId(null);
    }
  };

  // ----- La saisie, joueur par joueur -----

  // ----- Retouches, retraits, annulation -----

  /**
   * RETIRER UN ÉVÉNEMENT, avec ce qu'il emporte (voir lib/retrait-evenement).
   *
   * Lit le match par sa référence : on arrive ici depuis « Annuler », un
   * message créé plusieurs secondes plus tôt, et le match a pu bouger depuis.
   *
   * Depuis l'historique, on confirme : le geste est délibéré, et il peut
   * défaire une exclusion. Depuis « Annuler », on ne confirme pas : c'est
   * précisément le geste de la seconde d'après.
   */
  const retirerEvenement = async (eventId: string, confirmer: boolean) => {
    const m = matchRef.current;
    if (!m?.liveState) return;
    const r = planDuRetrait(m.liveState.events, eventId, {
      homeTeamId: m.homeTeamId,
      surLeTerrain: { home: m.homeOnPitch, away: m.awayOnPitch },
      // Pour savoir si l'exclu était le gardien : voir lib/gardiens.
      lineups: { home: m.homeLineup, away: m.awayLineup },
    });
    if (!r.ok) {
      toast.error(r.raison);
      return;
    }
    const cible = m.liveState.events.find((e) => e.id === eventId);
    const quoi = cible
      ? `${LIBELLE_EVENEMENT[cible.type] ?? "Événement"}${cible.playerName ? ` de ${cible.playerName}` : ""}`
      : "Événement";
    if (confirmer) {
      const emportes = r.plan.ids.filter((id) => id !== eventId);
      const gants = emportes.some((id) => m.liveState?.events.find((e) => e.id === id)?.type === "gants");
      const emporte = emportes.some((id) => m.liveState?.events.find((e) => e.id === id)?.type !== "gants");
      const ok = await demander({
        titre: `Retirer : ${quoi.toLowerCase()} ?`,
        corps: (
          <>
            Il disparaît de l&apos;historique, des statistiques et des notes.
            {r.plan.score.home + r.plan.score.away < 0 && " Le score perd ce but."}
            {emporte && " L'exclusion et le second jaune partent ensemble."}
            {gants && " La prise de gants qui avait suivi part aussi."}
            {r.plan.surLeTerrain.home || r.plan.surLeTerrain.away
              ? " La pelouse revient à ce qu'elle était avant."
              : ""}
          </>
        ),
        action: "Retirer",
        danger: true,
      });
      if (!ok) return;
    }
    const ids = r.plan.ids;
    majRetouches((f) => sansLesEvenements(f, ids));
    suivre(pilote.retirer(r.plan), "Le retrait n'a pas été enregistré");
    // Un but ou une exclusion déjà poussés aux abonnés : on les dément. Pendant
    // le match seulement : après le coup de sifflet, le score final est parti,
    // et une retouche d'historique ne mérite pas de réveiller qui que ce soit.
    const annonce = m.status === "live"
      ? annonceDuRetrait(r.plan, m.liveState.events, {
          homeTeamId: m.homeTeamId,
          homeTeamName: m.homeTeamName,
          awayTeamName: m.awayTeamName,
          score: { home: m.scoreHome ?? 0, away: m.scoreAway ?? 0 },
        })
      : null;
    if (annonce) pilote.notifier(annonce, competition);
    // Les questions qui portaient sur lui n'ont plus d'objet.
    setAssistPicker((a) => (a && ids.includes(a.eventId) ? null : a));
    setVictime((v) => (v && ids.includes(v.eventId) ? null : v));
    setGantsAPrendre((g) => (g && ids.includes(g.eventId) ? null : g));
    setPenaltyOuvert((p) => (p && ids.includes(p.eventId) ? null : p));
    setFautePenalty((f) => (f && ids.includes(f.eventId) ? null : f));
    // Le but qui avait mis le ballon mort est retiré : la console ne devine pas
    // ce qui s'est passé, elle passe en arrêt de jeu et le scoreur relance.
    if (m.liveState.events.some((e) => ids.includes(e.id) && e.type === "goal")) {
      poserJeu(apresRetraitDuBut(lireJeu(m)));
    }
    toast(`${quoi} : retiré`, { icon: "↩️" });
  };

  /**
   * « ANNULER », quelques secondes après chaque saisie.
   *
   * La plupart des erreurs de console se voient à l'instant : le mauvais
   * joueur touché, le mauvais bouton. Les réparer tout de suite, d'un geste,
   * coûte moins que de les chercher plus tard dans l'historique.
   */
  const DUREE_ANNULATION = 6000;
  const proposerAnnulation = (texte: string, eventId: string) => {
    toast(
      (t) => (
        <span className="flex items-center gap-3">
          <span className="min-w-0">{texte}</span>
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              void retirerEvenement(eventId, false);
            }}
            className="shrink-0 border border-gray-300 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-100"
          >
            Annuler
          </button>
        </span>
      ),
      // UN SEUL À LA FOIS, celui de la dernière saisie : empilés, ils
      // recouvraient les corbeilles de l'historique et la croix des
      // questions. Une saisie plus ancienne se corrige depuis l'historique.
      { id: "annuler", duration: DUREE_ANNULATION },
    );
  };

  /**
   * Enregistre ce qu'un joueur vient de faire.
   *
   * Un seul point d'entrée pour les six événements joueur : ils partagent
   * tout ce qui compte — la période, la minute, le camp, et le fait qu'une
   * erreur d'écriture doive laisser le match en état. Ce qui les distingue
   * tient dans les branches : le score, la notification, l'expulsion.
   */
  const enregistrerAction = (
    side: Side,
    entry: LineupEntry,
    type: TypeEvenementJoueur,
  ) => {
    if (!match?.liveState) return;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    // UN ADVERSAIRE HORS PLATEFORME a un identifiant VIDE (`""`), et c'est
    // un camp comme un autre : ses événements portent ce même `""`, que les
    // règles et les lecteurs connaissent déjà. Seul `null` dit qu'il n'y a
    // pas d'équipe — un tableau pas encore tiré.
    if (teamId == null) {
      toast.error("Équipe non définie");
      return;
    }
    const period = match.liveState.currentPeriod ?? 1;
    const minute = Math.floor(displayTime / 60000) + 1;
    const onPitch = side === "home" ? match.homeOnPitch : match.awayOnPitch;
    const events = match.liveState.events ?? [];
    const base = { side, team_id: teamId, period, minute, player_id: entry.playerId, player_name: entry.name };
    // LE GARDIEN QUI QUITTE LA PELOUSE sans remplaçant à son poste laisse les
    // cages vides : la console demande qui prend les gants (voir lib/gardiens).
    const etaitAuBut = regleDuGardien && gardienDuCamp(side)?.playerId === entry.playerId;
    const viderLesCages = (exclusionId: string) => {
      if (etaitAuBut) setGantsAPrendre({ side, sortant: entry.playerId, eventId: exclusionId });
    };

    // RIEN N'EST ATTENDU ICI. L'identifiant est tiré d'avance, l'écriture part
    // dans la file de Firestore, et la console rend la main aussitôt — réseau
    // ou pas. Voir `suivre`.
    if (type === "goal") {
      const goalId = nouvelIdEvenement();
      suivre(pilote.ajouterEvenement({ ...base, id: goalId, type: "goal" }), "Le but n'a pas été enregistré");
      const newHome = (match.scoreHome ?? 0) + (side === "home" ? 1 : 0);
      const newAway = (match.scoreAway ?? 0) + (side === "away" ? 1 : 0);
      pilote.notifier(
        { title: `⚽ BUT ! ${entry.name} (${ecrireMinute(period, minute)})`, body: `${match.homeTeamName} ${newHome} – ${newAway} ${match.awayTeamName}` },
        competition,
      );
      proposerAnnulation(`⚽ But de ${entry.name}`, goalId);
      // Le ballon est mort jusqu'à l'engagement de l'équipe qui a encaissé.
      poserJeu(apresBut(jeu, side));
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
      const jauneId = nouvelIdEvenement();
      suivre(pilote.ajouterEvenement({ ...base, id: jauneId, type: "yellow_card" }), "Le carton n'a pas été enregistré");
      if (priorYellows >= 1) {
        // Second yellow → automatic send-off. « Annuler » sur le jaune emporte
        // le rouge qu'il a provoqué : voir lib/retrait-evenement.
        suivre(
          pilote.ajouterEvenement({ ...base, type: "red_card", detail: DETAIL_SECOND_JAUNE }),
          "L'exclusion n'a pas été enregistrée",
        );
        suivre(pilote.poserSurLeTerrain(side, onPitch.filter((id) => id !== entry.playerId)), "La pelouse n'a pas été mise à jour");
        pilote.notifier(
          { title: `🟥 Expulsion (${ecrireMinute(period, minute)})`, body: `${entry.name} (${teamName}), 2e carton jaune` },
          competition,
        );
        proposerAnnulation(`🟥 2e jaune : ${entry.name} exclu`, jauneId);
        verifierMinimum(side, onPitch.filter((id) => id !== entry.playerId).length);
        viderLesCages(jauneId);
      } else {
        // UN JAUNE NE SONNE PAS. Pour qui suit une compétition de quarante
        // matchs, c'était un téléphone qui vibre à chaque faute un peu
        // appuyée. L'exclusion, elle, change le match : elle part.
        proposerAnnulation(`🟨 Carton jaune, ${entry.name}`, jauneId);
      }
    } else if (type === "red_card") {
      // Direct red card.
      const rougeId = nouvelIdEvenement();
      suivre(pilote.ajouterEvenement({ ...base, id: rougeId, type: "red_card" }), "Le carton n'a pas été enregistré");
      suivre(pilote.poserSurLeTerrain(side, onPitch.filter((id) => id !== entry.playerId)), "La pelouse n'a pas été mise à jour");
      pilote.notifier(
        { title: `🟥 Carton rouge (${ecrireMinute(period, minute)})`, body: `${entry.name} (${teamName})` },
        competition,
      );
      proposerAnnulation(`🟥 Carton rouge, ${entry.name}`, rougeId);
      verifierMinimum(side, onPitch.filter((id) => id !== entry.playerId).length);
      viderLesCages(rougeId);
    } else if (type === "sortie") {
      // Il quitte la pelouse, personne n'entre : son équipe joue à un de
      // moins. Jamais notifié — une blessure n'est pas un fait de match pour
      // qui suit de loin —, mais le minimum de joueurs veille.
      const sortieId = nouvelIdEvenement();
      const restants = onPitch.filter((id) => id !== entry.playerId);
      suivre(pilote.ajouterEvenement({ ...base, id: sortieId, type: "sortie" }), "La sortie n'a pas été enregistrée");
      suivre(pilote.poserSurLeTerrain(side, restants), "La pelouse n'a pas été mise à jour");
      proposerAnnulation(`🚑 ${entry.name} sort sans remplaçant`, sortieId);
      verifierMinimum(side, restants.length);
      viderLesCages(sortieId);
    } else {
      // Arrêt, faute, hors-jeu, ballon gagné ou perdu, prise de gants :
      // l'historique du match, et rien d'autre.
      //
      // AUCUNE NOTIFICATION, volontairement. On réveille le téléphone d'un
      // supporter pour un but ou une expulsion, pas pour un hors-jeu à la
      // 12e. Ceux-là existent pour les statistiques et pour le récit
      // d'après-match ; les pousser noierait les deux qui comptent.
      const id = nouvelIdEvenement();
      suivre(pilote.ajouterEvenement({ ...base, id, type }), "L'action n'a pas été enregistrée");
      proposerAnnulation(`${LIBELLE_EVENEMENT[type]}, ${entry.name}`, id);
      // LA SAISIE DIT OÙ VA LE BALLON : une faute ou un hors-jeu le donnent à
      // l'adversaire, un tir aussi (six mètres, ou ballon capté), l'arrêt le
      // laisse au gardien. Le scoreur n'a plus à le dire une seconde fois.
      const balle = balleApres(type, side);
      if (balle) basculerPossession(balle);

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
  const enregistrerEvenementEquipe = (side: Side, type: TypeEvenementEquipe) => {
    if (!match?.liveState) return;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (teamId == null) {
      toast.error("Équipe non définie");
      return;
    }
    const minute = Math.floor(displayTime / 60000) + 1;
    const id = nouvelIdEvenement();
    suivre(
      pilote.ajouterEvenement({ id, type, side, team_id: teamId, period: match.liveState.currentPeriod ?? 1, minute }),
      "L'action n'a pas été enregistrée",
    );
    // LE PENALTY EST LE SEUL DES QUATRE QUI APPELLE UNE SUITE. Un corner est
    // fini quand il est saisi ; un penalty accorde ne veut encore rien dire,
    // et la question part donc immediatement. Elle se referme sans repondre
    // — le scoreur regarde le tir — et le penalty reste alors en attente,
    // visible dans le bandeau jusqu'a ce qu'il dise ce qu'il est devenu.
    if (type === "penalty") {
      setFautePenalty({ eventId: id, side, minute, periode: match.liveState.currentPeriod ?? 1 });
      // Le jeu attend le tir.
      poserJeu(apresPenaltyAccorde(jeu));
    }
    // La remise en jeu appartient au camp qui l'obtient.
    const balle = balleApres(type, side);
    if (balle) basculerPossession(balle);
    proposerAnnulation(
      `${LIBELLE_EVENEMENT[type]}, ${side === "home" ? match.homeTeamName : match.awayTeamName}`,
      id,
    );
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
   * L'ISSUE EST POSÉE EN PREMIER, et c'est délibéré. Si l'écriture de ce
   * qu'elle produit échoue, le penalty porte son issue sans son but — un
   * manque, que le scoreur répare du geste ordinaire en posant le but sur son
   * buteur, et que le message d'erreur lui dit. Dans l'autre ordre, la même
   * panne aurait laissé un penalty en attente AVEC son but déjà au tableau,
   * et la réponse suivante en aurait posé un second.
   *
   * L'issue est une RETOUCHE (voir `retoucher`) : sans réseau, elle attend
   * sur l'appareil, et la console l'affiche en attendant.
   */
  const enregistrerIssuePenalty = (
    eventId: string,
    side: Side,
    minute: number,
    issue: IssuePenalty,
    tireur: LineupEntry | null,
  ) => {
    if (!match?.liveState) return;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (teamId == null) {
      toast.error("Équipe non définie");
      return;
    }
    const period = match.liveState.currentPeriod ?? 1;
    const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
    const autre: Side = side === "home" ? "away" : "home";

    retoucher({
      genre: "penalty",
      eventId,
      valeur: { issue, tireur: tireur ? { playerId: tireur.playerId, playerName: tireur.name } : null },
    });
    setPenaltyOuvert(null);
    // Marqué : on attend l'engagement adverse. Raté, arrêté ou retiré : le jeu
    // reprend, ballon à la défense — six mètres, ou ballon capté.
    if (issue !== "marque" && jeu.raison === "penalty") basculerPossession(autre);
    poserJeu(apresIssuePenalty(jeu, issue, side));

    const echec = issue === "marque"
      ? "Le but n'a pas été enregistré : pose-le sur son buteur"
      : "Issue enregistrée, mais pas ce qu'elle a produit";
    if (issue === "marque") {
      const butId = nouvelIdEvenement();
      suivre(pilote.ajouterEvenement({
        id: butId,
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
      }), echec);
      const newHome = (match.scoreHome ?? 0) + (side === "home" ? 1 : 0);
      const newAway = (match.scoreAway ?? 0) + (side === "away" ? 1 : 0);
      pilote.notifier(
        {
          title: `⚽ BUT SUR PENALTY ! ${tireur?.name ?? teamName} (${ecrireMinute(period, minute)})`,
          body: `${match.homeTeamName} ${newHome} – ${newAway} ${match.awayTeamName}`,
        },
        competition,
      );
      proposerAnnulation(`⚽ But sur penalty${tireur ? `, ${tireur.name}` : ""}`, butId);
    } else if (issue === "rate") {
      suivre(pilote.ajouterEvenement({
        type: "shot",
        side,
        team_id: teamId,
        period,
        minute,
        player_id: tireur?.playerId ?? null,
        player_name: tireur?.name ?? null,
      }), echec);
      toast("Penalty raté");
    } else if (issue === "arrete") {
      // LE GARDIEN QUI L'A ARRETE EST CELUI D'EN FACE, et c'est le seul
      // joueur du terrain qui puisse l'avoir fait. On ne le demande donc
      // pas : la feuille le dit. Sur une feuille ou personne n'a declare
      // de gardien — deux tiers d'entre elles n'ont aucun poste — l'arret
      // n'est porte par personne, et l'issue reste vraie.
      //
      // Sous la regle du gardien designe, c'est le gardien EN PLACE (voir
      // lib/gardiens) : personne dans un match sans gardien, ni quand les
      // cages sont vides.
      const surLeTerrain = new Set(autre === "home" ? match.homeOnPitch : match.awayOnPitch);
      const lineupAdverse = autre === "home" ? match.homeLineup : match.awayLineup;
      const enPlace = regleDuGardien ? gardienDuCamp(autre) : null;
      const gardien = regleDuGardien
        ? lineupAdverse.find((e) => e.playerId === enPlace?.playerId) ?? null
        : gardienDe(lineupAdverse.filter((e) => surLeTerrain.has(e.playerId)));
      const teamAdverse = autre === "home" ? match.homeTeamId : match.awayTeamId;
      if (gardien && teamAdverse) {
        suivre(pilote.ajouterEvenement({
          type: "save",
          side: autre,
          team_id: teamAdverse,
          period,
          minute,
          player_id: gardien.playerId,
          player_name: gardien.name,
        }), echec);
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
  };

  /** Les deux questions de la faute sont passées : place à l'issue du penalty. */
  const ouvrirIssuePenalty = (f: { eventId: string; side: Side; minute: number; periode: number }) => {
    setFautePenalty(null);
    setPenaltyOuvert({ eventId: f.eventId, side: f.side, minute: f.minute, periode: f.periode });
  };

  /**
   * L'auteur de la faute, dans le camp qui défend. Une faute ordinaire de son
   * auteur — elle compte dans ses fautes —, marquée « penalty » pour ne pas
   * compter comme un coup franc. Voir PENALTY_FOUL_DETAIL.
   */
  const poserFautifPenalty = (entry: LineupEntry) => {
    if (!fautePenalty || !match?.liveState) return;
    const cote = autre(fautePenalty.side);
    const teamId = cote === "home" ? match.homeTeamId : match.awayTeamId;
    if (teamId == null) return;
    suivre(pilote.ajouterEvenement({
      id: nouvelIdEvenement(),
      type: "foul",
      side: cote,
      team_id: teamId,
      period: fautePenalty.periode,
      minute: fautePenalty.minute,
      player_id: entry.playerId,
      player_name: entry.name,
      detail: PENALTY_FOUL_DETAIL,
    }), "La faute n'a pas été enregistrée");
    setFautePenalty({ ...fautePenalty, fautif: entry });
  };

  /**
   * Le carton du fautif, ou aucun. Il passe par le circuit de tous les
   * cartons : un second jaune y vaut l'exclusion, la pelouse et le push
   * suivent.
   */
  const sanctionnerPenalty = (carton: "yellow_card" | "red_card" | null) => {
    if (!fautePenalty?.fautif) return;
    if (carton) enregistrerAction(autre(fautePenalty.side), fautePenalty.fautif, carton);
    ouvrirIssuePenalty(fautePenalty);
  };

  /**
   * Hang the passer on the goal just recorded. Never blocks the console: the
   * goal itself is already on the board, and the passer is a RETOUCHE — it
   * waits on the device when the network is gone (see `retoucher`).
   */
  const recordAssist = (entry: LineupEntry) => {
    if (!assistPicker) return;
    retoucher({
      genre: "passeur",
      eventId: assistPicker.eventId,
      valeur: { playerId: entry.playerId, playerName: entry.name },
    });
    toast.success(`Passe décisive, ${entry.name}`);
    setAssistPicker(null);
  };

  /**
   * Nommer celui qui a subi la faute. Jamais bloquant : la faute est déjà
   * dans l'historique, la victime ne fait que l'enrichir — une retouche, qui
   * attend le réseau s'il le faut.
   */
  const enregistrerVictime = (entry: LineupEntry) => {
    if (!victime) return;
    retoucher({
      genre: "victime",
      eventId: victime.eventId,
      valeur: { playerId: entry.playerId, playerName: entry.name },
    });
    toast.success(`Faute sur ${entry.name}`);
    setVictime(null);
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

  const effectuerRemplacement = (sortId: string, entreId: string) => {
    if (!match?.liveState || !subModal) return;
    const { side } = subModal;
    const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
    if (teamId == null) {
      toast.error("Équipe non définie");
      return;
    }
    const lineup = side === "home" ? match.homeLineup : match.awayLineup;
    const outEntry = lineup.find((e) => e.playerId === sortId);
    const inEntry = lineup.find((e) => e.playerId === entreId);
    if (!outEntry || !inEntry) return;

    // Pas de plafond sur un amical (`remplacementsMax` à null) : voir lib/banc.
    if (remplacementsEpuises(match.liveState.events ?? [], teamId, remplacementsMax)) {
      toast.error(`${remplacementsMax} remplacements maximum`);
      return;
    }
    const onPitch = side === "home" ? match.homeOnPitch : match.awayOnPitch;

    const subMinute = Math.floor(displayTime / 60000) + 1;
    const remplacementId = nouvelIdEvenement();
    suivre(pilote.ajouterEvenement({
      id: remplacementId,
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
    }), "Le changement n'a pas été enregistré");
    suivre(pilote.poserSurLeTerrain(
      side,
      [...onPitch.filter((id) => id !== outEntry.playerId), inEntry.playerId],
    ), "La pelouse n'a pas été mise à jour");
    pilote.notifier(
      { title: `🔄 Changement (${ecrireMinute(match.liveState.currentPeriod ?? 1, subMinute)})`, body: `${outEntry.name} → ${inEntry.name} (${subModal.teamName})` },
      competition,
    );
    proposerAnnulation(`🔄 ${outEntry.name} → ${inEntry.name}`, remplacementId);
    setSubModal(null);
  };

  // Whistle for full time: snap the clock to the end of the second half and
  // stop, then finish. On a knockout draw, collect penalties first.
  /**
   * LE COUP DE SIFFLET FINAL DEMANDE LE RÉSEAU, et tout ce que l'appareil
   * garde encore. Il part par le serveur (statistiques, classement), qui ne
   * lit que ce qu'il a reçu : terminer avec des saisies en attente les
   * laisserait hors du match. On le dit, plutôt que de laisser le bouton
   * tourner dans le vide.
   */
  const finPossible = (): boolean => {
    if (!enLigne) {
      toast.error("Pas de réseau : le coup de sifflet final attendra son retour. Le match continue de s'enregistrer.");
      return false;
    }
    if (enVol > 0 || retouches.length > 0) {
      toast.error("Des saisies partent encore : réessaie dans quelques secondes.");
      return false;
    }
    return true;
  };

  /**
   * LA FIN DU TEMPS DE JEU, à la 90e ou après les prolongations.
   *
   * À égalité en élimination directe, le match ne s'arrête pas : il part en
   * prolongations si le règlement en prévoit, puis en tirs au but — tir par
   * tir, dans la console. La séance se saisissait en un chiffre, après coup.
   */
  const handleFinishClick = async () => {
    if (!match?.liveState) return;
    const periode = match.liveState.currentPeriod ?? 3;
    const scoreHome = match.scoreHome ?? 0;
    const scoreAway = match.scoreAway ?? 0;
    const finDuJeu = periode >= 6 ? fullMs + 2 * etMs : fullMs;

    const suite = apresLeTempsDeJeu({ stage: match.stage, scoreHome, scoreAway, periode, prolongationMin });
    if (suite === "prolongations") {
      const ok = await demander({
        titre: "Égalité : prolongations ?",
        corps: <>{`Deux périodes de ${prolongationMin} minutes, puis tirs au but s'il le faut.`}</>,
        action: "Prolongations",
      });
      if (!ok) return;
      appliquer({ jeu: pause(jeu, null), periode: 5, chrono: { arreterA: fullMs } }, "Les prolongations n'ont pas été enregistrées");
      pilote.notifier(
        { title: "⏱️ Prolongations", body: `${match.homeTeamName} ${scoreHome} – ${scoreAway} ${match.awayTeamName}` },
        competition,
      );
      return;
    }
    if (suite === "tirs_au_but") {
      const ok = await demander({
        titre: "Égalité : tirs au but ?",
        corps: <>La séance se saisit tir par tir, ici même.</>,
        action: "Tirs au but",
      });
      if (!ok) return;
      appliquer(
        { jeu: seanceDeTirs(jeu), periode: 9, chrono: { arreterA: finDuJeu }, tirsAuBut: SEANCE_VIDE },
        "La séance de tirs au but n'a pas été ouverte",
      );
      pilote.notifier(
        { title: "🎯 Tirs au but", body: `${match.homeTeamName} ${scoreHome} – ${scoreAway} ${match.awayTeamName}` },
        competition,
      );
      return;
    }

    if (!finPossible()) return;
    try {
      await pilote.pauserChrono(finDuJeu);
    } catch {
      // Best-effort clock snap; the finish flow still freezes the clock.
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

  /** La pause entre les deux prolongations : l'autre équipe engagera. */
  const sifflerLaPauseDesProlongations = () => {
    appliquer(
      { jeu: pause(jeu, jeu.premier ? autre(jeu.premier) : null), periode: 7, chrono: { arreterA: fullMs + etMs } },
      "La pause n'a pas été enregistrée",
    );
    toast.success("Pause");
  };

  // ---- La séance de tirs au but -----------------------------------------------

  const seance: Seance = match?.liveState?.tirsAuBut ?? SEANCE_VIDE;
  const etatSeance = etatDeLaSeance(seance);
  /** Le tireur touché avant l'issue ; facultatif, comme pendant le match. */
  const [tireur, setTireur] = useState<LineupEntry | null>(null);
  const poserSeance = (suivante: Seance) =>
    appliquer({ tirsAuBut: suivante }, "Le tir n'a pas été enregistré");
  const tirer = (issue: Tir["issue"]) => {
    if (!etatSeance.prochain) return;
    poserSeance({
      ...seance,
      tirs: [...seance.tirs, {
        cote: etatSeance.prochain,
        issue,
        playerId: tireur?.playerId ?? null,
        playerName: tireur?.name ?? null,
      }],
    });
    setTireur(null);
  };

  const finishMatch = async (
    opts?: { penaltyHome: number; penaltyAway: number },
    mvp?: CandidatMVP | null,
  ) => {
    if (!finPossible()) return;
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
      demanderLeRecalculDuClassement();
      toast.success("Match terminé !");
      router.push(returnHref);
    } catch (err) {
      console.error("Comp match finish error:", err);
      toast.error("Erreur technique : " + (err instanceof Error ? err.message : "Inconnue"));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * L'ARRÊT DÉFINITIF, quand une équipe est sous le minimum de joueurs. En
   * compétition, le forfait donne 3–0 à l'adversaire, ou le score du moment
   * s'il lui est plus favorable, et le tableau avance comme pour un résultat
   * joué. En amical, le score du moment reste, le forfait est noté.
   */
  const arreterDefinitivement = async (forfaitDe: Side) => {
    if (!match) return;
    if (!finPossible()) return;
    const forfaitTeamId = forfaitDe === "home" ? match.homeTeamId : match.awayTeamId;
    if (!forfaitTeamId) return;
    const scoreActuel = { home: match.scoreHome ?? 0, away: match.scoreAway ?? 0 };
    const score = pilote.genre === "competition" ? scoreDeForfait(scoreActuel, forfaitDe) : scoreActuel;
    const ok = await demander({
      titre: `Arrêt définitif : forfait de ${nomDe(forfaitDe)} ?`,
      corps: (
        <>
          Score retenu {match.homeTeamName} {score.home} – {score.away} {match.awayTeamName}.
          {" "}Le match se termine et ne pourra plus reprendre.
        </>
      ),
      action: "Arrêter le match",
      danger: true,
    });
    if (!ok) return;
    setIsSubmitting(true);
    try {
      await pilote.arreterDefinitivement({ forfaitTeamId, score });
      pilote.notifier(
        {
          title: "🛑 Match arrêté",
          body: `${nomDe(forfaitDe)} n'a plus assez de joueurs. ${match.homeTeamName} ${score.home} – ${score.away} ${match.awayTeamName}`,
        },
        competition,
      );
      demanderLeRecalculDuClassement();
      toast.success("Match arrêté");
      router.push(returnHref);
    } catch (err) {
      console.error("Arrêt définitif :", err);
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
      toast.error("Saisis les tirs au but des deux équipes");
      return;
    }
    if (!Number.isInteger(ph) || !Number.isInteger(pa) || ph < 0 || pa < 0) {
      toast.error("Saisis des tirs au but valides");
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
    /** Chaque camp a le gardien qu'il lui faut, ou le match se joue sans. */
    const gardiensPrets = !gardienManquant("home") && !gardienManquant("away");
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
            {/* LA CASE DU GARDIEN, une pour tout le match : en petits poteaux,
                personne n'arrête le ballon à la main (voir lib/gardiens). Elle
                part avec le coup d'envoi. */}
            <label className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-gray-600">
              <input
                type="checkbox"
                checked={sansGardien}
                onChange={(e) => setCaseSansGardien(e.target.checked)}
                className="h-3.5 w-3.5 accent-emerald-600"
              />
              Sans gardien de but (petits poteaux)
            </label>
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
                    {/* Le gardien de la feuille, ou ce qui manque pour lancer. */}
                    {gardienExige(t.cote === "home" ? match.homeTeamId : match.awayTeamId, sansGardien) && (
                      <p className={`mt-0.5 truncate text-[11px] font-bold ${gardienManquant(t.cote) ? "text-amber-600" : "text-gray-500"}`}>
                        {gardienManquant(t.cote)
                          ? "Gardien à désigner"
                          : `🧤 ${gardienDeDepart(t.cote === "home" ? match.homeLineup : match.awayLineup)?.name ?? ""}`}
                      </p>
                    )}
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
                numeroDe={(p) => numeroDuJour("home", p)}
                onNumero={(pid, brut) => changerNumero("home", pid, brut)}
                onValidate={() => handleValidateSheet("home")}
                onDossards={pilote.ajouterDossards && dossardsRestants("home") ? () => tirerDossards("home") : undefined}
                avecGardien={gardienExige(match.homeTeamId, sansGardien)}
                gardienId={sansGardien ? null : gardienDeLaFeuille("home")}
                onGardien={(pid) => designerGardien("home", pid)}
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
                numeroDe={(p) => numeroDuJour("away", p)}
                onNumero={(pid, brut) => changerNumero("away", pid, brut)}
                onValidate={() => handleValidateSheet("away")}
                onDossards={pilote.ajouterDossards && dossardsRestants("away") ? () => tirerDossards("away") : undefined}
                avecGardien={gardienExige(match.awayTeamId, sansGardien)}
                gardienId={sansGardien ? null : gardienDeLaFeuille("away")}
                onGardien={(pid) => designerGardien("away", pid)}
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
          {lineupsReady && !gardiensPrets && (
            <div className="mb-2 flex items-center justify-center gap-2 text-amber-700">
              <AlertTriangle size={15} className="shrink-0 text-amber-500" />
              <p className="text-[11px] font-bold leading-tight">
                Désigne le gardien de chaque équipe, ou coche « Sans gardien ».
              </p>
            </div>
          )}
          <button
            onClick={handleLaunch}
            disabled={!lineupsReady || !gardiensPrets}
            className="group relative inline-flex w-full items-center justify-center gap-3 bg-gray-900 px-6 py-4 text-base font-black uppercase tracking-widest text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:text-lg"
          >
            <span className="relative">Aller au coup d&apos;envoi</span>
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
    ballonEnJeu,
    // Zéro, comme la pastille du ballon : ce panneau sert au scoreur à
    // vérifier ce qu'il vient de saisir. Voir lignesStats. Les passes aussi,
    // dès la première.
    0,
    0,
  );
  // Players who already have a yellow (for the picker marker). Player ids are unique.
  const yellowCardedIds = avertis(events);

  // Players currently on the pitch for a side (id ∈ on_pitch), resolved to lineup entries.
  const onPitchEntries = (side: Side): LineupEntry[] => surLaPelouse(
    side === "home" ? homeLineup : awayLineup,
    side === "home" ? match.homeOnPitch : match.awayOnPitch,
  );

  /**
   * La pelouse telle que le terrain la dessine : celui qui entre à la place de
   * celui qui sort, et le gardien en place au but (voir lignesSurLaPelouse).
   * Les listes de joueurs des questions, elles, restent dans l'ordre de la
   * feuille : `onPitchEntries`.
   */
  const pelouseDessinee = (side: Side): LineupEntry[] => lignesSurLaPelouse(
    side === "home" ? homeLineup : awayLineup,
    side === "home" ? match.homeOnPitch : match.awayOnPitch,
    events,
    side === "home" ? match.homeTeamId : match.awayTeamId,
    regleDuGardien && !sansGardien ? gardienDuCamp(side)?.playerId ?? null : undefined,
  );

  /**
   * Le banc : qui peut entrer. Les remplaçants en compétition, toute la
   * feuille sur un amical, jamais un exclu : voir lib/banc et le
   * `retourAutorise` du pilote.
   */
  const benchEntries = (side: Side): LineupEntry[] => leBanc(
    side === "home" ? homeLineup : awayLineup,
    side === "home" ? match.homeOnPitch : match.awayOnPitch,
    events,
    retourAutorise,
  );

  /**
   * Les actions proposées pour ce joueur, et le geste de chacune. QUOI
   * proposer, dans quel ordre et avec quel verrou : lib/actions-joueur.
   */
  const actionsPour = (side: Side, entry: LineupEntry): ActionJoueur[] => {
    const proposees = actionsDuJoueur({
      playerId: entry.playerId,
      cote: side,
      surLeTerrain: new Set(side === "home" ? match.homeOnPitch : match.awayOnPitch).has(entry.playerId),
      equipeConnue: (side === "home" ? match.homeTeamId : match.awayTeamId) != null,
      gardien: regleDuGardien
        ? { regle: "designe", enPlace: gardienDuCamp(side), sansGardien }
        : { regle: "poste", gardienId: gardienDe(side === "home" ? homeLineup : awayLineup)?.playerId ?? null },
      ballon: possession.side,
      verrou: verrouDuJeu,
    });
    return proposees.map((action) => {
      const { cle } = action;
      if (cle === "entrer" || cle === "remplacer") {
        return {
          ...action,
          onClick: () => {
            setActions(null);
            openSubModal(side, cle === "entrer" ? { entre: entry.playerId } : { sort: entry.playerId });
          },
        };
      }
      if (cle === "goal") {
        return {
          ...action,
          onClick: () => {
            if (verrouDuJeu) return;
            void enregistrerAction(side, entry, "goal");
          },
        };
      }
      return { ...action, onClick: () => void enregistrerAction(side, entry, cle) };
    });
  };

  // Le contenu du tiroir, posé en deux endroits selon l'écran (voir le rendu).
  const enTeteHistorique = (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <History className="text-white/40" size={16} />
        <h3 className="text-[12px] font-black uppercase tracking-wide text-white">Événements</h3>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
        {faitsRacontes.length} au total
      </span>
    </div>
  );
  const historique = (compact: boolean) => (
    <EventTimeline
      events={faitsRacontes}
      homeTeamId={match.homeTeamId}
      homeTeamName={match.homeTeamName}
      awayTeamName={match.awayTeamName}
      onVarVerdict={handleVarVerdict}
      varPendingId={varPendingId}
      onRetirer={(e) => void retirerEvenement(e.id, true)}
      compact={compact}
      dureeMiTemps={halfMinutes}
    />
  );
  const statistiques = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="text-white/40" size={16} />
        <h3 className="text-[12px] font-black uppercase tracking-wide text-white">Statistiques</h3>
      </div>
      {statRows.length > 0 ? (
        <MatchStats
          lignes={statRows}
          homeTeamName={match.homeTeamName}
          awayTeamName={match.awayTeamName}
          compact
          sombre
        />
      ) : (
        <p className="py-4 text-center text-[11px] font-bold uppercase tracking-widest text-white/30">
          Rien de compté pour l&apos;instant
        </p>
      )}
    </>
  );

  /** Le camp sous le minimum de joueurs, le match interrompu pour lui. */
  const campSousLeMinimum = jeu.raison === "interruption"
    ? campsSousLeMinimum({ home: match.homeOnPitch.length, away: match.awayOnPitch.length }, minimumJoueurs)[0] ?? null
    : null;

  // ---- Le déroulé, tel que le bandeau le montre --------------------------------

  const aDroite = autre(aGauche);
  const scoreDe = (c: Side) => (c === "home" ? match.scoreHome : match.scoreAway) ?? 0;
  /** En période de jeu : ni avant le coup d'envoi, ni à la pause. */
  const enPeriodeDeJeu = estUnePeriodeDeJeu(match.liveState?.currentPeriod);

  /** Ce que les pastilles des deux camps attendent, ballon mort : lib/deroule. */
  const attente = attenteDesCamps(jeu);

  const BOUTON_VERT =
    "flex max-w-[210px] items-center gap-1 bg-emerald-600 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-emerald-500 active:scale-95";
  const consigne = (texte: string) => (
    <span className="flex items-center px-1 text-[9px] font-black uppercase tracking-wider text-amber-300">
      {texte}
    </span>
  );
  const dernierPenalty = penaltiesEnAttente[penaltiesEnAttente.length - 1];

  /** Le bouton du déroulé, un seul à la fois : lib/deroule. */
  const bouton = boutonDuDeroule({
    jeu,
    periode: match.liveState?.currentPeriod,
    ballon: possession.side,
    penaltyEnAttente: dernierPenalty != null,
    // Tant que rien n'est arrivé : chrono jamais parti, aucun fait.
    // Après le premier engagement, ce sont les remplacements.
    feuillesRouvrables: events.length === 0 && !match.liveState?.isTimerRunning && !match.liveState?.timerOffset,
  });
  const boutonDuJeu = (() => {
    switch (bouton?.type) {
      case "arret_de_jeu":
        return (
          <button
            onClick={declarerArretDeJeu}
            className="flex items-center gap-1 bg-amber-500 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors hover:bg-amber-600 active:scale-95"
          >
            <Pause size={10} fill="currentColor" /> Arrêt de jeu
          </button>
        );
      case "avant":
        return (
          <>
            {consigne(CONSIGNE_ENGAGEMENT)}
            {bouton.feuilles && (
              <button
                onClick={handleRevenirAuxFeuilles}
                className="flex items-center gap-1 border border-white/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10"
              >
                <ClipboardList size={10} /> Feuilles
              </button>
            )}
            <button
              onClick={inverserLesCotes}
              aria-label="Inverser les côtés"
              className="flex items-center gap-1 border border-white/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/70 transition-colors hover:bg-white/10"
            >
              <ArrowLeftRight size={10} /> Côtés
            </button>
          </>
        );
      case "engagement":
        return (
          <button onClick={() => remettreEnJeu(bouton.camp)} className={BOUTON_VERT}>
            <Play size={10} fill="currentColor" className="shrink-0" />
            <span className="truncate">Engagement · {nomDe(bouton.camp)}</span>
          </button>
        );
      case "reprise":
        return (
          <button onClick={() => remettreEnJeu(bouton.camp)} className={BOUTON_VERT}>
            <Play size={10} fill="currentColor" className="shrink-0" /> Reprise
          </button>
        );
      case "penalty":
        return dernierPenalty ? (
          <button
            onClick={() => setPenaltyOuvert({
              eventId: dernierPenalty.id,
              side: dernierPenalty.teamId === match.homeTeamId ? "home" : "away",
              minute: dernierPenalty.minute,
              periode: dernierPenalty.period,
            })}
            className="flex items-center gap-1 bg-amber-400 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-[#0b1512] transition-colors hover:bg-amber-300"
          >
            {EMOJI_EVENEMENT.penalty} Penalty · Issue ?
          </button>
        ) : null;
      case "reprendre_le_match":
        return (
          <button onClick={reprendreApresInterruption} className={BOUTON_VERT}>
            <Play size={10} fill="currentColor" className="shrink-0" /> Reprendre le match
          </button>
        );
      case "consigne":
        return consigne(bouton.texte);
      default:
        return null;
    }
  })();

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
        <BandeauDEtat enLigne={enLigne} enAttente={enVol + retouches.length} consigne={consigneVisible} />
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

        {/* La sortie, et le score du camp de gauche. Le tableau suit les
            côtés : chacun lit son score au-dessus de son camp, même après
            l'inversion de la mi-temps. */}
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
            {nomDe(aGauche)}
          </span>
          <span className="shrink-0 text-2xl font-black leading-none tracking-tighter tabular-nums">
            {scoreDe(aGauche)}
          </span>
        </div>

        {/* Le centre : ce qu'on lit (la minute) et ce qui fait avancer le
            match. */}
        <div className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            {!isCompleted && <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />}
            <span className="text-[8px] font-black uppercase tracking-[0.15em] text-emerald-400">
              {isCompleted
                ? "Terminé"
                : jeu.raison === "avant"
                  ? "Avant-match"
                  : jeu.raison === "interruption"
                    ? "Interrompu"
                    : PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label || "Match"}
            </span>
            <span className="font-mono text-lg font-black leading-none tracking-tighter tabular-nums text-emerald-400">
              {formatTime(displayTime)}
            </span>
          </div>

          <div className="flex items-stretch gap-1">
            {!isCompleted && boutonDuJeu}

            {/* Le temps additionnel. L'arbitre annonce, le scoreur recopie ;
                passé ce temps, le bouton de fin de période clignote. */}
            {!isCompleted && mitempsEnCours && jeu.raison !== "avant" && (
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

            {/* LA FIN DE PÉRIODE NE S'IMPOSE PLUS : l'horloge continue au-delà
                du temps additionnel, et le bouton clignote jusqu'à ce que le
                scoreur siffle avec l'arbitre. */}
            {!isCompleted && match.liveState?.currentPeriod === 1 && jeu.raison !== "avant" && (
              <button
                onClick={() => void sifflerLaMiTemps()}
                disabled={isSubmitting}
                className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors disabled:opacity-40 ${
                  tempsEcoule ? "animate-pulse bg-amber-500 hover:bg-amber-600" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                Mi-temps
              </button>
            )}
            {!isCompleted && match.liveState?.currentPeriod === 6 && (
              <button
                onClick={sifflerLaPauseDesProlongations}
                disabled={isSubmitting}
                className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white transition-colors disabled:opacity-40 ${
                  tempsEcoule ? "animate-pulse bg-amber-500 hover:bg-amber-600" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                Pause
              </button>
            )}
            {!isCompleted && (match.liveState?.currentPeriod === 3 || match.liveState?.currentPeriod === 8) && (
              <button
                onClick={handleFinishClick}
                disabled={isSubmitting}
                className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-colors disabled:opacity-40 ${
                  tempsEcoule
                    ? "animate-pulse bg-amber-500 text-white hover:bg-amber-600"
                    : "border border-red-400/40 text-red-300 hover:bg-red-500/15"
                }`}
              >
                <CheckCircle2 size={11} /> Fin du match
              </button>
            )}
          </div>
        </div>

        {/* Le score du camp de droite, et ce qu'on ne saisit pas : le tiroir
            des compteurs, et le menu des gestes rares. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-2xl font-black leading-none tracking-tighter tabular-nums">
            {scoreDe(aDroite)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] font-black uppercase tracking-tight text-white/45">
            {nomDe(aDroite)}
          </span>
          {!isCompleted && !panneauFixe && (
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
          {!isCompleted && (
            <button
              type="button"
              onClick={() => setMenuOuvert((v) => !v)}
              aria-expanded={menuOuvert}
              aria-label="Plus de gestes"
              className="shrink-0 text-white/45 transition-colors hover:text-white"
            >
              <Ellipsis size={16} />
            </button>
          )}
        </div>

        {/* LES GESTES RARES, sortis du bandeau où la place manque couchée. */}
        {!isCompleted && menuOuvert && (
          <div className="absolute right-1 top-full z-30 mt-1 flex min-w-[190px] flex-col border border-white/15 bg-[#0A0A0B] py-1 shadow-2xl">
            {enPeriodeDeJeu && jeu.raison !== "avant" && jeu.raison !== "interruption" && (
              <button
                type="button"
                onClick={() => { setMenuOuvert(false); setRecalage(0); }}
                className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-white/80 hover:bg-white/10"
              >
                <Timer size={13} className="shrink-0" /> Recaler le chrono
              </button>
            )}
            {enPeriodeDeJeu && jeu.raison !== "avant" && jeu.raison !== "interruption" && (
              <button
                type="button"
                onClick={() => { setMenuOuvert(false); void interrompreLeMatch(); }}
                className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-white/80 hover:bg-white/10"
              >
                <CloudLightning size={13} className="shrink-0" /> Interrompre le match
              </button>
            )}
            <button
              type="button"
              onClick={() => { setMenuOuvert(false); inverserLesCotes(); }}
              className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-white/80 hover:bg-white/10"
            >
              <ArrowLeftRight size={13} className="shrink-0" /> Inverser les côtés
            </button>
            {/* LES DOSSARDS DU JOUR, en plein match : un numéro mal saisi se
                voit souvent au premier but. Pour ce match seulement. */}
            <button
              type="button"
              onClick={() => { setMenuOuvert(false); setDossardsOuverts(true); }}
              className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-white/80 hover:bg-white/10"
            >
              <Shirt size={13} className="shrink-0" /> Dossards
            </button>
            {/* LA CASE « SANS GARDIEN », après le coup d'envoi. Un petits poteaux
                peut démarrer case décochée — le manager avait mis un gardien
                sur sa feuille — : on la corrige ici, sans revenir aux feuilles.
                Les arrêts déjà saisis restent, l'historique les retire. */}
            <button
              type="button"
              onClick={() => {
                setMenuOuvert(false);
                const v = !sansGardien;
                suivre(pilote.poserSansGardien(v), "La case n'a pas été enregistrée");
                toast(v ? "Match sans gardien" : "Match avec gardien", { icon: "🧤" });
              }}
              className="flex items-center gap-2 px-3 py-2 text-left text-[11px] font-black uppercase tracking-wide text-white/80 hover:bg-white/10"
            >
              <Hand size={13} className="shrink-0" /> Sans gardien : {sansGardien ? "oui" : "non"}
            </button>
          </div>
        )}

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
                  setPenaltyOuvert({ eventId: p.id, side: cote, minute: p.minute, periode: p.period })
                }
                className="shrink-0 bg-amber-400 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#0b1512] transition-colors hover:bg-amber-300"
              >
                Penalty {ecrireMinute(p.period, p.minute)} ·{" "}
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
        <div className="min-h-0 flex-1 overflow-y-auto border border-white/10 bg-white/[0.04] p-5 sm:p-8">
          <div className="mb-4 flex items-center gap-3 sm:mb-6">
            <div className="flex h-10 w-10 items-center justify-center bg-emerald-500/15 text-emerald-300">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-white">Match terminé</h3>
              <p className="text-xs font-medium text-white/45">
                Score final {match.scoreHome ?? 0} – {match.scoreAway ?? 0}
              </p>
            </div>
          </div>
          <EventTimeline
            events={events}
            homeTeamId={match.homeTeamId}
            homeTeamName={match.homeTeamName}
            awayTeamName={match.awayTeamName}
            dureeMiTemps={halfMinutes}
          />
        </div>
      ) : (
        <>
          {/* Le terrain et ce qui n'est à personne. La possession avait sa
              propre rangée au-dessus : elle est passée DANS les onglets du
              terrain, qui portaient déjà les deux mêmes noms d'équipe. Voir
              TerrainConsole. */}
          {match.liveState?.currentPeriod === 9 ? (
            <SeanceDeTirs
              seance={seance}
              etat={etatSeance}
              nomDe={nomDe}
              tireurs={(c) => onPitchEntries(c)}
              tireur={tireur}
              onTireur={setTireur}
              onPremier={(c) => poserSeance({ premier: c, tirs: [] })}
              onTir={tirer}
              onAnnuler={() => poserSeance({ ...seance, tirs: seance.tirs.slice(0, -1) })}
              onValider={() => setMvpEnAttente({ tab: { penaltyHome: etatSeance.score.home, penaltyAway: etatSeance.score.away } })}
              onSaisieDirecte={() => {
                setPenaltyHome("");
                setPenaltyAway("");
                setShowPenaltyModal(true);
              }}
              isSubmitting={isSubmitting}
            />
          ) : (
          <div className="flex min-h-0 flex-1">
            <TerrainsFaceAFace
              home={{
                name: match.homeTeamName,
                surLeTerrain: homeDisabled ? [] : pelouseDessinee("home"),
                banc: homeDisabled ? [] : benchEntries("home"),
                formation: match.homeFormation,
                couleurs: couleurs?.home,
              }}
              away={{
                name: match.awayTeamName,
                surLeTerrain: awayDisabled ? [] : pelouseDessinee("away"),
                banc: awayDisabled ? [] : benchEntries("away"),
                formation: match.awayFormation,
                couleurs: couleurs?.away,
              }}
              jaunes={yellowCardedIds}
              ballon={possession.side}
              parts={partPossession(possession, ballonEnJeu, Date.now(), 0)}
              passes={{ home: possession.homePasses, away: possession.awayPasses }}
              ballonActif={ballonEnJeu}
              // Ballon mort, toucher un camp le remet en jeu par lui ; ballon
              // en jeu, il lui donne le ballon. Voir `remettreEnJeu`.
              onBallon={(c) => (c === null ? basculerPossession(null) : remettreEnJeu(c))}
              aGauche={aGauche}
              attente={attente}
              onJoueur={(side, entry) => setActions({ side, entry })}
              // UNE BARRE PAR CAMP, et non une seule pour « le camp affiché » :
              // le corner de gauche est le corner de gauche, il n'y a plus
              // rien à vérifier avant d'appuyer.
              actions={(cote) => (
                <BandeauEquipe
                  isSubmitting={isSubmitting}
                  desactive={verrouDuJeu}
                  onEvenement={(type) => void enregistrerEvenementEquipe(cote, type)}
                />
              )}
            />
          </div>
          )}

          {/* LE TIROIR « PLUS D'INFOS ».

              Ces deux cartes ne servent pas à SAISIR. On les consulte entre
              deux actions, ou après le match — et elles pesaient sept cent
              cinquante pixels sous le terrain, en permanence, sur un écran de
              téléphone qui en fait huit cents.

              SUR TÉLÉPHONE, ELLES RECOUVRENT, le temps qu'on les lise : couché,
              tout ce qui s'insère prend sa hauteur au terrain. SUR GRAND
              ÉCRAN, ELLES SONT POSÉES SOUS LES TERRAINS, en permanence : la
              place y était, vide. Voir `panneauFixe`. */}
          {panneauFixe ? (
            <div className="grid h-56 shrink-0 grid-cols-[3fr_2fr] gap-2 border-t border-white/10 p-2">
              <div className="min-h-0 overflow-y-auto border border-white/10 bg-white/[0.04] p-3">
                {enTeteHistorique}
                {historique(true)}
              </div>
              <div className="min-h-0 overflow-y-auto border border-white/10 bg-white/[0.04] p-3">
                {statistiques}
              </div>
            </div>
          ) : (
            <div
              className={`absolute inset-0 z-20 space-y-3 overflow-y-auto bg-[#0b1512]/95 p-2 backdrop-blur-sm ${
                plusDInfos ? "" : "hidden"
              }`}
            >
              <div className="border border-white/10 bg-white/[0.04] p-3 sm:p-5">
                {enTeteHistorique}
                {historique(false)}
              </div>
              {statRows.length > 0 && (
                <div className="border border-white/10 bg-white/[0.04] p-3 sm:p-5">{statistiques}</div>
              )}
            </div>
          )}
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
            minute={minuteLue}
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
            sousTitre={`${minuteLue} · Sur qui ?`}
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

      {/* Les cages vides : qui prend les gants ? Facultative — un gardien
          remplaçant peut encore entrer, et l'action reste sur chaque joueur. */}
      <AnimatePresence>
        {gantsAPrendre && (
          <PlayerPickerModal
            titre="Qui prend les gants ?"
            sousTitre={`${minuteLue} · Les cages sont vides`}
            teamName={gantsAPrendre.side === "home" ? match.homeTeamName : match.awayTeamName}
            entries={onPitchEntries(gantsAPrendre.side).filter((e) => e.playerId !== gantsAPrendre.sortant)}
            yellowSet={yellowCardedIds}
            isSubmitting={isSubmitting}
            onPick={(e) => {
              const { side } = gantsAPrendre;
              setGantsAPrendre(null);
              enregistrerAction(side, e, "gants");
            }}
            onClose={() => setGantsAPrendre(null)}
            ignorer="Un remplaçant va entrer"
          />
        )}
      </AnimatePresence>

      {/* Passer on the goal just scored, skippable, and the scorer is out. */}
      <AnimatePresence>
        {assistPicker && (
          <PlayerPickerModal
            titre="Passe décisive"
            sousTitre={`${minuteLue} · Qui a servi ${assistPicker.scorerName} ?`}
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

      {/* LA FAUTE DU PENALTY : qui l'a commise, puis quel carton. Chaque
          question se passe ; fermer saute directement à l'issue. */}
      <AnimatePresence>
        {fautePenalty && !fautePenalty.fautif && (
          <PlayerPickerModal
            titre="Penalty · Faute de qui ?"
            sousTitre={`${ecrireMinute(fautePenalty.periode, fautePenalty.minute)} · Pour ${nomDe(fautePenalty.side)}`}
            teamName={nomDe(autre(fautePenalty.side))}
            entries={onPitchEntries(autre(fautePenalty.side))}
            yellowSet={yellowCardedIds}
            isSubmitting={isSubmitting}
            onPick={poserFautifPenalty}
            onClose={() => ouvrirIssuePenalty(fautePenalty)}
            ignorer="Je ne sais pas"
            onIgnorer={() => ouvrirIssuePenalty(fautePenalty)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {fautePenalty?.fautif && (
          <ModaleCartonPenalty
            fautif={fautePenalty.fautif}
            dejaAverti={yellowCardedIds.has(fautePenalty.fautif.playerId)}
            isSubmitting={isSubmitting}
            onCarton={sanctionnerPenalty}
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
            minute={ecrireMinute(penaltyOuvert.periode, penaltyOuvert.minute)}
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
            sousTitre={`${ecrireMinute(penaltyOuvert.periode, penaltyOuvert.minute)} · Qui l'a tiré ?`}
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
              sousTitre={`${minuteLue} · À la place de ${
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
              sousTitre={`${minuteLue} · Pour faire entrer ${
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
            candidats={classerCandidatsMVP(match, pilote.campsEligiblesMVP(), dureeJoueeMin)}
            homeTeamId={match.homeTeamId}
            homeTeamName={match.homeTeamName}
            awayTeamName={match.awayTeamName}
            feminine={competition?.category === "women"}
            isSubmitting={isSubmitting}
            onChoisir={(c) => { const t = mvpEnAttente.tab; setMvpEnAttente(null); void finishMatch(t, c); }}
            onPasser={() => { const t = mvpEnAttente.tab; setMvpEnAttente(null); void finishMatch(t, null); }}
          />
        )}
      </AnimatePresence>

      {/* Les dossards du jour, ouverts depuis le menu du direct. */}
      <AnimatePresence>
        {dossardsOuverts && match && !isCompleted && (
          <ModaleDossards
            homeTeamName={match.homeTeamName}
            awayTeamName={match.awayTeamName}
            homeLineup={match.homeLineup}
            awayLineup={match.awayLineup}
            onFermer={() => setDossardsOuverts(false)}
            onEnregistrer={enregistrerDossards}
          />
        )}
      </AnimatePresence>

      {/* SOUS LE MINIMUM DE JOUEURS : le match est interrompu, et il faut
          trancher. */}
      <AnimatePresence>
        {!isCompleted && campSousLeMinimum && !alerteMinimumFermee && (
          <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              style={{ maxHeight: "calc(var(--console-h, 100dvh) - 2rem)" }}
              className="relative w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl"
            >
              <h2 className="text-lg font-black text-gray-900">Le match ne peut pas continuer</h2>
              <p className="mt-1 text-sm font-medium text-gray-500">
                {`${nomDe(campSousLeMinimum)} n'a plus que ${
                  (campSousLeMinimum === "home" ? match.homeOnPitch : match.awayOnPitch).length
                } joueurs sur le terrain, pour un minimum de ${minimumJoueurs}. Le match est interrompu.`}
              </p>
              <div className="mt-4 grid gap-2">
                {isOrganizer ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void arreterDefinitivement(campSousLeMinimum)}
                    className="bg-red-600 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-red-700 disabled:opacity-40"
                  >
                    {`Arrêt définitif · forfait de ${nomDe(campSousLeMinimum)}`}
                  </button>
                ) : (
                  <p className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    Seul l&apos;organisateur peut prononcer l&apos;arrêt définitif : appelle-le.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setAlerteMinimumFermee(true)}
                  className="border border-gray-200 py-3 text-xs font-black uppercase tracking-widest text-gray-600 transition-colors hover:bg-gray-50"
                >
                  Erreur de saisie : corriger
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* RECALER LE CHRONO sur la montre de l'arbitre. */}
      <AnimatePresence>
        {recalage !== null && (
          <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRecalage(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-white p-5 shadow-2xl"
            >
              <h2 className="text-lg font-black text-gray-900">Recaler le chrono</h2>
              <p className="mt-0.5 text-xs font-bold text-gray-400">
                Ajuste jusqu&apos;à lire la montre de l&apos;arbitre.
              </p>
              <p className="my-4 text-center font-mono text-4xl font-black tabular-nums text-gray-900">
                {formatTime(Math.max(debutDePeriode, displayTime + recalage))}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[-60_000, -10_000, 10_000, 60_000].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRecalage((r) => (r ?? 0) + d)}
                    className="border border-gray-200 py-3 text-sm font-black tabular-nums text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    {d > 0 ? "+" : "−"}{Math.abs(d) >= 60_000 ? "1′" : "10″"}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRecalage(null)}
                  className="border border-gray-200 py-3 text-xs font-black uppercase tracking-widest text-gray-500 transition-colors hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={appliquerRecalage}
                  disabled={recalage === 0}
                  className="bg-gray-900 py-3 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-black disabled:opacity-40"
                >
                  Appliquer
                </button>
              </div>
            </motion.div>
          </div>
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

