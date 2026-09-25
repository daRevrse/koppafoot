"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Calendar, MapPin, Clock, Users,
  Plus, CheckCircle, XCircle, Timer, ChevronRight,
  Edit3, Trash2, Award, X, AlertCircle, Loader2, Search, Send, Star, ClipboardList,
  Activity, CheckCircle2, ArrowRight, History, Settings, Filter, ShieldCheck, Ban, Info,
  Swords, CalendarPlus
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateMatchStatus,
  forceCompleteMatch,
  onMatchesIManage,
  onMesValidations,
  getTeamsIManage,
  getTeamsByIds,
  getVenues,
  createMatch,
  cancelMatch,
  deleteMatch,
  confirmRecordedMatch,
  deleteRecordedMatch,
  searchOpponentTeams,
  ghostOpponentLineup,
  updateMatchSchedule,
  getTeamMembers,
  getTeamById,
  getUsersByIds,
  getParticipationsForMatch,
  onMatchChallengesForManager,
  respondToMatchChallenge,
  requestMatchModification,
  respondToMatchModification,
  respondToRefereeApplication,
  getRatingsForMatch,
  ratePlayer,
  tailleEffectif,
  totalJoueurs,
  quotaMinimum,
  createNotification,
} from "@/lib/firestore";
import { synchroniserTerrain } from "@/lib/reservations-client";
import { dateLongue, dureeDuMatch, horsHoraires } from "@/lib/terrains";
import { AvisTerrain, EtatTerrain, RefusDuTerrain } from "@/components/venue/venue-ui";
import { TEAM_SIZE_OPTIONS } from "@/lib/competition-format";
import type {
  Match, Team, Venue, PlayerRating, LineupEntry, MatchValidation, PropositionCreneau,
} from "@/types";
import TirsAuBut from "@/components/match/TirsAuBut";
import MiniEcusson from "@/components/match/MiniEcusson";
import { libelleDuJour } from "@/lib/dates";
import RecordMatchForm from "@/components/match/RecordMatchForm";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ============================================
// Config
// ============================================

const RESULT_CONFIG = {
  win: { label: "Victoire", color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
  loss: { label: "Défaite", color: "text-red-500", bg: "bg-red-50", icon: XCircle },
  draw: { label: "Nul", color: "text-amber-600", bg: "bg-amber-50", icon: Timer },
};

const REFEREE_STATUS_CONFIG = {
  confirmed: { label: "Arbitre confirmé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  invited: { label: "Invitation envoyée", color: "bg-blue-100 text-blue-700", icon: Send },
  pending: { label: "Arbitre en attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  none: { label: "Non assigné", color: "bg-gray-100 text-gray-500", icon: AlertCircle },
};

/**
 * Aujourd'hui, au format d'un `<input type="date">`.
 *
 * Construit champ par champ et NON via toISOString(), qui rend de l'UTC :
 * passé 00h à l'ouest de Greenwich il renvoie déjà demain, et à l'est il
 * renvoie encore hier en fin de soirée — dans les deux cas le plancher est
 * faux d'une journée pour la moitié des utilisateurs.
 */
const aujourdhui = (): string => {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
};

/** Une date de match antérieure à aujourd'hui. */
const dateDepassee = (date: string): boolean => !!date && date < aujourdhui();

// L'effectif, le total de joueurs et le quota se lisent dans le NvN du match
// (voir tailleEffectif dans lib/firestore) : le formulaire laisse la main sur
// ce N, il n'y a donc plus trois formats connus mais huit.

// ============================================
// Loading skeleton
// ============================================

function MatchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse overflow-hidden border border-gray-200/70 bg-white">
          <div className="flex flex-col sm:flex-row">
            <div className="h-16 w-full bg-gray-100 sm:h-auto sm:w-24" />
            <div className="flex-1 p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-4 w-24 rounded bg-gray-200" />
                <div className="h-4 w-8 rounded bg-gray-100" />
                <div className="h-4 w-24 rounded bg-gray-200" />
              </div>
              <div className="flex gap-3">
                <div className="h-3 w-20 rounded bg-gray-100" />
                <div className="h-3 w-28 rounded bg-gray-100" />
                <div className="h-3 w-10 rounded bg-gray-100" />
              </div>
              <div className="flex gap-3">
                <div className="h-5 w-28 rounded-full bg-gray-100" />
                <div className="h-5 w-32 rounded-full bg-gray-100" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

/**
 * TROIS ONGLETS, PAS CINQ. « En cours » était un sous-ensemble d'« À venir »
 * (qui contenait déjà les matchs en direct), et « Brouillons & En attente »
 * et « Défis reçus » répondaient à la même question : qu'est-ce qui attend
 * un geste de ma part avant de devenir un match ?
 */
type Tab = "upcoming" | "completed" | "todo";

/**
 * Les deux parcours de création, qui n'ont presque rien en commun après la
 * validation du formulaire.
 *
 *  - "challenge" : l'adversaire a un compte. On lui envoie un défi, il
 *    l'accepte, et c'est SON acceptation qui convoque les deux effectifs.
 *  - "friendly"  : l'adversaire n'est pas sur KoppaFoot. Personne n'a rien à
 *    accepter, le match est programmé sec et notre effectif est convoqué
 *    dans la foulée.
 *
 * Les mélanger dans un seul formulaire laissait le manager découvrir au
 * troisième champ dans lequel des deux il se trouvait.
 */
type CreateMode = "challenge" | "friendly" | "recorded";

/** Un match saisi à la main plutôt que couvert en direct. */
const estRenseigne = (m: Match) => !!m.recordedAt;

/** Un match sans manager en face : l'adversaire n'est pas sur la plateforme. */
const estAmical = (m: Match) => !m.awayManagerId;

/** Les états où le match peut encore changer de terrain ou d'horaire. */
const MODIFIABLE: Match["status"][] = ["challenge", "pending", "upcoming", "delayed"];

// ============================================
// L'AFFICHE : les deux écussons, et au centre le score ou l'heure.
//
// La carte posait deux noms sur une ligne, précédés d'un bouclier générique
// identique pour tout le monde, et rejetait l'heure dans une colonne à part.
// On lisait une phrase ; on regarde maintenant une affiche.
// ============================================

function Camp({ nom, logo, moi }: { nom: string; logo: string | null; moi: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <MiniEcusson nom={nom} logo={logo} taille={44} className={logo ? "" : "text-gray-400"} />
      <span
        className={`line-clamp-2 break-words text-xs sm:text-sm leading-tight ${
          moi ? "font-bold text-gray-900" : "font-medium text-gray-600"
        }`}
      >
        {nom}
      </span>
    </div>
  );
}

function Affiche({ match, logoDe }: {
  match: Match;
  logoDe: (teamId: string, copie?: string | null) => string | null;
}) {
  const aUnScore = match.scoreHome !== null && match.scoreAway !== null;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
      <Camp
        nom={match.homeTeamName}
        logo={logoDe(match.homeTeamId, match.homeTeamLogo)}
        moi={match.isHome}
      />
      <div className="flex flex-col items-center px-1">
        {aUnScore ? (
          <>
            <span className="font-display text-2xl sm:text-3xl font-black tabular-nums text-gray-900">
              {match.scoreHome}<span className="mx-1 text-gray-300">–</span>{match.scoreAway}
            </span>
            <TirsAuBut home={match.penaltyHome} away={match.penaltyAway} />
          </>
        ) : match.status === "live" ? (
          <span className="animate-pulse text-xs font-black uppercase tracking-wider text-red-600">En direct</span>
        ) : match.time ? (
          <span className="font-display text-xl sm:text-2xl font-black tabular-nums text-gray-900">{match.time}</span>
        ) : (
          <span className="text-xs font-medium text-gray-400">VS</span>
        )}
      </div>
      <Camp
        nom={match.awayTeamName || "À définir"}
        logo={match.awayTeamName ? logoDe(match.awayTeamId, match.awayTeamLogo) : null}
        moi={!match.isHome}
      />
    </div>
  );
}

/** Le statut, en une pastille, pour le bandeau de tête. */
function statutDe(match: Match, recu = false): { label: string; cls: string } {
  if (recu) return { label: "Défi reçu", cls: "bg-amber-100 text-amber-700" };
  if (match.result) {
    const r = RESULT_CONFIG[match.result];
    return { label: r.label, cls: `${r.bg} ${r.color}` };
  }
  switch (match.status) {
    case "live": return { label: "En direct", cls: "bg-red-600 text-white" };
    case "upcoming": return { label: "Programmé", cls: "bg-primary-50 text-primary-700" };
    case "delayed": return { label: "Reporté", cls: "bg-amber-100 text-amber-700" };
    case "challenge": return { label: "Défi envoyé", cls: "bg-gray-100 text-gray-600" };
    case "pending": return { label: "Accepté", cls: "bg-amber-100 text-amber-700" };
    case "cancelled": return { label: "Annulé", cls: "bg-red-50 text-red-500" };
    case "completed": return { label: "Terminé", cls: "bg-gray-100 text-gray-600" };
    default: return { label: "Brouillon", cls: "bg-gray-100 text-gray-500" };
  }
}

function Bandeau({ match, recu = false }: { match: Match; recu?: boolean }) {
  const st = statutDe(match, recu);
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-3 py-2 sm:px-5">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`shrink-0 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${st.cls}`}>
          {st.label}
        </span>
        {match.date && (
          <span className="truncate text-xs font-semibold text-gray-500 first-letter:uppercase">
            {libelleDuJour(match.date)}
            {match.time && match.scoreHome !== null ? ` · ${match.time}` : ""}
          </span>
        )}
      </div>
      {match.format && (
        <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-gray-400">{match.format}</span>
      )}
    </div>
  );
}

export default function MatchesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [challenges, setChallenges] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  /**
   * DE QUEL CÔTÉ JE SUIS SUR CE MATCH, et la feuille qui va avec.
   *
   * La question n'est pas « suis-je le manager du match » mais « l'une des
   * deux équipes est-elle une des miennes » — c'est déjà le raisonnement de la
   * fiche d'un match (voir matches/[id], `myTeamId`), et il vaut ici pour les
   * mêmes deux raisons :
   *
   *  — LE STAFF DÉLÉGUÉ n'est ni `manager_id` ni `away_manager_id`. Comparer
   *    les uid le rangeait d'office du côté extérieur, si bien qu'on lui
   *    montrait l'état de la feuille de L'ADVERSAIRE.
   *
   *  — `manager_id` DÉSIGNE LE CRÉATEUR, pas le camp. C'est `is_home` qui dit
   *    où il joue. Un manager qui programme un déplacement était lui aussi
   *    traité comme l'équipe à domicile.
   *
   * `teams` vient de getTeamsIManage : il porte les clubs qu'on possède ET
   * ceux qu'on nous a délégués.
   */
  const mesEquipesIds = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);

  const monCamp = useCallback(
    (match: Match): "home" | "away" | null => {
      if (mesEquipesIds.has(match.homeTeamId)) return "home";
      if (mesEquipesIds.has(match.awayTeamId)) return "away";
      // Le repli du créateur : un match reste le sien même si l'équipe a
      // changé de mains, ou si la liste des équipes n'est pas encore là.
      if (user?.uid === match.managerId) return match.isHome ? "home" : "away";
      if (user?.uid === match.awayManagerId) return match.isHome ? "away" : "home";
      return null;
    },
    [mesEquipesIds, user?.uid],
  );
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [createMode, setCreateMode] = useState<CreateMode | null>(null);
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  // Modification state
  const [modifyingMatch, setModifyingMatch] = useState<Match | null>(null);
  const [modDate, setModDate] = useState("");
  const [modTime, setModTime] = useState("");
  const [modVenueId, setModVenueId] = useState("");
  const [modReason, setModReason] = useState("");
  const [modVenueName, setModVenueName] = useState("");
  const [modVenueCity, setModVenueCity] = useState("");
  const [submittingMod, setSubmittingMod] = useState(false);
  const [respondingToMod, setRespondingToMod] = useState<string | null>(null);
  const [respondingToRef, setRespondingToRef] = useState<string | null>(null);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  // La verticale "venues" est restée au placard : la collection est vide pour
  // la plupart des clubs, et sans repli le match partait avec venue_name = "".
  // Saisie libre du terrain, imposée quand aucun terrain n'est référencé.
  const [customVenueName, setCustomVenueName] = useState("");
  const [customVenueCity, setCustomVenueCity] = useState("");
  const [format, setFormat] = useState("11v11");
  const [isHome, setIsHome] = useState(true);

  // Away team search state
  const [awaySearchQuery, setAwaySearchQuery] = useState("");
  const [awaySearchResults, setAwaySearchResults] = useState<Team[]>([]);
  const [awayTeamId, setAwayTeamId] = useState("");
  const [awayTeamName, setAwayTeamName] = useState("");
  const [awayManagerId, setAwayManagerId] = useState("");
  const [showAwayDropdown, setShowAwayDropdown] = useState(false);
  const [searchingAway, setSearchingAway] = useState(false);
  const awaySearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayDropdownRef = useRef<HTMLDivElement>(null);

  // Local referee state
  const [refereeMode, setRefereeMode] = useState<"none" | "local">("none");
  const [localRefereeName, setLocalRefereeName] = useState("");
  /**
   * Le quota de joueurs, DÉSACTIVÉ PAR DÉFAUT.
   *
   * Un match ne partait pas tant que les deux camps n'avaient pas atteint
   * leur quota de confirmés, et personne ne confirme : le manager sait qui
   * vient, il l'a organisé au téléphone. Ces matchs restaient en brouillon à
   * vie (voir handleProgramFriendly, qui existe pour les débloquer à la
   * main). Le quota reste disponible d'un geste pour qui veut compter ses
   * présents avant de jouer.
   */
  const [autoAcceptPlayers, setAutoAcceptPlayers] = useState(true);

  // Player rating modal state
  const [ratingMatch, setRatingMatch] = useState<Match | null>(null);
  /**
   * Les joueurs à noter, avec ou sans compte.
   *
   * La modale ne lisait que les participations puis `getUsersByIds` : un joueur
   * sans compte n'a ni l'une ni l'autre, il était donc absent de la notation
   * alors qu'il avait joué le match. On note ce qu'on a vu sur le terrain, pas
   * ce qui a un profil.
   */
  const [ratingPlayers, setRatingPlayers] = useState<
    { id: string; nom: string; poste: string; sansCompte: boolean }[]
  >([]);
  const [existingRatings, setExistingRatings] = useState<PlayerRating[]>([]);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [savingRatings, setSavingRatings] = useState(false);

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // LES MATCHS NE SONT PLUS CHARGÉS ICI. Ils l étaient par uid, ce qui
      // n a jamais ramené ceux du staff délégué, et l écouteur temps réel
      // (voir plus bas) les réécrivait de toute façon dans la foulée. Il est
      // désormais seul à les poser, et il sait, lui, interroger par équipe.
      const [teamsData, venuesData] = await Promise.all([
        getTeamsIManage(user.uid),
        getVenues(),
      ]);
      setTeams(teamsData);
      setVenues(venuesData);
    } catch (err) {
      console.error("Erreur de chargement:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * L'écouteur temps réel, RELANCÉ QUAND LES ÉQUIPES ARRIVENT.
   *
   * Il interroge par uid ET par équipe (voir onMatchesIManage), et la liste
   * des équipes est chargée en parallèle, donc plus tard. La clé est une
   * chaîne triée et non le tableau : `teams` est reconstruit à chaque rendu et
   * l'effet repartirait en boucle sur sa seule identité.
   */
  const clefDeMesEquipes = useMemo(
    () => [...mesEquipesIds].sort().join(","),
    [mesEquipesIds],
  );

  /**
   * LES ÉCUSSONS DES CARTES. Le match en porte une copie (`homeTeamLogo`),
   * mais les amicaux antérieurs à cette copie n'en ont pas. On complète avec
   * mes équipes, déjà chargées, puis on va chercher en une fois celles d'en
   * face qui manquent encore. Une équipe hors plateforme n'a pas de fiche :
   * elle garde ses initiales.
   */
  const [logosAdverses, setLogosAdverses] = useState<Map<string, string | null>>(new Map());
  const logoDe = useCallback(
    (teamId: string, copie?: string | null): string | null =>
      copie || teams.find((t) => t.id === teamId)?.logoUrl || logosAdverses.get(teamId) || null,
    [teams, logosAdverses],
  );
  const idsSansLogo = useMemo(() => {
    const ids = new Set<string>();
    for (const m of [...matches, ...challenges]) {
      if (m.homeTeamId && !m.homeTeamLogo && !mesEquipesIds.has(m.homeTeamId)) ids.add(m.homeTeamId);
      if (m.awayTeamId && !m.awayTeamLogo && !mesEquipesIds.has(m.awayTeamId)) ids.add(m.awayTeamId);
    }
    return [...ids].sort().join(",");
  }, [matches, challenges, mesEquipesIds]);
  useEffect(() => {
    const manquants = idsSansLogo ? idsSansLogo.split(",").filter((id) => !logosAdverses.has(id)) : [];
    if (manquants.length === 0) return;
    getTeamsByIds(manquants)
      .then((found) => {
        setLogosAdverses((prev) => {
          const next = new Map(prev);
          for (const id of manquants) next.set(id, found.find((t) => t.id === id)?.logoUrl ?? null);
          return next;
        });
      })
      .catch(() => {});
    // logosAdverses est lu pour filtrer, pas pour relancer : le relancer
    // à chaque réponse bouclerait sur les équipes introuvables.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSansLogo]);

  useEffect(() => {
    if (!user?.uid) return;
    const ids = clefDeMesEquipes ? clefDeMesEquipes.split(",") : [];
    const unsub = onMatchesIManage(user.uid, ids, (data: Match[]) => {
      setMatches(data);
      setLoading(false);
    });
    return unsub;
  }, [user?.uid, clefDeMesEquipes]);

  /**
   * Le statut de validation de mes matchs, par match. Il a quitté le document
   * public du match pour `match_validations`, que seuls les deux camps lisent :
   * une seule requête (`managers` contient mon uid) les ramène tous.
   */
  const [validations, setValidations] = useState<Map<string, MatchValidation>>(new Map());
  useEffect(() => {
    if (!user?.uid) return;
    return onMesValidations(user.uid, setValidations);
  }, [user?.uid]);

  // Real-time challenges listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onMatchChallengesForManager(user.uid, (data) => {
      setChallenges(data);
    });
    return unsub;
  }, [user?.uid]);

  // Close away dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (awayDropdownRef.current && !awayDropdownRef.current.contains(e.target as Node)) {
        setShowAwayDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Saisie de l'adversaire.
  //
  // En mode défi, la frappe déclenche une recherche serveur et ne vaut jamais
  // pour adversaire : il faut choisir une équipe existante dans la liste.
  // En mode amical, la frappe EST l'adversaire — le nom tapé suffit, et
  // l'équipe hors plateforme ne sera écrite en base qu'à la validation.
  const handleAwaySearchChange = (value: string) => {
    setAwaySearchQuery(value);
    setAwayTeamId("");
    setAwayManagerId("");
    setAwayTeamName(createMode === "friendly" ? value.trim() : "");

    if (awaySearchTimeout.current) clearTimeout(awaySearchTimeout.current);
    if (!value.trim()) {
      setAwaySearchResults([]);
      setShowAwayDropdown(false);
      return;
    }
    setShowAwayDropdown(true);
    if (createMode !== "challenge") return;

    setSearchingAway(true);
    awaySearchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchOpponentTeams({ query: value, managerId: user?.uid ?? "" });
        setAwaySearchResults(results);
      } catch (err) {
        console.error("Erreur recherche équipe:", err);
      } finally {
        setSearchingAway(false);
      }
    }, 300);
  };

  const selectAwayTeam = (team: Team) => {
    setAwayTeamId(team.id);
    setAwayTeamName(team.name);
    // Une équipe fantôme porte le manager_id de son créateur, le laisser
    // passer ferait de lui le manager des DEUX camps.
    setAwayManagerId(team.isGhost ? "" : team.managerId);
    setAwaySearchQuery(team.name);
    setShowAwayDropdown(false);
    setAwaySearchResults([]);
  };

  const resetOpponent = () => {
    setAwaySearchQuery("");
    setAwaySearchResults([]);
    setAwayTeamId("");
    setAwayTeamName("");
    setAwayManagerId("");
    setShowAwayDropdown(false);
  };

  const resetForm = () => {
    resetOpponent();
    setSelectedTeamId("");
    setMatchDate("");
    setMatchTime("");
    setSelectedVenueId("");
    setCustomVenueName("");
    setCustomVenueCity("");
    setFormat("11v11");
    setIsHome(true);
    setRefereeMode("none");
    setLocalRefereeName("");
    setAutoAcceptPlayers(true);
  };

  const openCreateForm = (mode: CreateMode) => {
    if (createMode === mode) { setCreateMode(null); return; }
    resetForm();
    setCreateMode(mode);
  };

  // La seule passerelle entre les deux parcours : l'équipe cherchée n'est pas
  // sur KoppaFoot. Tout ce qui est déjà saisi (date, terrain, format) suit,
  // seul l'adversaire change de nature.
  const switchToFriendly = () => {
    const nom = awaySearchQuery.trim();
    setCreateMode("friendly");
    setAwaySearchResults([]);
    setAwayTeamId("");
    setAwayManagerId("");
    setAwayTeamName(nom);
    setShowAwayDropdown(false);
  };

  // Filter matches by tab
  // Le direct d'abord : c'est le seul qu'on vient voir tout de suite.
  const upcoming = matches
    .filter((m) => m.status === "upcoming" || m.status === "delayed" || m.status === "live")
    .sort((a, b) => Number(b.status === "live") - Number(a.status === "live"));
  // Un match annulé n'attend plus rien : il rejoint l'historique.
  const completed = matches.filter((m) => m.status === "completed" || m.status === "cancelled");
  const drafts = matches.filter(
    (m) => m.status === "draft" || m.status === "challenge" || m.status === "pending"
  );
  const displayed =
    tab === "upcoming" ? upcoming :
    tab === "completed" ? completed :
    drafts;

  // Create match handler
  const handleCreate = async () => {
    if (!user || !selectedTeamId || !awayTeamName || !matchDate || !matchTime) return;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return;
    // En mode défi, un nom tapé sans équipe choisie dans la liste ne désigne
    // personne : on ne peut pas envoyer un défi dans le vide.
    if (createMode === "challenge" && !awayTeamId) return;
    // On ne programme rien pour un jour déjà passé, dans aucun des deux
    // parcours : le défi partirait vers une date que l'adversaire ne peut plus
    // honorer, et l'amical convoquerait des joueurs pour un match joué.
    if (dateDepassee(matchDate)) {
      toast.error("Cette date est déjà passée.");
      return;
    }

    const isFriendly = createMode === "friendly";
    const venue = venues.find((v) => v.id === selectedVenueId);
    // UN TERRAIN RÉFÉRENCÉ A SES HORAIRES : une heure hors plage partirait au
    // propriétaire pour se faire refuser. On le dit ici, avant de créer.
    if (venue) {
      const hors = horsHoraires(venue.openingHours, { date: matchDate, time: matchTime, duration: dureeDuMatch(format) });
      if (hors) {
        toast.error(`${venue.name} : ${hors}`);
        return;
      }
    }
    const venueName = venue?.name ?? customVenueName.trim();
    const venueCity = venue?.city ?? customVenueCity.trim();
    const homeTeamName = isHome ? team.name : awayTeamName;
    const awayTeamNameFinal = isHome ? awayTeamName : team.name;
    const playersTotal = totalJoueurs(format);

    setCreating(true);
    try {
      // L'adversaire hors plateforme n'a PAS d'équipe en base : son nom et son
      // onze vivent sur le match, et rien d'autre n'était jamais relu du
      // document `teams` qu'on lui créait. Son camp n'a donc pas
      // d'identifiant d'équipe du tout.
      const opponentTeamId = isFriendly ? "" : awayTeamId;
      const ghostLineup: LineupEntry[] | undefined = isFriendly
        ? ghostOpponentLineup(format)
        : undefined;

      // Face à un fantôme personne n'acceptera le défi : c'est la création qui
      // doit convoquer notre effectif.
      let homeSquad: { teamId: string; memberIds: string[]; memberNames: Map<string, string> } | undefined;
      if (isFriendly) {
        const members = await getTeamMembers(team.id);
        homeSquad = {
          teamId: team.id,
          memberIds: members.map((m) => m.uid),
          memberNames: new Map(members.map((m) => [m.uid, `${m.firstName} ${m.lastName}`.trim()])),
        };
      }

      // L'écusson des deux camps voyage avec le match (voir
      // FirestoreMatch.home_team_logo). L'équipe adverse vient de la recherche,
      // qui rend des `Team` complets ; un adversaire hors plateforme n'a pas de
      // fiche, donc pas de blason.
      const monLogo = team.logoUrl ?? null;
      const logoAdverse = awayTeamId
        ? (awaySearchResults.find((t) => t.id === awayTeamId)?.logoUrl ?? null)
        : null;

      const matchId = await createMatch({
        venueId: venue?.id ?? null,
        homeTeamId: isHome ? team.id : opponentTeamId,
        awayTeamId: isHome ? opponentTeamId : team.id,
        homeTeamName,
        awayTeamName: awayTeamNameFinal,
        homeTeamLogo: isHome ? monLogo : logoAdverse,
        awayTeamLogo: isHome ? logoAdverse : monLogo,
        managerId: user.uid,
        awayManagerId: awayManagerId,
        date: matchDate,
        localRefereeName: refereeMode === "local" && localRefereeName.trim() ? localRefereeName.trim() : undefined,
        time: matchTime,
        venueName,
        venueCity,
        format,
        isHome,
        playersTotal,
        autoAcceptPlayers,
        homeSquad,
        ghostLineup,
      });

      toast.success(isFriendly ? "Match programmé" : "Défi envoyé");

      // Sur un terrain référencé, la demande de créneau part chez le
      // propriétaire dans la foulée — pour un défi aussi, sans attendre que
      // l'adversaire accepte : c'est ce qui laisse au terrain le temps de
      // répondre.
      if (venue) {
        const echec = await synchroniserTerrain(matchId);
        if (echec) toast.error(`Terrain : ${echec}`);
        else toast.success(`Demande envoyée à ${venue.name}`);
      }
      resetForm();
      setCreateMode(null);
      await fetchData();
    } catch (err) {
      console.error("Erreur lors de la création:", err);
      toast.error("Impossible de créer le match");
    } finally {
      setCreating(false);
    }
  };

  /**
   * Aligner le créneau du terrain sur le match, après un geste sur lui.
   *
   * Le geste est fait quoi qu'il arrive ; un échec ici se dit, sans défaire
   * le reste, et le prochain geste rattrape l'écart.
   */
  const libererOuAligner = async (matchId: string) => {
    const echec = await synchroniserTerrain(matchId);
    if (echec) toast.error(`Terrain : ${echec}`);
  };

  /**
   * Supprimer pour de bon, par opposition à annuler.
   *
   * Le bouton « Supprimer » appelait l'annulation, laquelle range le match
   * parmi les annulés — que cet onglet affiche. Le match ne partait donc
   * jamais, et rien ne permettait de le faire partir.
   */
  const handleDeleteMatch = async (match: Match) => {
    const estAmicalSansCompte = estAmical(match) && !estRenseigne(match);
    const message = estRenseigne(match)
      ? `Supprimer ${match.homeTeamName} ${match.scoreHome} – ${match.scoreAway} ${match.awayTeamName} ? Les buts, passes et bilans que ce match a crédités seront repris.`
      : estAmicalSansCompte
      ? `Supprimer définitivement ${match.homeTeamName} vs ${match.awayTeamName} ? Les convocations et l'adversaire hors plateforme créé pour ce match partent avec lui.`
      : `Supprimer définitivement ${match.homeTeamName} vs ${match.awayTeamName} ? Les convocations partent avec lui.`;
    if (!window.confirm(message)) return;
    setCompleting(match.id);
    try {
      // Un match renseigné a crédité des compteurs : sa suppression passe par
      // la route qui les REPREND, sans quoi supprimer puis ressaisir doublerait
      // tout — et c'est exactement le geste de quelqu'un qui s'est trompé.
      if (estRenseigne(match)) await deleteRecordedMatch(match.id);
      else await deleteMatch(match.id);
      // Le créneau demandé au terrain se libère avec le match.
      if (match.venueId || match.venueBooking) void libererOuAligner(match.id);
      setMatches((prev) => prev.filter((m) => m.id !== match.id));
      toast.success("Match supprimé");
    } catch (err) {
      console.error(err);
      toast.error("Impossible de supprimer ce match");
    } finally {
      setCompleting(null);
    }
  };

  /**
   * Contresigner, ou contester, un score saisi par l'adversaire.
   *
   * C'est ici seulement que les compteurs bougent pour un match renseigné
   * contre une équipe KoppaFoot : accepter, c'est valider un résultat qui
   * entre dans son propre bilan.
   */
  const handleContresigner = async (match: Match, accepte: boolean) => {
    if (!accepte && !window.confirm(
      `Contester ${match.homeTeamName} ${match.scoreHome} – ${match.scoreAway} ${match.awayTeamName} ?\n\nLe match restera affiché, marqué contesté, et ne comptera pour personne.`
    )) return;
    setCompleting(match.id);
    try {
      await confirmRecordedMatch(match.id, accepte);
      toast.success(accepte ? "Résultat confirmé" : "Résultat contesté");
      await fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "L'opération a échoué");
    } finally {
      setCompleting(null);
    }
  };

  // Cancel match handler
  const handleCancelMatch = async (matchId: string) => {
    try {
      await cancelMatch(matchId);
      const annule = matches.find((m) => m.id === matchId);
      if (annule?.venueId || annule?.venueBooking) void libererOuAligner(matchId);
      // Wait for real-time listener or manually update
      setMatches((prev) => prev.map((m) => m.id === matchId ? { ...m, status: "cancelled" } : m));
    } catch (err) {
      console.error("Erreur lors de l'annulation:", err);
    }
  };

  // Accept challenge handler
  const handleAcceptChallenge = async (match: Match) => {
    setAccepting(match.id);
    try {
      const [homeTeam, awayTeam] = await Promise.all([
        getTeamById(match.homeTeamId),
        getTeamById(match.awayTeamId),
      ]);
      if (!homeTeam || !awayTeam) return;

      const [homeMembers, awayMembers] = await Promise.all([
        getUsersByIds(homeTeam.memberIds),
        getUsersByIds(awayTeam.memberIds),
      ]);

      const homeMemberNames = new Map(homeMembers.map((m) => [m.uid, `${m.firstName} ${m.lastName}`]));
      const awayMemberNames = new Map(awayMembers.map((m) => [m.uid, `${m.firstName} ${m.lastName}`]));
      const matchLabel = `${match.homeTeamName} vs ${match.awayTeamName}`;

      await respondToMatchChallenge(
        match.id,
        true,
        homeTeam.memberIds,
        homeMemberNames,
        awayTeam.memberIds,
        awayMemberNames,
        matchLabel,
        match.date,
        match.time,
        match.venueName,
        match.homeTeamId,
        match.awayTeamId,
        match.format,
        match.autoAcceptPlayers,
      );

      setChallenges((prev) => prev.filter((c) => c.id !== match.id));
      await fetchData();
    } catch (err) {
      console.error("Erreur lors de l'acceptation du défi:", err);
    } finally {
      setAccepting(null);
    }
  };

  // Reject challenge handler
  const handleRejectChallenge = async (match: Match) => {
    try {
      await respondToMatchChallenge(
        match.id,
        false,
        [],
        new Map(),
        [],
        new Map(),
        "",
        "",
        "",
        "",
        "",
        "",
        match.format,
      );
      // Défi refusé, match annulé : le terrain demandé par l'autre se libère.
      if (match.venueId || match.venueBooking) void libererOuAligner(match.id);
      setChallenges((prev) => prev.filter((c) => c.id !== match.id));
    } catch (err) {
      console.error("Erreur lors du refus du défi:", err);
    }
  };

  // Force complete match (bypass quota)
  const handleForceComplete = async (matchId: string) => {
    setCompleting(matchId);
    try {
      await forceCompleteMatch(matchId);
      // Wait for real-time listener or manually update
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: "completed" } : m));
    } catch (err) {
      console.error("Erreur lors de la confirmation forcée:", err);
    } finally {
      setCompleting(null);
    }
  };

  /**
   * Débloquer un amical resté en « pending ».
   *
   * Ces matchs ont été créés avant que la création cesse d'attendre un quota
   * adverse impossible. Un simple passage en « upcoming » les remet dans le
   * parcours normal, sans migration ni script.
   */
  const handleProgramFriendly = async (matchId: string) => {
    setCompleting(matchId);
    try {
      await updateMatchStatus(matchId, "upcoming");
      toast.success("Match programmé");
    } catch (err) {
      console.error(err);
      toast.error("Impossible de programmer ce match");
    } finally {
      setCompleting(null);
    }
  };

  const handleRequestModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingMatch || !user) return;
    // Déplacer un match, c'est le reporter : jamais vers une date révolue.
    if (dateDepassee(modDate)) {
      toast.error("Impossible de déplacer un match vers une date passée.");
      return;
    }
    setSubmittingMod(true);
    try {
      // Sans terrain référencé sélectionné, on retombe sur la saisie libre puis
      // sur le terrain actuel plutôt que de l'effacer (la collection venues est
      // vide pour la plupart des clubs).
      const selectedVenue = venues.find((v) => v.id === modVenueId);
      const venueName = selectedVenue?.name || modVenueName.trim() || modifyingMatch.venueName;
      const venueCity = selectedVenue?.city || modVenueCity.trim() || modifyingMatch.venueCity;
      // Un terrain référencé choisi l'emporte ; une saisie libre n'en désigne
      // aucun, et libère donc le créneau demandé à l'ancien.
      const venueId = selectedVenue?.id ?? null;

      if (selectedVenue) {
        const hors = horsHoraires(selectedVenue.openingHours, {
          date: modDate, time: modTime, duration: dureeDuMatch(modifyingMatch.format),
        });
        if (hors) {
          toast.error(`${selectedVenue.name} : ${hors}`);
          return;
        }
      }

      // UN DÉFI PAS ENCORE ACCEPTÉ SE DÉPLACE SANS DEMANDE : l'adversaire n'a
      // rien accepté, il découvrira le nouvel horaire en lisant le défi. Lui
      // demander de valider un changement sur un défi qu'il n'a pas encore
      // vu n'a pas de sens — et c'est souvent le terrain qui l'impose.
      const direct = estAmical(modifyingMatch) || modifyingMatch.status === "challenge";

      if (direct) {
        // Personne en face pour accepter : la demande de modification restait
        // en suspens à vie et gelait le match. On déplace, et on prévient les
        // convoqués.
        await updateMatchSchedule(modifyingMatch.id, {
          date: modDate, time: modTime, venueName, venueCity, venueId,
        });
        if (modifyingMatch.status === "challenge" && modifyingMatch.awayManagerId) {
          await createNotification({
            userId: modifyingMatch.awayManagerId,
            type: "match_update",
            title: "Défi modifié",
            body: `${modifyingMatch.homeTeamName} vs ${modifyingMatch.awayTeamName} : ${dateLongue(modDate)} à ${modTime}${venueName ? `, ${venueName}` : ""}.`,
            link: "/matches",
          }).catch(() => {});
        }
        toast.success(estAmical(modifyingMatch) ? "Match déplacé" : "Défi modifié");
        if (venueId || modifyingMatch.venueId || modifyingMatch.venueBooking) {
          void libererOuAligner(modifyingMatch.id);
        }
      } else {
        await requestMatchModification(modifyingMatch.id, {
          date: modDate,
          time: modTime,
          venueName,
          venueCity,
          venueId,
          reason: modReason,
          requestedBy: user.uid,
        });
        toast.success("Demande envoyée à l'adversaire");
      }
      setModifyingMatch(null);
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de la modification du match");
    } finally {
      setSubmittingMod(false);
    }
  };

  const handleRespondModification = async (match: Match, accepted: boolean) => {
    setRespondingToMod(match.id);
    try {
      if (!match.modificationRequest) return;
      await respondToMatchModification(match.id, accepted, {
        date: match.modificationRequest.date,
        time: match.modificationRequest.time,
        venue_name: match.modificationRequest.venueName,
        venue_city: match.modificationRequest.venueCity,
        venue_id: match.modificationRequest.venueId ?? null,
      });
      // Le match a bougé : le terrain suit, qu'il change ou non.
      if (accepted && (match.modificationRequest.venueId || match.venueId || match.venueBooking)) {
        void libererOuAligner(match.id);
      }
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réponse à la modification");
    } finally {
      setRespondingToMod(null);
    }
  };

  const handleRespondReferee = async (matchId: string, accepted: boolean) => {
    setRespondingToRef(matchId);
    try {
      await respondToRefereeApplication(matchId, accepted);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la réponse à l'arbitre");
    } finally {
      setRespondingToRef(null);
    }
  };

  const openRatingModal = async (match: Match) => {
    if (!user) return;
    setRatingMatch(match);
    setRatings({});
    try {
      const myTeam = teams.find((t) => t.managerId === user.uid && (t.id === match.homeTeamId || t.id === match.awayTeamId));
      if (!myTeam) return;
      const [participations, existing] = await Promise.all([
        getParticipationsForMatch(match.id),
        getRatingsForMatch(match.id),
      ]);
      const confirmedPlayerIds = participations
        .filter((p) => p.status === "confirmed" && p.teamId === myTeam.id)
        .map((p) => p.playerId);
      const players = await getUsersByIds(confirmedPlayerIds);

      // La feuille du camp, côté joueurs sans compte : elle est dénormalisée
      // sur le match, comme leur compo.
      const monCampEstDomicile = match.homeTeamId === myTeam.id;
      const sansCompte = (monCampEstDomicile ? match.homeGhostLineup : match.awayGhostLineup) ?? [];

      setRatingPlayers([
        ...players.map((u) => ({
          id: u.uid,
          nom: `${u.firstName} ${u.lastName}`.trim(),
          poste: u.position ?? "Joueur",
          sansCompte: false,
        })),
        ...sansCompte.map((e) => ({
          id: e.playerId,
          nom: e.name,
          poste: e.role === "starter" ? "Titulaire" : "Remplaçant",
          sansCompte: true,
        })),
      ]);
      setExistingRatings(existing);
      const initialRatings: Record<string, number> = {};
      for (const r of existing) { initialRatings[r.playerId] = r.score; }
      setRatings(initialRatings);
    } catch (err) { console.error(err); }
  };

  const handleSaveRatings = async () => {
    if (!ratingMatch || !user) return;
    setSavingRatings(true);
    const myTeam = teams.find((t) => t.managerId === user.uid && (t.id === ratingMatch.homeTeamId || t.id === ratingMatch.awayTeamId));
    if (!myTeam) { setSavingRatings(false); return; }
    try {
      // `ratePlayer` écrit une note attachée à un identifiant de joueur : celui
      // d'un compte, ou celui d'un joueur sans compte. Le document de note ne
      // fait pas la différence, et n'a pas de raison de la faire.
      await Promise.all(
        Object.entries(ratings).map(([playerId, score]) =>
          ratePlayer({ matchId: ratingMatch.id, playerId, teamId: myTeam.id, ratedBy: user.uid, score })
        )
      );
      toast.success("Notes enregistrées");
      setRatingMatch(null);
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSavingRatings(false); }
  };

  /**
   * Ouvrir la modification, éventuellement préremplie avec le créneau que le
   * propriétaire du terrain a proposé en refusant : le manager n'a plus qu'à
   * valider, et la demande qui repart est confirmée d'office.
   */
  const openModifyModal = (match: Match, proposition?: PropositionCreneau | null) => {
    setModifyingMatch(match);
    setModDate(proposition?.date ?? match.date);
    setModTime(proposition?.time ?? match.time);
    const venue = venues.find((v) => v.id === match.venueId)
      ?? venues.find((v) => v.name === match.venueName);
    setModVenueId(venue?.id || "");
    setModVenueName(venue ? "" : match.venueName);
    setModVenueCity(venue ? "" : match.venueCity);
    setModReason("");
  };


  const tabs: { key: Tab; label: string; count: number; icon: typeof Calendar | typeof Activity }[] = [
    { key: "upcoming", label: "À venir", count: upcoming.length, icon: Calendar },
    { key: "todo", label: "À traiter", count: challenges.length + drafts.length, icon: Swords },
    { key: "completed", label: "Terminés", count: completed.length, icon: Trophy },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-display">Matchs</h1>
          <p className="mt-1 text-sm text-gray-500">Planifie et gère les matchs de ton équipe</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Deux entrées, pas une : le match qu'on doit faire accepter et
              celui qu'on programme seul n'ont pas le même parcours. */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => openCreateForm("challenge")}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all ${
                createMode === "challenge"
                  ? "bg-primary-700 text-white"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              }`}
            >
              <Swords size={16} /> Défier une équipe
            </button>
            <button
              onClick={() => openCreateForm("friendly")}
              className={`inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-medium transition-all ${
                createMode === "friendly"
                  ? "border-primary-600 bg-primary-50 text-primary-700"
                  : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Plus size={16} /> Programmer un amical
            </button>
            {/* Le seul parcours qui regarde en arrière. Les deux autres
                programment et refusent une date passée : un club n'avait aucun
                moyen de porter son historique. */}
            <button
              onClick={() => openCreateForm("recorded")}
              className={`inline-flex items-center gap-2 border px-4 py-2.5 text-sm font-medium transition-all ${
                createMode === "recorded"
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              <History size={16} /> Renseigner un match joué
            </button>
          </div>
        </motion.div>
      </div>

      {/* Renseigner un match joué : formulaire à part, il n'a ni convocation,
          ni terrain à réserver, ni adversaire à prévenir — et il se relit avant
          de valider, parce qu'il ne se modifie plus après. */}
      {createMode === "recorded" && user && (
        <RecordMatchForm
          teams={teams}
          managerId={user.uid}
          onClose={() => setCreateMode(null)}
          onRecorded={fetchData}
        />
      )}

      {/* Create match form */}
      <AnimatePresence>
        {createMode && createMode !== "recorded" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className=" border-2 border-primary-200 bg-primary-50/30 p-3 sm:p-6">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 font-display">
                    {createMode === "challenge" ? "Défier une équipe" : "Programmer un amical"}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {createMode === "challenge"
                      ? "L'adversaire recevra le défi et devra l'accepter avant que le match soit programmé."
                      : "L'adversaire n'est pas sur KoppaFoot : le match est programmé directement, ton effectif est convoqué."}
                  </p>
                </div>
                <button
                  onClick={() => setCreateMode(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* My team select */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mon équipe</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  >
                    <option value="">Sélectionner une équipe</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                {/* Away team search */}
                <div className="relative" ref={awayDropdownRef}>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Adversaire</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      value={awaySearchQuery}
                      onChange={(e) => handleAwaySearchChange(e.target.value)}
                      onFocus={() => awaySearchQuery.trim() && setShowAwayDropdown(true)}
                      placeholder={createMode === "challenge"
                        ? "Rechercher une équipe sur KoppaFoot..."
                        : "Nom de l'équipe adverse..."}
                      className="w-full border border-gray-200/70 bg-white pl-8 pr-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                    />
                  </div>

                  {/* Mode défi : uniquement des équipes de la plateforme. Si rien
                      ne sort, la seule issue offerte est de basculer en amical. */}
                  {createMode === "challenge" && showAwayDropdown && awaySearchQuery.trim() && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden border border-gray-200/70 bg-white">
                      {awaySearchResults.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => selectAwayTeam(team)}
                          className="flex w-full flex-col px-4 py-2.5 text-left text-sm transition-colors hover:bg-primary-50"
                        >
                          <span className="font-medium text-gray-900">{team.name}</span>
                          <span className="text-xs text-gray-500">{team.city}</span>
                        </button>
                      ))}
                      {searchingAway && awaySearchResults.length === 0 && (
                        <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500">
                          <Loader2 size={14} className="animate-spin" /> Recherche...
                        </div>
                      )}
                      {!searchingAway && awaySearchResults.length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                          Aucune équipe KoppaFoot à ce nom.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={switchToFriendly}
                        className="flex w-full items-center gap-2 border-t border-gray-200/70 bg-gray-50/60 px-4 py-3 text-left text-sm transition-colors hover:bg-primary-50"
                      >
                        <CalendarPlus size={14} className="shrink-0 text-primary-600" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-primary-700">
                            « {awaySearchQuery.trim()} » n&apos;est pas sur KoppaFoot
                          </span>
                          <span className="block text-xs text-gray-500">
                            Programmer un amical contre cette équipe
                          </span>
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Mode amical : le nom tapé fait l'affaire, et rien d'autre
                      n'est proposé. Une équipe hors plateforme n'est pas un
                      adversaire qu'on garde en stock : elle naît avec le match,
                      porte son nom dans l'historique, et s'arrête là. */}
                </div>
                {createMode === "friendly" && awayTeamName && (
                  <div className="border border-gray-200/70 bg-gray-50 px-3 py-2.5">
                    <p className="text-xs text-gray-600">
                      <strong className="font-semibold text-gray-800">{awayTeamName}</strong>{" "}
                      n&apos;est pas sur KoppaFoot : le match est programmé directement, et son
                      camp reçoit {tailleEffectif(format)} joueurs numérotés pour
                      que le direct soit couvrable des deux côtés.
                    </p>
                  </div>
                )}
                {/* Date */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    /* Les deux formulaires programment un match À VENIR. Un
                       match déjà joué relève du parcours « renseigner un match
                       joué », qui n'ouvre pas de convocations et se verrouille
                       après validation — pas de celui-ci. */
                    min={aujourdhui()}
                    className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                {/* Time */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Heure</label>
                  <input
                    type="time"
                    value={matchTime}
                    onChange={(e) => setMatchTime(e.target.value)}
                    className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                {/* Venue, terrain référencé si la collection en contient,
                    saisie libre sinon (ou via « Autre terrain »). */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Terrain</label>
                  {venues.length > 0 && (
                    <select
                      value={selectedVenueId}
                      onChange={(e) => setSelectedVenueId(e.target.value)}
                      className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                    >
                      <option value="">Autre terrain (saisie libre)</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}, {v.city}</option>
                      ))}
                    </select>
                  )}
                  <AvisTerrain venue={venues.find((v) => v.id === selectedVenueId)} date={matchDate} duree={dureeDuMatch(format)} />
                  {!selectedVenueId && (
                    <div className={`grid grid-cols-2 gap-2 ${venues.length > 0 ? "mt-2" : ""}`}>
                      <input
                        type="text"
                        value={customVenueName}
                        onChange={(e) => setCustomVenueName(e.target.value)}
                        placeholder="Nom du terrain"
                        className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                      />
                      <input
                        type="text"
                        value={customVenueCity}
                        onChange={(e) => setCustomVenueCity(e.target.value)}
                        placeholder="Ville"
                        className="w-full border border-gray-200/70 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                      />
                    </div>
                  )}
                </div>
                {/* Format.
                    Trois choix seulement — 5v5, 7v7, 11v11 — pour un football
                    qui se joue à quatre comme à onze : le manager d'un 6v6 ou
                    d'un 8v8 devait déclarer un format qui n'était pas le sien,
                    et l'effectif convoqué comme le quota s'alignaient sur ce
                    mensonge. On lui laisse la main sur le N, la même liste
                    qu'un organisateur (TEAM_SIZE_OPTIONS). */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Format</label>
                  <div className="grid grid-cols-4 gap-2">
                    {TEAM_SIZE_OPTIONS.map((n) => {
                      const f = `${n}v${n}`;
                      return (
                        <label
                          key={f}
                          className={`flex cursor-pointer items-center justify-center border px-2 py-2.5 text-sm font-medium transition-colors ${
                            format === f
                              ? "border-primary-600 bg-primary-50 text-primary-700"
                              : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="format"
                            value={f}
                            checked={format === f}
                            onChange={() => setFormat(f)}
                            className="sr-only"
                          />
                          {f}
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Joueurs par équipe sur le terrain, gardien compris
                  </p>
                </div>
                {/* Home/Away */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Lieu</label>
                  <div className="flex gap-2">
                    {[
                      { value: true, label: "Domicile" },
                      { value: false, label: "Extérieur" },
                    ].map((opt) => (
                      <label
                        key={String(opt.value)}
                        className={`flex flex-1 cursor-pointer items-center justify-center border px-3 py-2.5 text-sm font-medium transition-colors ${
                          isHome === opt.value
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-gray-200/70 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="location"
                          checked={isHome === opt.value}
                          onChange={() => setIsHome(opt.value)}
                          className="sr-only"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              {/* Referee section */}
              <div className="mt-3 sm:mt-4 border border-gray-200/70 bg-white p-3 sm:p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Arbitre</p>
                <div className="flex gap-2 mb-3">
                  {[{ v: "none" as const, label: "Aucun pour l'instant" }, { v: "local" as const, label: "Arbitre local" }].map(({ v, label }) => (
                    <label key={v} className={`flex flex-1 cursor-pointer items-center justify-center border px-3 py-2 text-xs font-medium transition-colors ${refereeMode === v ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200/70 text-gray-600 hover:bg-gray-50"}`}>
                      <input type="radio" className="sr-only" checked={refereeMode === v} onChange={() => setRefereeMode(v)} /> {label}
                    </label>
                  ))}
                </div>
                {refereeMode === "local" && (
                  <input value={localRefereeName} onChange={(e) => setLocalRefereeName(e.target.value)}
                    placeholder="Nom de l'arbitre local"
                    className="w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                )}
              </div>

              {/* Auto-accept toggle */}
              <div className="mt-3 sm:mt-4 flex items-center justify-between border border-primary-100 bg-primary-50/50 p-3 sm:p-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">Auto-acceptation des joueurs</p>
                  <p className="text-xs text-gray-500">
                    {autoAcceptPlayers
                      ? "Tout le monde est sur la feuille tout de suite, le match est programmé sans attendre de quota"
                      : `Le match attend ${quotaMinimum(format)} confirmés par équipe avant d'être programmé`}
                  </p>
                </div>
                <button
                  onClick={() => setAutoAcceptPlayers(!autoAcceptPlayers)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoAcceptPlayers ? "bg-primary-600" : "bg-gray-200"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoAcceptPlayers ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="mt-4 sm:mt-5 flex flex-wrap gap-2 sm:gap-3">
                <button
                  onClick={handleCreate}
                  disabled={
                    creating || !selectedTeamId || !awayTeamName || !matchDate || !matchTime ||
                    // En mode défi, un nom tapé ne suffit pas : il faut une
                    // équipe choisie dans la liste, sinon il n'y a personne à défier.
                    (createMode === "challenge" && !awayTeamId)
                  }
                  className="inline-flex items-center gap-2 bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <><Loader2 size={16} className="animate-spin" /> {createMode === "challenge" ? "Envoi..." : "Création..."}</>
                  ) : createMode === "challenge" ? (
                    <><Swords size={16} /> Envoyer le défi</>
                  ) : (
                    <><Plus size={16} /> Programmer le match</>
                  )}
                </button>
                <button
                  onClick={() => setCreateMode(null)}
                  className=" border border-gray-200/70 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex border-b border-gray-200/70 overflow-x-auto scrollbar-hide"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 text-xs sm:text-sm sm:gap-2 sm:pr-6 sm:px-0 font-medium transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={16} /> {t.label}
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                t.key === "todo" && challenges.length > 0
                  ? "bg-red-500 text-white"
                  : tab === t.key
                  ? "bg-primary-100 text-primary-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Loading state */}
      {loading && <MatchSkeleton />}

      {/* Défis reçus, en tête de « À traiter » : ce sont eux qui pressent,
          l'adversaire attend une réponse. */}
      {!loading && tab === "todo" && challenges.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {challenges.map((match, i) => (
              <motion.div
                key={match.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                /* Pas de fiche derrière un défi reçu : rien n'est encore
                   programmé, personne n'est convoqué, et la page de détail
                   s'ouvrait sur un match vide. Les deux seuls gestes qui ont
                   un sens ici — accepter, refuser — sont sur la carte. */
                className="overflow-hidden border border-dashed border-amber-300 bg-white transition-shadow"
              >
                <div>
                  <Bandeau match={match} recu />

                  <div className="p-3 sm:p-5">
                    {/* Vu d'en face : le défi est écrit du point de vue de
                        celui qui l'a lancé, c'est l'autre camp qui est le mien. */}
                    <Affiche match={{ ...match, isHome: !match.isHome }} logoDe={logoDe} />

                    {/* Meta row */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
                      {match.venueName ? (
                        <>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {match.venueName}
                          </span>
                          <EtatTerrain r={match.venueBooking} />
                        </>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500">
                          <MapPin size={12} /> Terrain à définir
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 sm:mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => handleAcceptChallenge(match)}
                        disabled={accepting === match.id}
                        className="inline-flex items-center gap-1.5 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {accepting === match.id ? (
                          <><Loader2 size={14} className="animate-spin" /> Acceptation...</>
                        ) : (
                          <><CheckCircle size={14} /> Accepter</>
                        )}
                      </button>
                      <button
                        onClick={() => handleRejectChallenge(match)}
                        disabled={accepting === match.id}
                        className="inline-flex items-center gap-1.5 border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle size={14} /> Refuser
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

        </div>
      )}

      {/* Match cards */}
      {!loading && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayed.map((match, i) => {
              const refConf = REFEREE_STATUS_CONFIG[match.refereeStatus];
              const RefIcon = refConf.icon;
              const isDraft =
                match.status === "draft" ||
                match.status === "challenge" ||
                match.status === "pending" ||
                match.status === "cancelled";
              /**
               * AUCUNE CARTE DE CET ONGLET N'OUVRE DE FICHE.
               *
               * Brouillon, défi envoyé, accepté, annulé : aucun de ces matchs
               * n'a de fiche qui tienne debout. Il n'y a ni date honorée, ni
               * feuille de match, ni rien à lire — le clic ouvrait une page
               * vide — et tout ce qu'on peut faire d'un match en attente est
               * déjà sur sa carte : le compléter, l'annuler, le supprimer.
               * Même règle vue d'en face, dans l'onglet « Défis reçus » plus
               * haut.
               *
               * Un match reparaît cliquable dès qu'il est programmé, c'est-à-
               * dire dès qu'il quitte cet onglet pour « À venir ».
               */
              const ouvreLaFiche = !isDraft;

              return (
                <motion.div
                  key={match.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  onClick={ouvreLaFiche ? () => router.push(`/matches/${match.id}`) : undefined}
                  className={`group overflow-hidden border bg-white transition-shadow ${
                    ouvreLaFiche ? "cursor-pointer" : ""
                  } ${isDraft ? "border-dashed border-gray-200/70" : "border-gray-200/70"}`}
                >
                  <div className="flex">
                    <div className="min-w-0 flex-1">
                    <Bandeau match={match} />
                    <div className="p-3 sm:p-5">
                      <Affiche match={match} logoDe={logoDe} />

                      {/* Meta row */}
                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          {(() => {
                            const camp = monCamp(match);
                            const isMyReady =
                              camp === "home" ? match.homeLineupReady
                              : camp === "away" ? match.awayLineupReady
                              : true;

                            if (camp && !isMyReady && (match.status === 'upcoming' || match.status === 'live' || match.status === 'delayed')) {
                              return (
                                <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-600 border border-amber-200 animate-pulse">
                                  <ClipboardList size={10} />
                                  Feuille à remplir
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </span>
                        {match.venueName ? (
                          <>
                            <span className="flex items-center gap-1">
                              <MapPin size={12} /> {match.venueName}
                            </span>
                            <EtatTerrain r={match.venueBooking} />
                          </>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500">
                            <MapPin size={12} /> Terrain à définir
                          </span>
                        )}

                        {/* Pas de badge de validation sur un amical hors
                            plateforme : il n'y a pas de second manager pour
                            contresigner, donc rien à annoncer. Ni tant que la
                            validation n'est pas chargée : un « en attente »
                            affiché d'office mentirait sur un match validé. */}
                        {match.status === "completed" && !estAmical(match) && validations.get(match.id) && (() => {
                          const statut = validations.get(match.id)!.status;
                          return (
                            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider ${
                              statut === 'validated' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                              statut === 'contested' ? 'bg-red-50 border-red-100 text-red-600' :
                              statut === 'unverified' ? 'bg-gray-100 border-gray-200/70 text-gray-500' :
                              'bg-amber-50 border-amber-100 text-amber-600 animate-pulse'
                            }`}>
                              {statut === 'validated' ? <CheckCircle2 size={10} /> :
                               statut === 'contested' ? <AlertCircle size={10} /> :
                               statut === 'unverified' ? <Info size={10} /> : <Clock size={10} />}
                              {statut === 'validated' ? 'Score Validé' :
                               statut === 'contested' ? 'Contesté' :
                               statut === 'unverified' ? 'Amical non vérifié' : 'Validation en attente'}
                            </div>
                          );
                        })()}
                      </div>

                      {match.venueBooking?.status === "refused"
                        && user?.uid === match.managerId
                        && MODIFIABLE.includes(match.status) && (
                        <RefusDuTerrain
                          r={match.venueBooking}
                          onPrendre={() => openModifyModal(match, match.venueBooking?.proposition)}
                          onChanger={() => openModifyModal(match)}
                        />
                      )}

                      {/* Referee + Players row (upcoming/delayed/draft only) */}
                      {(match.status === "upcoming" || match.status === "delayed" || isDraft) && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
                          <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${refConf.color}`}>
                            <RefIcon size={12} /> {refConf.label}
                          </span>
                          {/* Rien à confirmer quand l'auto-acceptation est
                              active : les convocations partent déjà acceptées,
                              personne n'attend de réponse. La ligne annonçait un
                              suivi de confirmations qui n'avait pas lieu. */}
                          {!match.autoAcceptPlayers && (
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Users size={12} />
                              <span className="hidden sm:inline">Confirmations:</span>
                            </span>
                            {/* Face à un adversaire hors plateforme, le compteur
                                d'en face reste à zéro par construction : personne
                                à convoquer. L'afficher laissait croire à une
                                équipe qui ne répond pas. */}
                            {estAmical(match) ? (
                              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 border border-gray-200/70">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Mon équipe</span>
                                <span className={`text-xs font-bold ${(match.isHome ? match.confirmedHome : match.confirmedAway) >= quotaMinimum(match.format) ? "text-emerald-600" : "text-amber-600"}`}>
                                  {match.isHome ? match.confirmedHome : match.confirmedAway}
                                </span>
                                <span className="text-gray-300 ml-0.5 sm:ml-1">|</span>
                                <span className="text-[10px] font-medium text-gray-400 ml-0.5 sm:ml-1">Effectif {tailleEffectif(match.format)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-0.5 border border-gray-200/70">
                                <span className="text-[10px] uppercase font-bold text-gray-400">Dom.</span>
                                <span className={`text-xs font-bold ${match.confirmedHome >= quotaMinimum(match.format) ? "text-emerald-600" : "text-amber-600"}`}>
                                  {match.confirmedHome}
                                </span>
                                <span className="text-gray-300">/</span>
                                <span className="text-[10px] uppercase font-bold text-gray-400">Ext.</span>
                                <span className={`text-xs font-bold ${match.confirmedAway >= quotaMinimum(match.format) ? "text-emerald-600" : "text-amber-600"}`}>
                                  {match.confirmedAway}
                                </span>
                                <span className="text-gray-300 ml-0.5 sm:ml-1">|</span>
                                <span className="text-[10px] font-medium text-gray-400 ml-0.5 sm:ml-1">Total {totalJoueurs(match.format)}</span>
                              </div>
                            )}
                          </div>
                          )}
                        </div>
                      )}

                      {/* Referee application management */}
                      {match.refereeStatus === "pending" && match.managerId === user?.uid && (
                        <div className="mt-4 border border-amber-200 bg-amber-50 p-3 sm:p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Award size={16} className="text-amber-600 shrink-0" />
                              <span className="text-sm font-bold text-amber-900">Demande d&apos;arbitrage</span>
                            </div>
                            <span className="text-xs font-bold text-amber-700 italic truncate">{match.refereeName}</span>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              onClick={() => handleRespondReferee(match.id, true)}
                              disabled={respondingToRef === match.id}
                              className="flex-1 bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              {respondingToRef === match.id ? "Validation..." : "Accepter l'arbitre"}
                            </button>
                            <button
                              onClick={() => handleRespondReferee(match.id, false)}
                              disabled={respondingToRef === match.id}
                              className="flex-1 border border-amber-300 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Arbitre local */}
                      {match.localRefereeName && match.refereeStatus === "none" && (
                        <div className="mt-2 flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 w-fit">
                          <Award size={11} /> Arbitre local : {match.localRefereeName}
                        </div>
                      )}

                      {/* Referee name (completed) */}
                      {match.status === "completed" && match.refereeName && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <Award size={12} /> Arbitre : {match.refereeName}
                        </div>
                      )}
                      {match.status === "completed" && !match.refereeName && match.localRefereeName && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <Award size={12} /> Arbitre local : {match.localRefereeName}
                        </div>
                      )}

                      {/* Un score saisi par l'adversaire, en attente de notre
                          parole. Tant qu'on n'a pas tranché, il ne compte pour
                          personne — ni pour lui, ni pour nous. */}
                      {estRenseigne(match) && validations.get(match.id)?.status === "pending" && (
                        match.managerId === user?.uid ? (
                          <div className="mt-3 flex items-center gap-2 border border-amber-200 bg-amber-50 px-3 py-2">
                            <Clock size={13} className="shrink-0 text-amber-600" />
                            <p className="text-[11px] font-semibold text-amber-800">
                              En attente de la confirmation de l&apos;adversaire. Rien n&apos;est encore compté.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 border border-amber-200 bg-amber-50 p-3">
                            <p className="mb-2 text-[11px] font-semibold leading-relaxed text-amber-900">
                              <strong>{match.homeTeamName} {match.scoreHome} – {match.scoreAway} {match.awayTeamName}</strong>,
                              le {match.date}. Ce résultat a été saisi par l&apos;adversaire : il ne comptera
                              qu&apos;une fois que tu l&apos;auras confirmé.
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleContresigner(match, true); }}
                                disabled={completing === match.id}
                                className="flex-1 bg-emerald-600 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                              >
                                {completing === match.id ? "..." : "Confirmer ce score"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleContresigner(match, false); }}
                                disabled={completing === match.id}
                                className="flex-1 border border-amber-300 py-2 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-50"
                              >
                                Contester
                              </button>
                            </div>
                          </div>
                        )
                      )}

                      {/* Player rating button (completed) */}
                      {match.status === "completed" && match.managerId === user?.uid && (
                        <button onClick={(e) => { e.stopPropagation(); openRatingModal(match); }}
                          className="mt-3 flex items-center gap-1.5 border border-gray-200/70 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                          <Star size={12} /> Noter les joueurs
                        </button>
                      )}

                      {/* Actions.
                          Le direct pointait vers /matches/[id]/live, une
                          seconde fiche du meme match : la carte menait donc a
                          deux endroits differents selon qu'on cliquait dessus
                          ou sur son bouton. Cette route redirige maintenant
                          ici, et « Acceder au direct » sur un match qui n'a
                          pas commence promettait un direct qui n'existait
                          pas — la fiche suffit. */}
                      {(match.status === "upcoming" || match.status === "live") && (
                        <div className="mt-3 sm:mt-4 flex flex-col gap-2 sm:gap-3">
                          {match.status === "live" && (
                             <Link
                              href={`/matches/${match.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-center gap-2 bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-tight text-white shadow-red-100 transition-all hover:bg-red-700 animate-pulse"
                            >
                              <Activity size={18} />
                              Suivre en direct
                             </Link>
                          )}
                          {match.modificationRequest ? (
                            <div className=" border border-primary-200 bg-primary-50 p-3">
                              <p className="text-sm font-medium text-primary-800 mb-1">Demande de modification</p>
                              <div className="text-xs text-primary-700 bg-white/50 rounded p-2 mb-2">
                                <p><strong>Nouvelle date:</strong> {match.modificationRequest.date} à {match.modificationRequest.time}</p>
                                <p><strong>Nouveau terrain:</strong> {match.modificationRequest.venueName || "Non spécifié"}</p>
                                <p className="mt-1 italic">« {match.modificationRequest.reason} »</p>
                              </div>
                              {match.modificationRequest.requestedBy === user?.uid ? (
                                <p className="text-xs font-semibold text-primary-600">En attente de validation adverse</p>
                              ) : (
                                <div className="flex gap-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRespondModification(match, true); }}
                                      disabled={respondingToMod === match.id}
                                      className="flex-1 rounded bg-primary-600 py-1.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50"
                                    >
                                    {respondingToMod === match.id ? "Validation..." : "Accepter"}
                                  </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleRespondModification(match, false); }}
                                      disabled={respondingToMod === match.id}
                                      className="flex-1 rounded border border-primary-300 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                                    >
                                    Refuser
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); openModifyModal(match); }}
                                className="flex items-center gap-1 border border-gray-200/70 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Edit3 size={14} /> {estAmical(match) ? "Déplacer" : "Modifier"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCancelMatch(match.id); }}
                                className="flex items-center gap-1 border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <XCircle size={14} /> Annuler
                              </button>
                              {/* "Trouver un arbitre" pointait vers /referees, resté
                                  au placard. L'arbitre de terrain se saisit en
                                  texte libre à la création (localRefereeName). */}
                            </div>
                          )}
                        </div>
                      )}

                      {(isDraft || match.status === "pending") && (
                        <div className="mt-3 sm:mt-4 flex flex-col gap-2">
                          {/* Un amical resté en « pending » date d'avant la
                              correction : le quota adverse qu'il attendait ne
                              pouvait jamais tomber. On le débloque à la main
                              plutôt que de laisser ces matchs pourrir. */}
                          {match.status === "pending" && estAmical(match) && (
                            <div className="mb-2 flex flex-col gap-2 border border-amber-100 bg-amber-50 p-3">
                              <p className="text-[11px] text-amber-700">
                                Ce match attend un quota côté adverse, qui n&apos;existe pas :
                                l&apos;équipe en face n&apos;est pas sur KoppaFoot.
                              </p>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleProgramFriendly(match.id); }}
                                disabled={completing === match.id}
                                className="inline-flex items-center justify-center gap-2 bg-amber-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                              >
                                <CheckCircle size={14} /> Programmer ce match
                              </button>
                            </div>
                          )}
                          {match.status === "pending" && !estAmical(match) && (
                             <div className="mb-2 p-3 bg-amber-50 border border-amber-100 italic">
                               <p className="text-[11px] text-amber-700">
                                 En attente du quota minimum de joueurs ({quotaMinimum(match.format)} confirmés par équipe).
                               </p>
                             </div>
                          )}

                          {match.status !== "pending" && (
                            <div className="flex gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleForceComplete(match.id); }}
                                  disabled={
                                    completing === match.id ||
                                    // Sur un amical, le quota ne protège personne :
                                    // le manager est le seul témoin du match.
                                    (!estAmical(match) && (
                                      match.confirmedHome < quotaMinimum(match.format) ||
                                      match.confirmedAway < quotaMinimum(match.format)
                                    ))
                                  }
                                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                {completing === match.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <CheckCircle size={14} />
                                )}
                                Confirmer & Terminer
                              </button>
                            </div>
                          )}
                          {/* Annuler et supprimer sont deux gestes différents :
                              le premier garde la trace d'un match qui n'a pas
                              eu lieu, le second efface. Ils partageaient le
                              même appel. */}
                          {(match.status === "challenge" || match.status === "pending") ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelMatch(match.id); }}
                              className="w-full inline-flex items-center justify-center gap-2 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <XCircle size={14} /> Annuler le défi
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteMatch(match); }}
                              disabled={completing === match.id}
                              className="w-full inline-flex items-center justify-center gap-2 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              {completing === match.id
                                ? <Loader2 size={14} className="animate-spin" />
                                : <Trash2 size={14} />}
                              Supprimer
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    </div>

                    {/* Arrow (completed) */}
                    {match.status === "completed" && (
                      <div className="hidden sm:flex items-center pr-4 pt-10">
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {displayed.length === 0 && (tab !== "todo" || challenges.length === 0) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center border border-dashed border-gray-200/70 bg-white py-16"
            >
              <div className="flex h-16 w-16 items-center justify-center bg-gray-100">
                {tab === "upcoming" ? (
                  <Calendar size={32} className="text-gray-300" />
                ) : tab === "completed" ? (
                  <Trophy size={32} className="text-gray-300" />
                ) : (
                  <Edit3 size={32} className="text-gray-300" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                {tab === "upcoming" && "Aucun match programmé"}
                {tab === "completed" && "Aucun match terminé"}
                {tab === "todo" && "Rien à traiter"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {tab === "upcoming"
                  ? "Programme ton prochain match avec le bouton ci-dessus"
                  : tab === "completed"
                  ? "L'historique de tes matchs apparaîtra ici"
                  : "Défis reçus, défis envoyés et brouillons apparaîtront ici"}
              </p>
            </motion.div>
          )}
        </div>
      )}

      {/* Player Rating Modal */}
      <AnimatePresence>
        {ratingMatch && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 modal-layer bg-gray-900/40 backdrop-blur-sm" onClick={() => setRatingMatch(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 modal-layer w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-white max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-gray-200/70 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 font-display">Noter les joueurs</h3>
                <button onClick={() => setRatingMatch(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {ratingPlayers.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">Aucun joueur sur la feuille de ce match</p>
                ) : ratingPlayers.map((player) => {
                  const score = ratings[player.id] ?? 0;
                  return (
                    <div key={player.id} className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{player.nom}</p>
                        <p className="text-xs text-gray-400">
                          {player.poste}
                          {player.sansCompte && (
                            <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-gray-300">
                              sans compte
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="range" min={1} max={10} step={1} value={score || 5}
                          onChange={(e) => setRatings((r) => ({ ...r, [player.id]: Number(e.target.value) }))}
                          className="w-24 accent-primary-600" />
                        <span className={`w-8 text-center text-sm font-bold ${score >= 8 ? "text-emerald-600" : score >= 5 ? "text-amber-600" : score > 0 ? "text-red-500" : "text-gray-300"}`}>
                          {score || "–"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-gray-200/70 px-6 py-4 flex justify-end gap-3">
                <button onClick={() => setRatingMatch(null)} className=" px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">Annuler</button>
                <button onClick={handleSaveRatings} disabled={savingRatings || ratingPlayers.length === 0}
                  className=" bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 min-w-[120px] justify-center">
                  {savingRatings ? <Loader2 size={16} className="animate-spin" /> : <><Star size={14} /> Enregistrer</>}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modification Modal */}
      <AnimatePresence>
        {modifyingMatch && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 modal-layer bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setModifyingMatch(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 modal-layer w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-white"
            >
              <div className="flex items-center justify-between border-b border-gray-200/70 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 font-display">
                  {estAmical(modifyingMatch) ? "Déplacer le match" : "Modifier le match"}
                </h3>
                <button onClick={() => setModifyingMatch(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleRequestModification} className="p-6">
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Nouvelle date</label>
                      <input
                        type="date"
                        value={modDate}
                        onChange={(e) => setModDate(e.target.value)}
                        required
                        min={aujourdhui()}
                        className="w-full border border-gray-200/70 px-3 py-2 outline-none focus:border-primary-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Nouvelle heure</label>
                      <input
                        type="time"
                        value={modTime}
                        onChange={(e) => setModTime(e.target.value)}
                        required
                        className="w-full border border-gray-200/70 px-3 py-2 outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                  {/* Le select était `required` sur une collection venues vide
                      chez la plupart des clubs : le formulaire ne partait
                      jamais. Même repli qu'à la création, la saisie libre. */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nouveau terrain</label>
                    {venues.length > 0 && (
                      <select
                        value={modVenueId}
                        onChange={(e) => setModVenueId(e.target.value)}
                        className="w-full border border-gray-200/70 px-3 py-2 outline-none focus:border-primary-500"
                      >
                        <option value="">Autre terrain (saisie libre)</option>
                        {venues.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    )}
                    <AvisTerrain
                      venue={venues.find((v) => v.id === modVenueId)}
                      date={modDate}
                      duree={dureeDuMatch(modifyingMatch.format)}
                    />
                    {!modVenueId && (
                      <div className={`grid grid-cols-2 gap-2 ${venues.length > 0 ? "mt-2" : ""}`}>
                        <input
                          type="text"
                          value={modVenueName}
                          onChange={(e) => setModVenueName(e.target.value)}
                          placeholder="Nom du terrain"
                          className="w-full border border-gray-200/70 px-3 py-2 text-sm outline-none focus:border-primary-500"
                        />
                        <input
                          type="text"
                          value={modVenueCity}
                          onChange={(e) => setModVenueCity(e.target.value)}
                          placeholder="Ville"
                          className="w-full border border-gray-200/70 px-3 py-2 text-sm outline-none focus:border-primary-500"
                        />
                      </div>
                    )}
                  </div>
                  {/* Le motif s'adresse au manager adverse. Sur un amical il n'y
                      en a pas : on ne demande pas de se justifier auprès de soi. */}
                  {!estAmical(modifyingMatch) && modifyingMatch.status !== "challenge" && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Motif de la modification</label>
                      <textarea
                        value={modReason}
                        onChange={(e) => setModReason(e.target.value)}
                        required
                        placeholder="Expliquez pourquoi vous souhaitez modifier ce match..."
                        className="w-full h-24 resize-none border border-gray-200/70 px-3 py-2 outline-none focus:border-primary-500 text-sm"
                      />
                    </div>
                  )}
                  {estAmical(modifyingMatch) && (
                    <p className="border border-gray-200/70 bg-gray-50 px-3 py-2.5 text-xs text-gray-600">
                      L&apos;adversaire n&apos;est pas sur KoppaFoot : le changement s&apos;applique
                      tout de suite et tes joueurs convoqués sont prévenus.
                    </p>
                  )}
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModifyingMatch(null)}
                    className=" px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingMod}
                    className=" bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                  >
                    {submittingMod
                      ? <Loader2 size={16} className="animate-spin" />
                      : estAmical(modifyingMatch) ? "Déplacer le match"
                      : modifyingMatch.status === "challenge" ? "Modifier le défi" : "Envoyer la demande"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
