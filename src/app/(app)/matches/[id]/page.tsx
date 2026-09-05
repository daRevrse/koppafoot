"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Activity, Clock, UserPlus, Info,
  CheckCircle2, XCircle, AlertCircle,
  Star, Save, ClipboardList, RefreshCcw, BarChart2, Loader2
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
  getGhostPlayersByTeam, getTeamsIManage, creditGhostMatchStats,
  tailleEffectif,
} from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import { normaliserPoste, INITIALE_POSTE, LIBELLE_POSTE, POSTES, type Poste } from "@/lib/postes";
import type { Match, Participation, Team, FirestoreMatch, FirestoreParticipation, UserProfile, GhostPlayer, LineupEntry } from "@/types";
import MatchHero, { type HeroStatus } from "@/components/match/MatchHero";
import MatchTabs from "@/components/match/MatchTabs";
import MatchInfoList, { type MatchInfo } from "@/components/match/MatchInfoList";
import MatchTimeline from "@/components/match/MatchTimeline";
import MatchLineups from "@/components/match/MatchLineups";
import TerrainCompo from "@/components/match/TerrainCompo";
import { dispositif } from "@/lib/terrain";
import PredictionPoll from "@/components/match/PredictionPoll";
import MatchModerators from "@/components/match/MatchModerators";

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
  // Deux onglets, et le MÊME vocabulaire que sur une fiche de compétition :
  // « Résumé » et « Composition ». Il y en avait trois — Informations, Match
  // Center, Feuille de Match — dont un, Informations, ne contenait que la
  // date, le terrain et l'arbitre. Ces trois faits ouvrent maintenant le
  // résumé (MatchInfoList), ce qui règle du même coup le problème que
  // l'onglet Informations existait pour contourner : le Match Center d'un
  // match à venir était une coquille, il fallait donc ouvrir la fiche
  // ailleurs selon l'état du match. Le résumé n'est plus jamais vide.
  const [activeTab, setActiveTab] = useState<"center" | "squad">("center");
  const [displayTime, setDisplayTime] = useState(0);
  const [inviting, setInviting] = useState(false);
  const [lineupMode, setLineupMode] = useState(false);
  /**
   * La feuille en cours de saisie, avant validation.
   *
   * Le POSTE s'y ajoute : le manager le choisit match par match, et rien ne
   * l'oblige à reprendre le poste naturel du joueur (voir `match_position`).
   * C'est lui qui place les maillots sur le terrain de l'éditeur.
   */
  const [tempAssignments, setTempAssignments] = useState<Record<string, {
    squadNumber: string;
    /**
     * « out » = RETIRÉ DE LA FEUILLE, ni titulaire ni remplaçant.
     *
     * Il manquait, et un manager ne pouvait donc pas laisser un joueur de
     * côté : tout l'effectif confirmé partait sur la feuille, au mieux sur le
     * banc. Or une feuille de match est un choix — on ne convoque pas
     * quatorze personnes pour un 4v4.
     *
     * Le stockage sait déjà le faire : `updateMatchLineup` efface le rôle de
     * tout le monde avant de le reposer sur ceux qu'on lui passe, si bien
     * qu'un joueur absent de la liste sort de la feuille de lui-même.
     */
    role: "starter" | "substitute" | "out";
    position: Poste | null;
  }>>({});
  const [savingLineup, setSavingLineup] = useState(false);
  const [repondEnCours, setRepondEnCours] = useState(false);
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

  /**
   * L'AFFICHE DU MATCH, TÉLÉCHARGÉE D'AVANCE.
   *
   * `navigator.share` exige une activation utilisateur fraîche : aller
   * chercher l'image au moment du clic la consomme, et le partage est refusé
   * sans rien dire (voir lib/partage). On la prépare donc dès que le match
   * est connu, et le bouton n'a plus qu'à la tendre.
   *
   * Un `ref` et non un état : sa présence ne change rien à l'écran, et un
   * rendu de plus pour une image qu'on ne montre pas ne sert à rien.
   */
  const afficheDuMatch = useRef<File | null>(null);
  // Attribution des stats d'un amical fantôme : irréversible, donc en deux
  // temps. Un bouton unique se clique par réflexe, et rien ne se déduit
  // ensuite d'un compteur de carrière.
  const [confirmerCredit, setConfirmerCredit] = useState(false);
  const [creditEnCours, setCreditEnCours] = useState(false);

  // 1. Check Roles & IDs
  //
  // ON NE COMPARE PLUS DES UID, ON REGARDE LES ÉQUIPES. Tout ce bloc partait
  // de `manager_id` : un membre du staff délégué, qui a pourtant les droits du
  // manager sur l'équipe, n'était donc personne sur cette page — ni feuille de
  // match, ni score, ni fin de rencontre. Or c'est souvent lui qui est au bord
  // du terrain. La question n'est pas « es-tu le manager du match » mais
  // « l'une des deux équipes est-elle une des tiennes ».
  const [mesEquipesIds, setMesEquipesIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) { setMesEquipesIds([]); return; }
    let annule = false;
    getTeamsIManage(user.uid)
      .then((equipes) => { if (!annule) setMesEquipesIds(equipes.map((e) => e.id)); })
      .catch(() => { if (!annule) setMesEquipesIds([]); });
    return () => { annule = true; };
  }, [user?.uid]);

  // `is_home` dit si le CRÉATEUR du match joue à domicile. Sans ça on
  // assimilait manager_id à l'équipe domicile, ce qui inversait les deux camps
  // dès qu'un manager planifiait un déplacement : feuille de match, numéros et
  // drapeau « compo prête » atterrissaient chez l'adversaire.
  const myTeamId = useMemo(() => {
    if (!match || !user) return null;
    // Les équipes qu'on gère d'abord : c'est le cas du staff délégué, et celui
    // du manager dont l'équipe est bien la sienne.
    if (mesEquipesIds.includes(match.homeTeamId)) return match.homeTeamId;
    if (mesEquipesIds.includes(match.awayTeamId)) return match.awayTeamId;
    // Repli sur le match lui-même : un manager reste maître de SON match même
    // si l'équipe a changé de mains depuis, ou si la liste n'est pas encore
    // chargée.
    if (user.uid === match.managerId) return match.isHome ? match.homeTeamId : match.awayTeamId;
    if (user.uid === match.awayManagerId) return match.isHome ? match.awayTeamId : match.homeTeamId;
    return null;
  }, [match, user, mesEquipesIds]);

  const myTeamIsHome = useMemo(
    () => !!match && !!myTeamId && myTeamId === match.homeTeamId,
    [match, myTeamId],
  );

  const isManager = useMemo(() => !!myTeamId, [myTeamId]);
  /**
   * Un amical contre une équipe hors plateforme : personne en face, donc rien
   * à contresigner. Le statut de validation existe toujours en base (voir
   * /api/matches/complete) mais il n'a aucun destinataire, on ne l'affiche pas.
   */
  const estAmical = useMemo(() => !!match && !match.awayManagerId, [match]);

  const isHomeManager = useMemo(() => myTeamIsHome, [myTeamIsHome]);

  const isMyTeamReady = useMemo(() => {
    if (!match || !user || !myTeamId) return false;
    return myTeamIsHome ? match.homeLineupReady : match.awayLineupReady;
  }, [match, user, myTeamId, myTeamIsHome]);

  /** De quel côté joue l'équipe hors plateforme, s'il y en a une. */
  const ghostIsHome = useMemo(
    () => !!match && estAmical && !match.isHome,
    [match, estAmical],
  );

  /** Les mêmes que le garde de la console (voir matches/[id]/manage). */
  const peutTenirLaConsole = useMemo(() => {
    if (!match || !user) return false;
    return (
      isManager ||
      user.uid === match.managerId ||
      user.uid === match.awayManagerId ||
      (match.moderatorIds ?? []).includes(user.uid) ||
      (match.refereeId === user.uid && match.refereeStatus === "confirmed")
    );
  }, [match, user, isManager]);

  /**
   * L'équipe hors plateforme, et comment nommer ce qu'elle fait.
   *
   * Ses joueurs s'appellent « Joueur 1 » à « Joueur 11 » et le resteront : on
   * ne compose pas l'effectif d'un adversaire qui n'a pas de compte. « Joueur 9
   * — carton jaune » n'apprend donc rien à personne. Le nom du club, lui, dit
   * ce qu'il y a à dire.
   *
   * Ne concerne QUE ce camp : les joueurs sans compte de sa propre équipe
   * portent de vrais noms, ce sont les siens.
   */
  const idEquipeFantome = useMemo(() => {
    if (!match || !estAmical) return null;
    return ghostIsHome ? match.homeTeamId : match.awayTeamId;
  }, [match, estAmical, ghostIsHome]);

  const auteurDeLEvenement = (teamId: string, playerName?: string): string => {
    if (idEquipeFantome && teamId === idEquipeFantome) {
      return ghostIsHome ? match!.homeTeamName : match!.awayTeamName;
    }
    return playerName || "Action";
  };

  /** Les joueurs sans compte de MON camp, tels qu'enregistrés sur ce match. */
  const mesEntreesSansCompte = useMemo(
    () => (!match ? [] : myTeamIsHome ? match.homeGhostLineup : match.awayGhostLineup),
    [match, myTeamIsHome],
  );

  /**
   * MON EFFECTIF DE MATCH, en une seule liste : ceux qui ont un compte et ont
   * confirmé, et ceux qui n'en ont pas.
   *
   * L'éditeur de feuille ne montrait que les seconds. Les premiers avaient
   * leurs sélecteurs ailleurs, dans les colonnes de convocation plus bas — que
   * l'auto-acceptation, désormais active par défaut, masque entièrement. La
   * feuille se remplit donc ici, pour tout le monde, ou pour personne.
   *
   * `posteNaturel` n'est qu'une valeur de départ : il vient du profil du joueur
   * (ou de sa fiche, pour un joueur sans compte) et le manager en fait ce
   * qu'il veut — un milieu peut prendre les gants d'un match.
   */
  const monEffectifDeMatch = useMemo(() => {
    if (!myTeamId) return [];
    const avecCompte = participations
      .filter((p) => p.teamId === myTeamId && p.status === "confirmed")
      .map((p) => ({
        id: p.playerId,
        nom: p.playerName,
        sansCompte: false,
        dossardParDefaut: p.squadNumber || myTeam?.squadNumbers?.[p.playerId] || "",
        posteEnregistre: p.matchPosition ?? null,
        posteNaturel: normaliserPoste(
          teamMembers.find((m) => m.uid === p.playerId)?.position,
        ),
        roleEnregistre: p.matchRole ?? null,
      }));
    const sansCompte = ghostPlayers.map((g) => {
      const dejaPose = mesEntreesSansCompte.find((e) => e.playerId === g.id);
      return {
        id: g.id,
        nom: `${g.firstName} ${g.lastName}`.trim(),
        sansCompte: true,
        dossardParDefaut: dejaPose?.number || g.squadNumber || "",
        posteEnregistre: dejaPose?.position ?? null,
        posteNaturel: normaliserPoste(g.position),
        roleEnregistre: dejaPose?.role ?? null,
      };
    });
    return [...avecCompte, ...sansCompte];
  }, [myTeamId, participations, ghostPlayers, mesEntreesSansCompte, myTeam, teamMembers]);

  /**
   * La feuille en cours, sous la forme que le terrain sait lire. Elle suit la
   * saisie au caractère près : c'est tout l'intérêt d'un terrain dans
   * l'éditeur — voir le 4-4-2 se former, plutôt que valider et découvrir.
   */
  const compoEnCours = useMemo<LineupEntry[]>(
    () => monEffectifDeMatch.flatMap((j) => {
      const a = tempAssignments[j.id];
      // Un joueur retiré ne fait pas partie de la feuille : il ne se dessine
      // pas sur le terrain, ne compte pas dans les titulaires, et ne part pas
      // à l'enregistrement. Il reste dans la LISTE de l'éditeur, pour qu'on
      // puisse le rappeler.
      if (a?.role === "out") return [];
      return [{
        playerId: j.id,
        name: j.nom,
        number: a?.squadNumber ?? j.dossardParDefaut,
        role: a?.role ?? "starter",
        position: a?.position ?? null,
      }];
    }),
    [monEffectifDeMatch, tempAssignments],
  );

  /** Ceux qui commencent le match, dans la feuille en cours de saisie. */
  const titulairesEnCours = useMemo(
    () => compoEnCours.filter((e) => e.role === "starter"),
    [compoEnCours],
  );

  /**
   * LE TYPE DE JEU COMMANDE LA CONFIGURATION TACTIQUE.
   *
   * `taille` est le N du match : un 4v4 aligne quatre joueurs, gardien
   * compris, pas onze. L'éditeur l'ignorait — il ouvrait avec TOUT l'effectif
   * en titulaire et laissait valider une feuille de douze titulaires pour un
   * match à quatre, que le terrain dessinait ensuite tant bien que mal.
   *
   * `formeAttendue` est la forme de référence de ce NvN (voir lib/terrain, la
   * même table qui place les maillots) : elle ne dicte aucune tactique —
   * personne ne saisit la sienne — mais elle dit au manager combien de
   * défenseurs, de milieux et d'attaquants tient un match de cette taille.
   */
  const tailleDuMatch = tailleEffectif(match?.format);
  const onzeComplet = titulairesEnCours.length >= tailleDuMatch;
  const formeAttendue = useMemo(() => {
    const [d, m, a] = dispositif(tailleDuMatch);
    return { goalkeeper: Math.min(1, tailleDuMatch), defender: d, midfielder: m, forward: a };
  }, [tailleDuMatch]);

  /** Combien de titulaires à chaque poste, dans la feuille en cours. */
  const posesParPoste = useMemo(() => {
    const compte: Record<string, number> = {
      goalkeeper: 0, defender: 0, midfielder: 0, forward: 0,
    };
    for (const e of titulairesEnCours) {
      if (e.position) compte[e.position] += 1;
    }
    return compte;
  }, [titulairesEnCours]);

  /**
   * Les dossards qu'un joueur avec un compte occupe déjà. Un fantôme qui tombe
   * dessus perdra le sien à l'enregistrement (voir updateMatchLineup) : autant
   * le dire tout de suite, sur sa ligne, pendant qu'on peut encore en changer.
   */
  const dossardsPrisParLesComptes = useMemo(() => {
    const pris = new Set<string>();
    for (const j of monEffectifDeMatch) {
      if (j.sansCompte) continue;
      const n = (tempAssignments[j.id]?.squadNumber ?? j.dossardParDefaut).trim();
      if (n !== "") pris.add(n);
    }
    return pris;
  }, [monEffectifDeMatch, tempAssignments]);

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
  //
  // `user` EST UNE CONDITION, pas un confort : les règles Firestore ne
  // laissent lire `participations` qu'à un compte authentifié. Depuis que la
  // fiche s'ouvre aux invités, brancher l'écoute sans compte ne remplirait
  // rien et laisserait une erreur de permission dans la console à chaque
  // lien partagé.
  useEffect(() => {
    if (!id || !user) { setParticipations([]); return; }
    const q = query(collection(db, "participations"), where("match_id", "==", id));
    const unsub = onSnapshot(q, (snap) => {
      const parts = snap.docs.map(d => toParticipation(d.id, d.data() as FirestoreParticipation));
      setParticipations(parts);
    });
    return () => unsub();
  }, [id, user]);

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

  // Les joueurs sans compte de MA propre équipe. Rien à voir avec l'adversaire
  // hors plateforme : ce sont mes joueurs, ceux qui n'ont pas de smartphone, et
  // ils doivent figurer sur ma feuille de match comme les autres. Certaines
  // équipes n'ont même que ceux-là.
  useEffect(() => {
    if (!myTeamId) { setGhostPlayers([]); return; }
    getGhostPlayersByTeam(myTeamId).then(setGhostPlayers).catch(console.error);
  }, [myTeamId]);

  // L'affiche, préparée pendant qu'on lit la fiche. Silencieuse en cas
  // d'échec : le partage retombe alors sur le lien seul, ce qu'il a toujours
  // fait — une image manquante ne doit pas coûter le partage.
  useEffect(() => {
    if (!id) return;
    let vivant = true;
    afficheDuMatch.current = null;
    (async () => {
      try {
        const reponse = await fetch(`/api/matches/${id}/affiche`);
        if (!reponse.ok) return;
        const png = await reponse.blob();
        if (!vivant) return;
        afficheDuMatch.current = new File([png], `koppafoot-${id}.png`, { type: "image/png" });
      } catch {
        // Hors ligne, ou route indisponible : on partagera le lien seul.
      }
    })();
    return () => { vivant = false; };
  }, [id]);


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

  /**
   * La composition d'un camp, pour le terrain.
   *
   * Un amical mélange deux sources : les joueurs AVEC un compte, qui vivent
   * dans `participations` et n'y figurent qu'une fois leur présence
   * confirmée ; et ceux SANS compte, posés directement sur le match par leur
   * manager (`home_ghost_lineup`). Les deux tiennent la même place sur le
   * terrain, ils sont donc ramenés à la même forme.
   */
  const compoDeLEquipe = (teamId: string, fantomes: LineupEntry[]): LineupEntry[] => {
    /**
     * UN JOUEUR RETIRÉ DE LA FEUILLE N'EST PAS SUR LE TERRAIN.
     *
     * Son rôle est vide, et le repli sur « titulaire » quelques lignes plus
     * bas le remettait dans la composition : le retrait s'annulait tout
     * seul, et le manager retrouvait sur la fiche le joueur qu'il venait
     * d'écarter.
     *
     * Le repli garde du sens TANT QU'AUCUNE FEUILLE N'A ÉTÉ VALIDÉE : il n'y
     * a alors pas de composition, et la fiche montre qui a confirmé sa
     * présence — ce qui est l'information du moment. Une fois la feuille
     * validée, un rôle vide est un choix, pas un manque.
     */
    const feuilleValidee = teamId === match?.homeTeamId
      ? match?.homeLineupReady
      : match?.awayLineupReady;

    return [
      ...participations
        .filter((p) => p.teamId === teamId && p.status === "confirmed")
        .filter((p) => (feuilleValidee ? p.matchRole != null : true))
        .map((p) => ({
          playerId: p.playerId,
          name: p.playerName,
          number: p.squadNumber || "",
          role: p.matchRole ?? "starter",
          // Le poste que le manager a choisi pour CE match. On ne retombe pas
          // sur le poste naturel du joueur faute de mieux : le terrain sait
          // placer une ligne sans poste, et il ne doit pas annoncer un gardien
          // que personne n'a désigné (voir lib/terrain).
          position: p.matchPosition ?? null,
        })),
      // Les joueurs sans compte retirés ne sont déjà plus là : la validation
      // réécrit `*_ghost_lineup` avec les seuls joueurs retenus.
      ...fantomes,
    ];
  };

  // 6. Actions

  /**
   * Partager le match.
   *
   * Le texte suit l'état de la rencontre : on n'envoie pas la même chose
   * avant le coup d'envoi, pendant, et une fois le score connu. Un message
   * unique du genre « Regarde ce match » obligerait le destinataire à ouvrir
   * le lien pour savoir s'il est encore temps de venir.
   */
  const partagerLeMatch = async () => {
    if (!match) return;
    const affiche = `${match.homeTeamName} — ${match.awayTeamName}`;
    const score = `${match.scoreHome ?? 0}-${match.scoreAway ?? 0}`;
    const ou = [match.venueName, match.venueCity].filter(Boolean).join(", ");

    const text =
      match.status === "live"
        ? `${affiche}, ${score} en direct sur KoppaFoot`
        : match.status === "completed"
          ? `${affiche}, score final ${score}`
          : `${affiche}, le ${match.date}${match.time ? ` à ${match.time}` : ""}${ou ? ` — ${ou}` : ""}`;

    const resultat = await partagerLien({
      title: affiche,
      text,
      url: lienAbsolu(`/matches/${match.id}`),
      // Préparée au chargement, voir plus haut : la chercher ici coûterait
      // l'activation utilisateur, donc le partage lui-même.
      fichier: afficheDuMatch.current,
    });
    if (resultat === "copie") toast.success("Lien du match copié !");
    else if (resultat === "echec") toast.error("Le partage a échoué.");
  };

  /**
   * Répondre à sa convocation.
   *
   * `handleJoin` créait une NOUVELLE participation : c'était le geste d'un
   * manager qui s'ajoute lui-même à la feuille, pas celui d'un joueur qui
   * répond. Un convoqué en a déjà une, il faut la mettre à jour — sans quoi
   * les compteurs de confirmation ne bougeaient jamais.
   */
  const handleRepondreConvocation = async (accepte: boolean) => {
    if (!match || !myParticipation) return;
    setRepondEnCours(true);
    try {
      await respondToParticipation(
        myParticipation.id, accepte,
        match.id, myParticipation.teamId, match.format, myParticipation.isHome,
      );
      toast.success(accepte ? "Présence confirmée" : "Absence enregistrée");
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'enregistrer ta réponse");
    } finally {
      setRepondEnCours(false);
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

  // Il ne reste ici que ce que le tableau d'affichage ne porte pas : qui
  // arbitre, et a combien on joue. La date, l'heure et le terrain sont dans le
  // hero, une seule fois. Ils etaient auparavant ecrits DEUX fois — l'onglet
  // « Informations » et le rail — et se contredisaient deja : l'onglet
  // annoncait « Arbitre Officiel » quand personne n'etait designe.
  const infoDuMatch: MatchInfo = {
    format: match.format,
    referee: { name: match.refereeName, confirmed: match.refereeStatus === "confirmed" },
  };

  return (
    <div className="pb-24">
      {/* Le tableau d'affichage, partage avec la fiche de competition. Il porte
          le fil d'ariane, le contexte, le lieu, la date et le pronostic. */}
      <MatchHero
        fil={[
          { label: "Direct", href: "/" },
          { label: "Amicaux", href: "/matches" },
          { label: `${match.homeTeamName}, ${match.awayTeamName}` },
        ]}
        onShare={partagerLeMatch}
        context={{
          label: estAmical ? "Match amical" : "Défi",
          sub: match.format,
        }}
        status={match.status as HeroStatus}
        home={{
          name: match.homeTeamName, logo: match.homeTeamLogo ?? null, score: match.scoreHome,
          href: match.homeTeamId ? `/teams/${match.homeTeamId}` : null,
        }}
        away={{
          name: match.awayTeamName, logo: match.awayTeamLogo ?? null, score: match.scoreAway,
          href: match.awayTeamId ? `/teams/${match.awayTeamId}` : null,
        }}
        date={match.date}
        time={match.time}
        venueName={match.venueName}
        venueCity={match.venueCity}
        // « Terminé » l'emporte sur la période : un match fini gardait sinon le
        // libellé de la derniere periode traversee, qui se lit comme un match
        // encore en cours.
        periodLabel={
          match.status === "completed"
            ? "Terminé"
            : PERIODS.find(p => p.id === match.liveState?.currentPeriod)?.label
        }
        clock={isLive && match.liveState ? formatTime(displayTime) : null}
        penaltyHome={match.penaltyHome}
        penaltyAway={match.penaltyAway}
        badges={match.status === "completed" && !estAmical ? (
          <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${
            match.validationStatus === 'validated' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            match.validationStatus === 'contested' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
            match.validationStatus === 'unverified' ? 'bg-white/5 border-white/15 text-gray-300' :
            'bg-amber-500/10 border-amber-500/20 text-amber-400'
          }`}>
            {match.validationStatus === 'validated' ? <CheckCircle2 size={10} /> :
             match.validationStatus === 'contested' ? <AlertCircle size={10} /> :
             match.validationStatus === 'unverified' ? <Info size={10} /> : <Clock size={10} />}
            <span className="text-[10px] font-black uppercase tracking-[0.14em]">
              {match.validationStatus === 'validated' ? 'Validé' :
               match.validationStatus === 'contested' ? 'Contesté' :
               match.validationStatus === 'unverified' ? 'Non vérifié' : 'En attente'}
            </span>
          </span>
        ) : null}
        poll={
          <PredictionPoll
            matchId={id}
            home={{ label: match.homeTeamName, logo: match.homeTeamLogo ?? null }}
            away={{ label: match.awayTeamName, logo: match.awayTeamLogo ?? null }}
            closed={match.effectiveStatus !== "upcoming"}
          />
        }
      />

      {/* Une colonne unique et centree. Le rail de droite portait les infos du
          match, qui vivent maintenant dans le hero : garder la gouttiere de
          320px aurait ete garder une colonne pour rien. */}
      <div className="mx-auto max-w-4xl space-y-4">
      {/* Barre d'onglets partagee. Les libelles etaient masques en dessous de
          `sm` : sur un telephone on ne voyait que trois icones grises. */}
      <MatchTabs
        active={activeTab}
        onChange={(id) => setActiveTab(id as typeof activeTab)}
        tabs={[
          { id: "center", label: "Résumé" },
          // La feuille de match ne s'affiche pas sans compte : les règles
          // Firestore ne servent pas `participations` à un invité, l'onglet
          // n'aurait donc que deux colonnes vides à montrer. Mieux vaut ne
          // pas l'annoncer que l'annoncer creux.
          ...(user ? [{
            id: "squad",
            label: "Composition",
            badge: isManager ? (() => {
              const isHomeManager = user?.uid === match.managerId;
              const isReady = isHomeManager ? match.homeLineupReady : match.awayLineupReady;
              return !isReady ? (
                <span className="ml-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
              ) : (
                <CheckCircle2 size={12} className="ml-1 text-emerald-500" />
              );
            })() : undefined,
          }] : []),
        ]}
      />

      {/* Tab Content */}
      <div className="min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeTab === "center" && (
            <motion.div
              key="center"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              {/* Ce que le tableau d'affichage ne dit pas : qui arbitre, et a
                  combien on joue. Deux cellules cote a cote. Le reste — date,
                  heure, terrain — est dans le hero, une seule fois. */}
              <MatchInfoList info={infoDuMatch} />

              {/* Manager LINEUP Validation Banner */}
              {isManager && (match.status === "upcoming" || match.status === "delayed") && !isMyTeamReady && (
                <div className=" bg-amber-50 border border-amber-200 p-4 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
                   <div className="h-14 w-14 bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                      <ClipboardList size={28} />
                   </div>
                   <div className="flex-1">
                      <h4 className="text-lg font-black text-amber-900 leading-tight">Feuille de match non validée !</h4>
                      <p className="text-sm text-amber-800/70 mb-4 font-bold">Vous devez confirmer votre effectif (numéros & rôles) avant que l'arbitre ne puisse lancer le match.</p>
                      <button 
                         onClick={() => setActiveTab("squad")}
                         className="px-6 py-2.5 bg-amber-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-amber-700 transition-all shadow-amber-600/20"
                      >
                         Remplir la feuille de match
                      </button>
                   </div>
                </div>
              )}

              {/* Post-Match Validation Banner */}
              {isManager && match.status === "completed" && (!match.postMatchFeedback || !match.postMatchFeedback[user?.uid!]) && (
                <div className=" bg-primary-50 border border-primary-200 p-4 sm:p-8">
                   <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 mb-4 sm:mb-6">
                      <div className="h-14 w-14 bg-primary-100 flex items-center justify-center text-primary-600 shrink-0">
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
                             await submitManagerFeedback(match.id, user.uid, { validation: "validated" });
                             toast.success("Match validé ! Merci.");
                           } catch (e) {
                             toast.error("Erreur lors de la validation");
                           }
                         }}
                         className="px-6 py-3 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-emerald-600/20 flex items-center gap-2"
                      >
                         <CheckCircle2 size={14} /> Valider le Match
                      </button>
                      <button 
                         onClick={() => {
                           const reason = prompt("Raison de la contestation :");
                           if (reason && user?.uid) {
                             submitManagerFeedback(match.id, user.uid, { validation: "contested", comments: reason })
                               .then(() => toast.success("Contestation enregistrée"))
                               .catch(() => toast.error("Erreur"));
                           }
                         }}
                         className="px-6 py-3 bg-white border border-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2"
                      >
                         <XCircle size={14} /> Contester
                      </button>
                   </div>
                </div>
              )}

              {/* Amical contre une équipe hors plateforme : les statistiques
                  n'ont crédité personne à la fin du match, faute de manager en
                  face pour contresigner. La décision revient à celui qui a vu
                  le match. */}
              {match.status === "completed" && !match.awayManagerId && isManager && (
                match.statsCreditedAt ? (
                  <div className="flex items-center gap-3 border border-gray-200/70 bg-gray-50 p-4 sm:gap-4 sm:p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-white">
                      <CheckCircle2 size={20} />
                    </div>
                    <p className="text-sm font-bold text-gray-700">
                      Statistiques attribuées aux joueurs de votre équipe. Le match reste
                      marqué non vérifié : personne en face ne l&apos;a contresigné.
                    </p>
                  </div>
                ) : (
                  <div className="border border-blue-200 bg-blue-50/60 p-4 sm:p-8">
                    <div className="mb-4 flex flex-col items-start gap-4 sm:mb-6 sm:flex-row sm:gap-6">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-blue-100 text-blue-600">
                        <BarChart2 size={28} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black leading-tight text-blue-900">
                          Statistiques non attribuées
                        </h4>
                        <p className="text-sm font-bold text-blue-800/70">
                          Ce match n&apos;a pas été suivi en direct, et l&apos;adversaire
                          n&apos;est pas sur KoppaFoot : personne n&apos;a pu contresigner la
                          feuille, donc les buts et passes ne comptent pas encore dans les
                          fiches de vos joueurs. Vous pouvez les attribuer sous votre
                          responsabilité — la feuille de match fait foi, et c&apos;est
                          définitif. L&apos;équipe adverse, elle, ne cumule rien.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={async () => {
                          if (!confirmerCredit) { setConfirmerCredit(true); return; }
                          setCreditEnCours(true);
                          try {
                            const n = await creditGhostMatchStats(match.id);
                            toast.success(
                              n > 0
                                ? `Statistiques attribuées à ${n} joueur${n > 1 ? "s" : ""}`
                                : "Aucun joueur confirmé sur la feuille",
                            );
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Erreur");
                          } finally {
                            setCreditEnCours(false);
                            setConfirmerCredit(false);
                          }
                        }}
                        disabled={creditEnCours}
                        className="flex items-center gap-2 bg-blue-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-700 disabled:opacity-50"
                      >
                        {creditEnCours
                          ? <Loader2 size={14} className="animate-spin" />
                          : <BarChart2 size={14} />}
                        {confirmerCredit ? "Confirmer l'attribution" : "Attribuer les statistiques"}
                      </button>
                      {confirmerCredit && (
                        <button
                          onClick={() => setConfirmerCredit(false)}
                          className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-700/60 transition-colors hover:text-blue-900"
                        >
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* Match Validated State */}
              {match.status === "completed" && match.validationStatus === "validated" && (
                <div className=" bg-emerald-50 border border-emerald-100 p-4 sm:p-6 flex items-center gap-3 sm:gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                  <p className="text-sm font-bold text-emerald-800">Ce match a été validé par les deux managers.</p>
                </div>
              )}

              {/* Avant le coup d'envoi, le Match Center n'avait plus rien à
                  montrer depuis que la timeline attend le direct : l'onglet
                  s'ouvrait sur quatre cents pixels de vide. Il annonce donc ce
                  qu'on est venu y chercher — quand ça commence — et ouvre la
                  console à ceux qui la tiendront. */}
              {match.status !== "live" && match.status !== "completed" && (
                <div className="flex flex-col items-center border border-gray-200/70 bg-white px-6 py-12 text-center sm:py-16">
                  <div className="flex h-16 w-16 items-center justify-center bg-gray-50">
                    <Clock size={30} className="text-gray-300" />
                  </div>
                  <h4 className="mt-5 text-lg font-black text-gray-900">
                    {match.status === "cancelled" ? "Match annulé" : "Le match n'a pas encore commencé"}
                  </h4>
                  {match.status !== "cancelled" && (
                    <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gray-500">
                      Coup d&apos;envoi le <span className="font-bold text-gray-700">{match.date}</span> à{" "}
                      <span className="font-bold text-gray-700">{match.time}</span>
                      {match.venueName ? <> · {match.venueName}</> : null}.
                      {" "}Les buts, cartons et remplacements s&apos;afficheront ici en direct.
                    </p>
                  )}
                  {peutTenirLaConsole && match.status !== "cancelled" && (
                    <button
                      onClick={() => router.push(`/matches/${id}/manage`)}
                      className="mt-6 inline-flex items-center gap-2 bg-gray-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-black"
                    >
                      <Activity size={14} /> Ouvrir la console live
                    </button>
                  )}
                </div>
              )}

              {/* L'historique, en deux camps : chaque evenement du cote de
                  son acteur, les reperes communs au centre. Voir
                  MatchTimeline. Un match qui n'a pas commence n'a pas
                  d'histoire, le bloc n'apparait qu'une fois le direct lance. */}
              {(match.status === "live" || match.status === "completed") && (
                <div className="border border-gray-200/70 bg-white p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                      Historique
                    </h3>
                    {match.status === "completed" && (
                      <span className="text-[11px] font-black tabular-nums text-gray-900">
                        Score final {match.scoreHome} – {match.scoreAway}
                      </span>
                    )}
                  </div>

                  <MatchTimeline
                    events={match.liveState?.events ?? []}
                    homeTeamId={match.homeTeamId}
                    vide="En attente du premier fait de jeu"
                    // Un amical contre une equipe hors plateforme n'a aucun nom
                    // de joueur en face : le nom de l'equipe tient lieu d'auteur.
                    auteur={(e) => auteurDeLEvenement(e.teamId, e.playerName)}
                    action={(e) =>
                      match.status === "completed"
                      && match.validationStatus !== "validated"
                      && isManager
                        ? e.contestedByManagerId ? (
                            <span className="inline-flex items-center gap-1 border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-orange-500">
                              <AlertCircle size={10} />
                              Contesté
                            </span>
                          ) : (
                            <button
                              onClick={() => setContestingEventId(e.id)}
                              className="border border-gray-200/70 bg-white px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-gray-600 transition-colors hover:bg-gray-50"
                            >
                              Contester
                            </button>
                          )
                        : null
                    }
                  />
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "squad" && (
            <motion.div
              key="squad"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              {/* La composition, sur un terrain, avant les outils du manager.
                  Elle repond a la question que TOUT LE MONDE se pose en
                  ouvrant cet onglet — qui joue, et a quel poste — la ou les
                  colonnes de noms plus bas servent a la remplir. Voir
                  MatchLineups. */}
              <div className="border border-gray-200/70 bg-white p-4 sm:p-5">
                <MatchLineups
                  home={{ name: match.homeTeamName, entries: compoDeLEquipe(match.homeTeamId, match.homeGhostLineup) }}
                  away={{ name: match.awayTeamName, entries: compoDeLEquipe(match.awayTeamId, match.awayGhostLineup) }}
                />
              </div>

              {isManager && (
                (() => {
                  const isHomeManager = user?.uid === match.managerId;
                  const isReady = isHomeManager ? match.homeLineupReady : match.awayLineupReady;
                  
                  if (match.status !== 'upcoming' && match.status !== 'live' && match.status !== 'pending') return null;
                  
                  return (
                    <div className={`mx-0 sm:mx-4 mb-4 sm:mb-8 p-4 sm:p-8 border transition-all ${
                      isReady 
                        ? 'bg-emerald-50/50 border-emerald-100/50 text-emerald-900 group' 
                        : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100 shadow-amber-200/20'
                    }`}>
                      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                        <div className={`p-4 transition-transform ${
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
                                // Une seule liste pour les deux moitiés de
                                // l'effectif — avec et sans compte (voir
                                // monEffectifDeMatch). Les joueurs sans compte
                                // manquaient à cet état, et leurs lignes
                                // affichaient « Titu » par simple valeur par
                                // défaut du sélecteur : le compteur lisait
                                // 1/11 pendant que huit lignes annonçaient le
                                // contraire.
                                //
                                // Le poste part de ce qui est déjà sur la
                                // feuille, sinon du poste naturel du joueur :
                                // le manager corrige les quelques lignes qui
                                // changent ce jour-là, il ne resaisit pas onze
                                // postes.
                                // LE NvN BORNE L'OUVERTURE. Tout l'effectif
                                // arrivait en titulaire : douze titulaires
                                // annoncés pour un match à quatre, qu'il
                                // fallait rétrograder un par un. Une feuille
                                // déjà enregistrée garde SES rôles, c'est la
                                // composition du manager ; sinon on prend les
                                // N premiers et le reste va au banc.
                                let restants = tailleEffectif(match.format);
                                // UNE FEUILLE DÉJÀ VALIDÉE SE ROUVRE TELLE
                                // QUELLE. Sans rôle enregistré, deux cas
                                // opposés se ressemblent : un joueur qu'on
                                // n'a pas encore placé, et un joueur qu'on a
                                // délibérément retiré — les deux ont un rôle
                                // vide. Le drapeau de la feuille les
                                // sépare : si elle a été validée, un rôle
                                // vide est un retrait qu'on respecte, sinon
                                // c'est une composition à faire.
                                const feuilleValidee = myTeamIsHome
                                  ? match.homeLineupReady
                                  : match.awayLineupReady;
                                setTempAssignments(Object.fromEntries(
                                  monEffectifDeMatch.map((j) => {
                                    let role = j.roleEnregistre as "starter" | "substitute" | "out" | null;
                                    if (!role) {
                                      if (feuilleValidee) {
                                        role = "out";
                                      } else {
                                        role = restants > 0 ? "starter" : "substitute";
                                        if (restants > 0) restants -= 1;
                                      }
                                    }
                                    return [j.id, {
                                      squadNumber: j.dossardParDefaut,
                                      role,
                                      position: j.posteEnregistre ?? j.posteNaturel,
                                    }];
                                  }),
                                ));
                                setLineupMode(true);
                              }}
                              className={`px-5 sm:px-8 py-3 sm:py-3.5 text-[10px] sm:text-[11px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] ${
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
                <div className="mx-0 sm:mx-4 p-4 sm:p-8 bg-gray-900 text-white shadow-2xl space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg sm:text-xl font-black italic tracking-tight">Configuration Tactique</h3>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mt-1">Dossards, postes et rôles</p>
                    </div>
                    <div className="h-14 w-14 bg-white/5 border border-white/10 flex items-center justify-center">
                       <Trophy className="text-emerald-400" size={24} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/5 border border-white/5 flex flex-col items-center text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">
                         Titulaires · {match.format}
                       </p>
                       <span className={`text-2xl font-black ${
                         titulairesEnCours.length === tailleDuMatch ? "text-emerald-400" : "text-amber-400"
                       }`}>
                         {titulairesEnCours.length} / {tailleDuMatch}
                       </span>
                    </div>
                    <div className="p-4 bg-white/5 border border-white/5 flex flex-col items-center text-center">
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Remplaçants</p>
                       <span className="text-2xl font-black text-white/80">
                         {compoEnCours.filter((e) => e.role === "substitute").length}
                       </span>
                    </div>
                  </div>

                  {/* LA FORME DE CE NvN, poste par poste. Elle n'impose
                      rien — un manager range ses joueurs comme il l'entend —
                      mais elle donne l'échelle du match qu'on prépare : un
                      5v5 n'est pas un 11v11 avec des trous, et l'éditeur ne
                      disait nulle part combien de défenseurs y tiennent. Le
                      chiffre passe au vert quand il tombe juste. */}
                  <div className="grid grid-cols-4 border border-white/5">
                    {POSTES.map((code) => {
                      const pose = posesParPoste[code];
                      const attendu = formeAttendue[code];
                      return (
                        <div
                          key={code}
                          className="px-2 py-2.5 text-center [&+&]:border-l [&+&]:border-white/5"
                        >
                          <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                            {LIBELLE_POSTE[code]}
                          </p>
                          <p className="mt-1 font-black tabular-nums">
                            <span className={pose === attendu ? "text-emerald-400" : "text-white/80"}>
                              {pose}
                            </span>
                            <span className="text-white/25"> / {attendu}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* LE TERRAIN, PENDANT QU'ON REMPLIT. Le manager choisissait
                      des rôles dans une liste et découvrait le placement une
                      fois la feuille validée, sur la fiche publique — c'est-à-
                      dire trop tard pour corriger un 2-5-3 involontaire. Même
                      dessin et même géométrie que la fiche (TerrainCompo),
                      donc ce qu'il voit ici est ce que tout le monde verra. */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                        Sur le terrain
                      </p>
                      {titulairesEnCours.some((e) => !e.position) && (
                        <p className="text-[9px] font-black uppercase tracking-widest text-amber-400/70">
                          {titulairesEnCours.filter((e) => !e.position).length} sans poste
                        </p>
                      )}
                    </div>
                    {titulairesEnCours.length === 0 ? (
                      <p className="border border-dashed border-white/10 py-10 text-center text-[10px] font-black uppercase tracking-[0.15em] text-white/30">
                        Aucun titulaire
                      </p>
                    ) : (
                      <div className="mx-auto w-full max-w-xs border border-white/10">
                        <TerrainCompo
                          titulaires={titulairesEnCours}
                          taille={tailleEffectif(match.format)}
                          variante="sombre"
                        />
                      </div>
                    )}
                  </div>

                  {/* L'EFFECTIF DU MATCH, EN ENTIER. Trois réglages par ligne :
                      le dossard, le poste tenu ce jour-là, et titulaire ou
                      remplaçant. Seuls les joueurs sans compte figuraient ici,
                      les autres n'avaient leurs sélecteurs que dans les
                      colonnes de convocation plus bas — invisibles dès que
                      l'auto-acceptation est active, ce qui est désormais le
                      cas par défaut. */}
                  <div className="space-y-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
                      Effectif du match ({monEffectifDeMatch.length})
                    </p>
                    {monEffectifDeMatch.length === 0 && (
                      <p className="border border-dashed border-white/10 p-4 text-center text-[11px] font-bold italic text-white/40">
                        Personne n&apos;a encore confirmé sa présence.
                      </p>
                    )}
                    {monEffectifDeMatch.map((joueur) => {
                      const pose = tempAssignments[joueur.id];
                      const dossard = pose?.squadNumber ?? joueur.dossardParDefaut;
                      const poste = pose?.position ?? null;
                      const role = pose?.role ?? "starter";
                      // Le dossard qu'un compte occupe déjà : ce joueur sans
                      // compte le perdra à l'enregistrement (voir
                      // updateMatchLineup), autant qu'il le sache ici.
                      const dossardEnDouble =
                        joueur.sansCompte
                        && dossard.trim() !== ""
                        && dossardsPrisParLesComptes.has(dossard.trim());
                      const poser = (patch: Partial<{ squadNumber: string; role: "starter" | "substitute" | "out"; position: Poste | null }>) =>
                        setTempAssignments((prev) => ({
                          ...prev,
                          // dossard/role/poste SONT deja les valeurs
                          // courantes, valeur par defaut comprise : la ligne
                          // se reecrit entiere, sans relire l'etat.
                          [joueur.id]: { squadNumber: dossard, role, position: poste, ...patch },
                        }));
                      return (
                        <div
                          key={joueur.id}
                          className={`flex flex-wrap items-center gap-2 border p-3 sm:flex-nowrap ${
                            role === "starter"
                              ? "border-white/10 bg-white/5"
                              : "border-white/5 bg-transparent"
                          } ${
                            // Un retiré s'éteint : il reste dans la liste pour
                            // qu'on le rappelle, mais il ne fait plus partie
                            // de la feuille, et ça se voit sans lire le
                            // sélecteur.
                            role === "out" ? "opacity-45" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-black text-white ${role === "out" ? "line-through decoration-white/40" : ""}`}>
                              {joueur.nom}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                              {joueur.sansCompte ? "Sans compte" : "Compte joueur"}
                              {joueur.posteNaturel ? ` · ${LIBELLE_POSTE[joueur.posteNaturel]} de métier` : ""}
                            </p>
                            {dossardEnDouble && (
                              <p className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                                Dossard {dossard.trim()} déjà pris par un compte
                              </p>
                            )}
                          </div>

                          <input
                            type="text"
                            placeholder="N°"
                            maxLength={3}
                            aria-label={`Dossard de ${joueur.nom}`}
                            className={`h-9 w-12 border bg-white/10 text-center text-xs font-black text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                              dossardEnDouble ? "border-amber-400/60" : "border-white/10"
                            }`}
                            value={dossard}
                            onChange={(e) => poser({ squadNumber: e.target.value })}
                          />

                          {/* Le poste, indépendant du poste naturel du joueur.
                              « — » est un choix valide : le terrain sait
                              aligner une ligne « ? » sans inventer des
                              défenseurs que personne n'a désignés. */}
                          <select
                            aria-label={`Poste de ${joueur.nom}`}
                            className="h-9 border border-white/10 bg-white/10 px-2 text-[10px] font-black uppercase text-white focus:outline-none"
                            value={poste ?? ""}
                            onChange={(e) => poser({ position: (e.target.value || null) as Poste | null })}
                          >
                            <option value="">— Poste</option>
                            {POSTES.map((code) => (
                              <option key={code} value={code}>
                                {INITIALE_POSTE[code]} · {LIBELLE_POSTE[code]}
                              </option>
                            ))}
                          </select>

                          {/* TROIS PLACES, DONT LA SORTIE. « Titu » se ferme
                              quand l'équipe est au complet : le match se joue
                              à N, et rien n'empêchait d'en aligner le double.
                              « Retiré » sort le joueur de la feuille sans le
                              sortir de la liste — un manager ne convoque pas
                              quatorze personnes pour un 4v4, et il doit
                              pouvoir le rappeler d'un clic. */}
                          <select
                            aria-label={`Rôle de ${joueur.nom}`}
                            className={`h-9 border px-2 text-[10px] font-black uppercase focus:outline-none ${
                              role === "out"
                                ? "border-white/5 bg-transparent text-white/40"
                                : "border-white/10 bg-white/10 text-white"
                            }`}
                            value={role}
                            onChange={(e) => poser({ role: e.target.value as "starter" | "substitute" | "out" })}
                          >
                            <option value="starter" disabled={onzeComplet && role !== "starter"}>
                              Titu
                            </option>
                            <option value="substitute">Sub</option>
                            <option value="out">Retiré</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                    <button
                      onClick={() => setLineupMode(false)}
                      className="flex-1 py-4 bg-white/5 text-white/60 text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Annuler
                    </button>
                    <button 
                      onClick={async () => {
                        if (!match || !myTeamId) return;
                        setValidatingLineup(true);
                        try {
                          // Un joueur sans compte n'a pas de participation où
                          // écrire son numéro : ses assignations partent dans
                          // la feuille du camp, sur le match. Les mélanger
                          // revenait à les jeter (voir updateMatchLineup).
                          const idsSansCompte = new Set(ghostPlayers.map(g => g.id));
                          // LES RETIRÉS NE PARTENT PAS. `updateMatchLineup`
                          // efface le rôle de tout le monde avant de le
                          // reposer sur ceux qu'on lui passe : les omettre
                          // suffit à les sortir de la feuille, côté comptes
                          // comme côté joueurs sans compte.
                          const entrees = Object.entries(tempAssignments)
                            .filter(([, val]) => val.role !== "out");

                          const assignments = entrees
                            .filter(([playerId]) => !idsSansCompte.has(playerId))
                            .map(([playerId, val]) => ({
                              playerId,
                              squadNumber: val.squadNumber,
                              role: val.role as "starter" | "substitute",
                              // Le poste tenu sur CE match. Il n'était pas
                              // transmis : seuls les joueurs sans compte en
                              // portaient un, et le terrain repliait donc tous
                              // les autres sur un 4-3-3 par ordre de feuille.
                              position: val.position,
                            }));

                          const ghostEntries = entrees
                            .filter(([playerId]) => idsSansCompte.has(playerId))
                            .map(([playerId, val]) => {
                              const g = ghostPlayers.find(x => x.id === playerId)!;
                              return {
                                playerId,
                                name: `${g.firstName} ${g.lastName}`.trim(),
                                number: val.squadNumber || g.squadNumber || "",
                                role: val.role as "starter" | "substitute",
                                // Le poste CHOISI pour ce match s'il l'a été,
                                // sinon celui de sa fiche, qui est typé et
                                // obligatoire. Ce dernier était pris d'office :
                                // un joueur sans compte ne pouvait pas dépanner
                                // ailleurs qu'à son poste.
                                position: val.position ?? normaliserPoste(g.position),
                              };
                            });

                          // This updateMatchLineup also sets the ready flag in firestore
                          await updateMatchLineup(match.id, myTeamId, myTeamIsHome, assignments, ghostEntries);
                          setLineupMode(false);
                          toast.success("Feuille de match validée !");
                        } catch (err) {
                          console.error(err);
                          toast.error("Erreur lors de la validation");
                        } finally {
                          setValidatingLineup(false);
                        }
                      }}
                      disabled={
                        validatingLineup ||
                        // Une feuille sans titulaire se déclarait « validée » et
                        // ouvrait la console sur une grille vide.
                        titulairesEnCours.length === 0 ||
                        // Ni plus de titulaires que le match n'en aligne. Le
                        // sélecteur s'y refuse déjà ; ce garde-fou attrape les
                        // feuilles enregistrées avant que le format ne change.
                        titulairesEnCours.length > tailleDuMatch
                      }
                      className="flex-[2] py-4 bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest shadow-emerald-500/20 hover:bg-emerald-600 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {validatingLineup ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
                      Envoyer à l'arbitre
                    </button>
                  </div>
                </div>
              )}

              {/* La feuille de match de l'adversaire hors plateforme se tenait
                  ici. Elle n'y est plus : son onze est généré avec le match et
                  vit dans la console live, seul endroit où il sert. Le composer
                  d'avance sur cette page demandait un travail de saisie à
                  quelqu'un qui, le jour venu, refait tout dans la console. */}

              <div className="space-y-8">
                {/* Home Squad. Deux raisons de ne pas l'afficher.
                    Le camp hors plateforme d'abord : ses joueurs n'ont pas de
                    compte, donc pas de convocation, et une colonne « 0
                    confirmés » laissait croire à une équipe qui ne répond pas.
                    L'auto-acceptation ensuite : cette liste EST le suivi des
                    convocations, et il n'y a pas de convocation à suivre quand
                    tout le monde est accepté d'office. La composition, elle, se
                    tient dans l'éditeur de feuille au-dessus. */}
                {!ghostIsHome && !match.autoAcceptPlayers && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-gray-400 italic">{match.homeTeamName}</h3>
                    {/* Le compteur de confirmations ne veut rien dire quand
                        l'auto-acceptation est active : tout le monde est
                        confirmé d'office, il n'y a aucune réponse à attendre. */}
                    {!match.autoAcceptPlayers && (
                      <span className="px-3 py-1 rounded-full bg-gray-50 text-[10px] font-black text-gray-500 border border-gray-200/70">
                        {homeSquad.filter(p => p.status === 'confirmed').length} Confirmés
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {homeSquad.map(player => (
                      <div key={player.id} className="group flex items-center justify-between p-4 bg-white border border-gray-200/70 transition-all hover:border-emerald-100">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 flex items-center justify-center font-black text-sm ${player.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {player.playerName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 line-clamp-1">{player.playerName}</p>
                            <div className="flex items-center gap-2">
                              {/* Même raison que le compteur : avec le bypass,
                                  « Présent » est vrai pour tout le monde par
                                  construction et n'apprend rien. */}
                              <p className={`text-[10px] font-black uppercase tracking-widest ${player.status === 'confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {match.autoAcceptPlayers ? 'Sur la feuille' : player.status === 'confirmed' ? 'Présent' : 'Invité'}
                              </p>
                              {player.matchRole && (
                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase border ${
                                  player.matchRole === 'starter' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-gray-50 text-gray-400 border-gray-200/70'
                                }`}>
                                  {player.matchRole === 'starter' ? 'Titulaire' : 'Remplaçant'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Ces colonnes SUIVENT LES CONVOCATIONS, elles ne
                            composent plus la feuille : dossard, poste et rôle
                            se règlent dans l'éditeur au-dessus, en une seule
                            liste qui couvre aussi les joueurs sans compte. Les
                            sélecteurs vivaient ici en double, et pour la moitié
                            de l'effectif seulement. */}
                        <div className="flex items-center gap-3">
                          {player.squadNumber && (
                            <span className="text-lg font-black text-gray-300 tracking-tighter mr-1 self-center">#{player.squadNumber}</span>
                          )}
                          {player.status === 'confirmed' && <Star size={14} className="text-emerald-400" />}
                        </div>
                      </div>
                    ))}
                    {homeSquad.length === 0 && (
                      <div className="p-8 text-center border border-dashed border-gray-200/70">
                        <p className="text-xs font-bold text-gray-400 italic">Aucun joueur pour le moment</p>
                      </div>
                    )}
                  </div>
                </div>
                )}

                {/* Away Squad. Mêmes deux raisons, voir Home Squad. */}
                {!(estAmical && !ghostIsHome) && !match.autoAcceptPlayers && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-4">
                    <h3 className="text-xs font-black uppercase tracking-[.2em] text-gray-400 italic">{match.awayTeamName}</h3>
                    {!match.autoAcceptPlayers && (
                      <span className="px-3 py-1 rounded-full bg-gray-50 text-[10px] font-black text-gray-500 border border-gray-200/70">
                        {awaySquad.filter(p => p.status === 'confirmed').length} Confirmés
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {awaySquad.map(player => (
                      <div key={player.id} className="group flex items-center justify-between p-4 bg-white border border-gray-200/70 transition-all hover:border-emerald-100">
                        <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 flex items-center justify-center font-black text-sm ${player.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {player.playerName[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 line-clamp-1">{player.playerName}</p>
                            <div className="flex items-center gap-2">
                              {/* Même raison que le compteur : avec le bypass,
                                  « Présent » est vrai pour tout le monde par
                                  construction et n'apprend rien. */}
                              <p className={`text-[10px] font-black uppercase tracking-widest ${player.status === 'confirmed' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {match.autoAcceptPlayers ? 'Sur la feuille' : player.status === 'confirmed' ? 'Présent' : 'Invité'}
                              </p>
                              {player.matchRole && (
                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase border ${
                                  player.matchRole === 'starter' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-gray-50 text-gray-400 border-gray-200/70'
                                }`}>
                                  {player.matchRole === 'starter' ? 'Titulaire' : 'Remplaçant'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ces colonnes SUIVENT LES CONVOCATIONS, elles ne
                            composent plus la feuille : dossard, poste et rôle
                            se règlent dans l'éditeur au-dessus, en une seule
                            liste qui couvre aussi les joueurs sans compte. Les
                            sélecteurs vivaient ici en double, et pour la moitié
                            de l'effectif seulement. */}
                        <div className="flex items-center gap-3">
                          {player.squadNumber && (
                            <span className="text-lg font-black text-gray-300 tracking-tighter mr-1 self-center">#{player.squadNumber}</span>
                          )}
                          {player.status === 'confirmed' && <Star size={14} className="text-emerald-400" />}
                        </div>
                      </div>
                    ))}
                    {awaySquad.length === 0 && (
                      <div className="p-8 text-center border border-dashed border-gray-200/70">
                        <p className="text-xs font-bold text-gray-400 italic">Aucun joueur pour le moment</p>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>

              {/* Convocation */}
              {/* Le seul à qui l'on demande de confirmer sa présence, c'est
                  celui qui a été convoqué et qui n'a pas encore répondu.
                  Ce bloc partait de `myTeamId`, qui désigne les équipes qu'on
                  GÈRE : « Rejoins le combat » s'affichait donc pour le manager,
                  et pour lui seul, pendant que les joueurs convoqués n'avaient
                  aucun bouton pour répondre. */}
              {myParticipation && myParticipation.status === "pending" && (
                <div className="mt-6 sm:mt-8 bg-emerald-600 p-5 sm:p-8 text-white shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 sm:p-8 opacity-10 group-hover:scale-110 transition-transform">
                    <Trophy size={72} className="sm:hidden" />
                    <Trophy size={100} className="hidden sm:block" />
                  </div>
                  <div className="relative z-10 max-w-sm">
                    <h4 className="text-xl sm:text-2xl font-black mb-2">Rejoins le combat !</h4>
                    <p className="text-emerald-100 text-xs sm:text-sm font-medium mb-4 sm:mb-6">Ta team a besoin de renforts. Confirme ta présence pour porter fièrement tes couleurs.</p>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      <button
                        onClick={() => handleRepondreConvocation(true)}
                        disabled={repondEnCours}
                        className="flex items-center gap-2 bg-white px-5 sm:px-8 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-emerald-600 transition-all hover:scale-105 active:scale-95 disabled:opacity-60"
                      >
                        {repondEnCours ? <RefreshCcw size={14} className="animate-spin" /> : null}
                        Confirmer ma présence
                      </button>
                      <button
                        onClick={() => handleRepondreConvocation(false)}
                        disabled={repondEnCours}
                        className="px-5 sm:px-6 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-white/70 transition-colors hover:text-white disabled:opacity-60"
                      >
                        Je ne peux pas
                      </button>
                    </div>
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
                        <div key={m.uid} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 border border-gray-200/70 transition-all hover:bg-white group">
                           <div className="flex items-center gap-3">
                             <div className="h-10 w-10 bg-white border border-gray-200/70 flex items-center justify-center font-black text-sm text-gray-500">
                               {m.profilePictureUrl ? (
                                 <img src={m.profilePictureUrl} alt="" className="h-full w-full object-cover" />
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
                             className="h-10 w-10 bg-emerald-500 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:grayscale"
                           >
                             <UserPlus size={16} />
                           </button>
                        </div>
                      ))}
                  </div>
                  {teamMembers.filter(m => !participations.some(p => p.playerId === m.uid)).length === 0 && (
                    <div className="p-8 text-center bg-gray-50/50 border border-dashed border-gray-200/70">
                      <p className="text-xs font-black text-gray-300 uppercase tracking-widest italic">Tous les membres sont déjà sur la feuille de match</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Qui tient la console. Reserve aux managers : c'est une delegation de
          pouvoir, pas une information de match. Cache une fois le match
          annule, ou il n'y a plus rien a couvrir. */}
      {isManager && match && match.status !== "cancelled" && (
        <div className="mb-6 mt-6 sm:mt-8">
          <MatchModerators
            matchId={match.id}
            moderatorIds={match.moderatorIds ?? []}
            disabled={match.status === "completed"}
          />
        </div>
      )}

      {/* Post-Match Feedback Section for Managers.
          Retiré sur un amical : « valider » ou « contester » n'ont de sens que
          face à un second manager. Sur un match hors plateforme, le geste de
          confirmation est l'attribution des statistiques, juste au-dessus. */}
      {isManager && match?.status === "completed" && !estAmical && (
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="relative overflow-hidden bg-white border-2 border-emerald-500/20 p-5 sm:p-12 shadow-2xl mb-6 mt-6 sm:mt-8"
        >
          <div className="mb-6 sm:mb-8">
             <h3 className="text-lg sm:text-xl font-black text-gray-900 border-b border-gray-200/70 pb-3 sm:pb-4 mb-3 sm:mb-4">Validation Finale de la Feuille de Match</h3>
             <p className="text-gray-500 text-xs sm:text-sm">Le match est terminé. Veuillez valider le score final, les évènements et noter l'arbitre pour clore officiellement la rencontre.</p>
             <div className="mt-4 p-3 sm:p-4 bg-amber-50 border border-amber-100">
               <p className="text-[11px] font-bold text-amber-700 flex items-start sm:items-center gap-2">
                 <AlertCircle size={14} className="shrink-0 mt-0.5 sm:mt-0" />
                 Note: Sans action sous 12h, le match sera validé automatiquement.
               </p>
             </div>
          </div>

          {user && match.postMatchFeedback?.[user.uid] ? (
             <div className="p-4 sm:p-6 bg-gray-50 border border-gray-200/70 space-y-4">
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
                          className={`flex-1 flex gap-2 justify-center items-center py-4 sm:py-5 text-[11px] sm:text-xs font-black uppercase tracking-widest border transition-all ${validation === "validated" ? "bg-emerald-600 border-emerald-600 text-white shadow-emerald-600/20" : "bg-white border-gray-200/70 text-gray-500 hover:border-emerald-200"}`}
                       >
                         <CheckCircle2 size={16} /> Valider le Score
                       </button>
                       <button
                          onClick={() => setValidation("contested")}
                          className={`flex-1 flex gap-2 justify-center items-center py-4 sm:py-5 text-[11px] sm:text-xs font-black uppercase tracking-widest border transition-all ${validation === "contested" ? "bg-red-600 border-red-600 text-white shadow-red-600/20" : "bg-white border-gray-200/70 text-gray-500 hover:border-red-200"}`}
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
                       className={`h-11 w-11 sm:h-12 sm:w-12 flex items-center justify-center border transition-all ${
                         i < refereeRating ? "bg-amber-50 border-amber-400 text-amber-500" : "bg-white border-gray-200/70 text-gray-400 hover:bg-gray-50"
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
                   className="w-full border-gray-200/70 text-sm p-4 focus:ring-emerald-500 focus:border-emerald-500"
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
                     });
                     toast.success("Retour envoyé à l'arbitre !");
                   } catch(e) {
                     console.error(e);
                     toast.error("Erreur lors de l'envoi du retour.");
                   } finally {
                     setSubmittingFeedback(false);
                   }
                 }}
                 disabled={submittingFeedback}
                 className="w-full h-14 bg-gray-900 text-white font-black text-sm uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-gray-800 transition-all active:scale-[0.98]"
               >
                 {submittingFeedback ? <RefreshCcw size={18} className="animate-spin" /> : <Save size={18} />}
                 Valider et envoyer
               </button>
             </div>
          )}
        </motion.div>
      )}

      {/* L'acces a la console, pour les managers.
          ELLE NE FLOTTE PLUS. C'etait une barre `fixed bottom-20` posee juste
          au-dessus de la barre de navigation du bas : deux bandes empilees,
          une centaine de pixels de contenu masques en permanence sur un
          telephone. Et son bouton principal, « Gerer l'effectif », ne faisait
          que changer d'onglet — un onglet deguise en action flottante, alors
          que l'onglet existait a trois centimetres au-dessus.
          Reste ce qu'une barre d'action doit porter : le seul geste que la
          page ne sait pas faire elle-meme. Cache sur un match termine ou
          annule, la console est close des deux cotes. */}
      {isManager && match?.status !== "completed" && match?.status !== "cancelled" && (
        <button
          onClick={() => router.push(`/matches/${id}/manage`)}
          className="mt-6 flex h-14 w-full items-center justify-center gap-2 bg-emerald-500 text-[11px] font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-600 sm:mt-8"
        >
          <Activity size={18} />
          Ouvrir la console du match
        </button>
      )}

      {/* Contestation Modal */}
      <AnimatePresence>
        {contestingEventId && (
          <div className="fixed inset-0 modal-layer flex items-center justify-center p-4">
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
              className="relative w-full max-w-md overflow-hidden bg-white p-6 sm:p-8 shadow-2xl"
            >
              <button
                onClick={() => setContestingEventId(null)}
                className="absolute right-6 top-6 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors"
              >
                <XCircle size={24} />
              </button>

              <div className="mb-6 flex h-16 w-16 items-center justify-center bg-orange-50 border border-orange-100">
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
                    className="w-full border-2 border-gray-200/70 bg-gray-50/50 p-4 text-sm font-medium text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:bg-white focus:outline-none transition-all resize-none"
                    placeholder="Cet événement est incorrect car..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setContestingEventId(null)}
                    className="flex-1 h-12 flex items-center justify-center border-2 border-gray-200/70 bg-white text-[11px] font-black uppercase tracking-widest text-gray-600 hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingContestation}
                    className="flex-1 h-12 flex items-center justify-center bg-orange-500 text-[11px] font-black uppercase tracking-widest text-white shadow-orange-500/20 active:scale-95 disabled:opacity-50 transition-all hover:bg-orange-600"
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
    </div>
  );
}
