"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Calendar, MapPin, Clock, Users, Shield,
  Plus, CheckCircle, XCircle, Timer, ChevronRight,
  Edit3, Trash2, Award, X, AlertCircle, Loader2, Search, Send,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  updateMatchStatus,
  forceCompleteMatch,
  getMatchesByManager,
  onMatchesByManager,
  getTeamsByManager,
  getVenues,
  createMatch,
  cancelMatch,
  searchTeams,
  getTeamById,
  getUsersByIds,
  onMatchChallengesForManager,
  respondToMatchChallenge,
  requestMatchModification,
  respondToMatchModification,
  respondToRefereeApplication,
} from "@/lib/firestore";
import type { Match, Team, Venue } from "@/types";

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

const FORMAT_TOTAL_PLAYERS: Record<string, number> = { "5v5": 10, "7v7": 14, "11v11": 22 };
const FORMAT_MIN_PER_TEAM: Record<string, number> = { "5v5": 3, "7v7": 5, "11v11": 8 };
const getMinConfirmed = (format: string) => FORMAT_MIN_PER_TEAM[format] || 3;

// ============================================
// Loading skeleton
// ============================================

function MatchSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white">
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

type Tab = "upcoming" | "completed" | "draft" | "challenges";

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [challenges, setChallenges] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);

  // Modification state
  const [modifyingMatch, setModifyingMatch] = useState<Match | null>(null);
  const [modDate, setModDate] = useState("");
  const [modTime, setModTime] = useState("");
  const [modVenueId, setModVenueId] = useState("");
  const [modReason, setModReason] = useState("");
  const [submittingMod, setSubmittingMod] = useState(false);
  const [respondingToMod, setRespondingToMod] = useState<string | null>(null);
  const [respondingToRef, setRespondingToRef] = useState<string | null>(null);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [format, setFormat] = useState("11v11");
  const [isHome, setIsHome] = useState(true);

  // Away team search state
  const [awaySearchQuery, setAwaySearchQuery] = useState("");
  const [awaySearchResults, setAwaySearchResults] = useState<Team[]>([]);
  const [awayTeamId, setAwayTeamId] = useState("");
  const [awayTeamName, setAwayTeamName] = useState("");
  const [awayManagerId, setAwayManagerId] = useState("");
  const [showAwayDropdown, setShowAwayDropdown] = useState(false);
  const awaySearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const awayDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch data on mount
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [matchesData, teamsData, venuesData] = await Promise.all([
        getMatchesByManager(user.uid),
        getTeamsByManager(user.uid),
        getVenues(),
      ]);
      setMatches(matchesData);
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

  // Real-time matches listener
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onMatchesByManager(user.uid, (data: Match[]) => {
      setMatches(data);
      setLoading(false);
    });
    return unsub;
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

  // Debounced away team search
  const handleAwaySearchChange = (value: string) => {
    setAwaySearchQuery(value);
    setAwayTeamId("");
    setAwayTeamName("");
    setAwayManagerId("");

    if (awaySearchTimeout.current) clearTimeout(awaySearchTimeout.current);
    if (!value.trim()) {
      setAwaySearchResults([]);
      setShowAwayDropdown(false);
      return;
    }
    awaySearchTimeout.current = setTimeout(async () => {
      try {
        const results = await searchTeams({ query: value });
        setAwaySearchResults(results);
        setShowAwayDropdown(true);
      } catch (err) {
        console.error("Erreur recherche équipe:", err);
      }
    }, 300);
  };

  const selectAwayTeam = (team: Team) => {
    setAwayTeamId(team.id);
    setAwayTeamName(team.name);
    setAwayManagerId(team.managerId);
    setAwaySearchQuery(team.name);
    setShowAwayDropdown(false);
    setAwaySearchResults([]);
  };

  // Filter matches by tab
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const completed = matches.filter((m) => m.status === "completed");
  const drafts = matches.filter(
    (m) => m.status === "draft" || m.status === "challenge" || m.status === "pending" || m.status === "cancelled"
  );
  const displayed = tab === "upcoming" ? upcoming : tab === "completed" ? completed : tab === "draft" ? drafts : tab === "challenges" ? challenges : [];

  // Create match handler
  const handleCreate = async () => {
    if (!user || !selectedTeamId || !awayTeamName || !matchDate || !matchTime) return;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return;

    const venue = venues.find((v) => v.id === selectedVenueId);
    const homeTeamName = isHome ? team.name : awayTeamName;
    const awayTeamNameFinal = isHome ? awayTeamName : team.name;
    const playersTotal = FORMAT_TOTAL_PLAYERS[format] ?? 22;

    setCreating(true);
    try {
      await createMatch({
        homeTeamId: isHome ? team.id : awayTeamId,
        awayTeamId: isHome ? awayTeamId : team.id,
        homeTeamName,
        awayTeamName: awayTeamNameFinal,
        managerId: user.uid,
        awayManagerId: awayManagerId,
        date: matchDate,
        time: matchTime,
        venueName: venue?.name ?? "",
        venueCity: venue?.city ?? "",
        format,
        isHome,
        playersTotal,
      });

      // Reset form and refresh
      setSelectedTeamId("");
      setAwaySearchQuery("");
      setAwayTeamId("");
      setAwayTeamName("");
      setAwayManagerId("");
      setAwaySearchResults([]);
      setShowAwayDropdown(false);
      setMatchDate("");
      setMatchTime("");
      setSelectedVenueId("");
      setFormat("11v11");
      setIsHome(true);
      setShowCreateForm(false);
      await fetchData();
    } catch (err) {
      console.error("Erreur lors de la création:", err);
    } finally {
      setCreating(false);
    }
  };

  // Cancel match handler
  const handleCancelMatch = async (matchId: string) => {
    try {
      await cancelMatch(matchId);
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
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: "upcoming" } : m));
    } catch (err) {
      console.error("Erreur lors de la confirmation forcée:", err);
    } finally {
      setCompleting(null);
    }
  };

  const handleRequestModification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingMatch || !user) return;
    setSubmittingMod(true);
    try {
      const selectedVenue = venues.find((v) => v.id === modVenueId);
      await requestMatchModification(modifyingMatch.id, {
        date: modDate,
        time: modTime,
        venueName: selectedVenue?.name || "",
        venueCity: selectedVenue?.city || "",
        reason: modReason,
        requestedBy: user.uid,
      });
      setModifyingMatch(null);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la demande de modification");
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
      });
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

  const openModifyModal = (match: Match) => {
    setModifyingMatch(match);
    setModDate(match.date);
    setModTime(match.time);
    const venue = venues.find((v) => v.name === match.venueName);
    setModVenueId(venue?.id || "");
    setModReason("");
  };


  const tabs: { key: Tab; label: string; count: number; icon: typeof Calendar }[] = [
    { key: "upcoming", label: "À venir", count: upcoming.length, icon: Calendar },
    { key: "completed", label: "Terminés", count: completed.length, icon: Trophy },
    { key: "draft", label: "Brouillons & En attente", count: drafts.length, icon: Edit3 },
    { key: "challenges", label: "Défis reçus", count: challenges.length, icon: Shield },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 font-display">Matchs</h1>
          <p className="mt-1 text-sm text-gray-500">Planifie et gère les matchs de ton équipe</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
          >
            <Plus size={16} /> Créer un match
          </button>
        </motion.div>
      </div>

      {/* Create match form */}
      <AnimatePresence>
        {showCreateForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border-2 border-primary-200 bg-primary-50/30 p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-gray-900 font-display">Nouveau match</h3>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* My team select */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Mon équipe</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
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
                      placeholder="Rechercher l'équipe adverse..."
                      className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                    />
                  </div>
                  {showAwayDropdown && awaySearchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      {awaySearchResults.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => selectAwayTeam(team)}
                          className="w-full px-4 py-2.5 text-left text-sm hover:bg-primary-50 transition-colors flex flex-col"
                        >
                          <span className="font-medium text-gray-900">{team.name}</span>
                          <span className="text-xs text-gray-500">{team.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {showAwayDropdown && awaySearchResults.length === 0 && awaySearchQuery.trim() && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg px-4 py-3">
                      <p className="text-sm text-gray-500">Aucune équipe trouvée</p>
                    </div>
                  )}
                </div>
                {/* Date */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                {/* Time */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Heure</label>
                  <input
                    type="time"
                    value={matchTime}
                    onChange={(e) => setMatchTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
                </div>
                {/* Venue */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Terrain</label>
                  <select
                    value={selectedVenueId}
                    onChange={(e) => setSelectedVenueId(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  >
                    <option value="">Sélectionner un terrain</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                    ))}
                  </select>
                </div>
                {/* Format */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Format</label>
                  <div className="flex gap-2">
                    {["5v5", "7v7", "11v11"].map((f) => (
                      <label
                        key={f}
                        className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          format === f
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
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
                    ))}
                  </div>
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
                        className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                          isHome === opt.value
                            ? "border-primary-600 bg-primary-50 text-primary-700"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
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
              <div className="mt-5 flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating || !selectedTeamId || !awayTeamName || !matchDate || !matchTime}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <><Loader2 size={16} className="animate-spin" /> Création...</>
                  ) : (
                    <><Plus size={16} /> Programmer le match</>
                  )}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
        className="flex border-b border-gray-200 overflow-x-auto scrollbar-hide"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={16} /> {t.label}
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                t.key === "challenges" && t.count > 0
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

      {/* Challenges tab content */}
      {!loading && tab === "challenges" && (
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
                className="overflow-hidden rounded-xl border border-dashed border-amber-300 bg-white transition-shadow hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row">
                  {/* Status strip */}
                  <div className="flex items-center justify-center bg-amber-50 sm:w-24 py-2 sm:py-0">
                    <span className="text-xs font-bold text-amber-600">Défi reçu</span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 p-4 sm:p-5">
                    {/* Teams */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Shield size={16} className="text-primary-500" />
                        <span className="text-sm font-bold text-gray-900 truncate">{match.homeTeamName}</span>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-gray-400">VS</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <span className="text-sm font-bold text-gray-900 truncate">{match.awayTeamName}</span>
                        <Shield size={16} className="text-gray-400" />
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {match.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {match.time}
                      </span>
                      {match.venueName ? (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {match.venueName}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-500">
                          <MapPin size={12} /> Terrain à définir
                        </span>
                      )}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">
                        {match.format}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleAcceptChallenge(match)}
                        disabled={accepting === match.id}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle size={14} /> Refuser
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty state for challenges */}
          {challenges.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                <Trophy size={32} className="text-gray-300" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucun défi reçu</h3>
              <p className="mt-1 text-sm text-gray-500">Les autres managers pourront vous défier ici</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Match cards (upcoming / completed / draft tabs) */}
      {!loading && tab !== "challenges" && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {displayed.map((match, i) => {
              const resultConf = match.result ? RESULT_CONFIG[match.result] : null;
              const ResultIcon = resultConf?.icon;
              const refConf = REFEREE_STATUS_CONFIG[match.refereeStatus];
              const RefIcon = refConf.icon;
              const isDraft =
                match.status === "draft" ||
                match.status === "challenge" ||
                match.status === "pending" ||
                match.status === "cancelled";

              return (
                <motion.div
                  key={match.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className={`group overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md ${
                    isDraft ? "border-dashed border-gray-300" : "border-gray-200"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Result / Status strip */}
                    {resultConf && (
                      <div className={`flex items-center justify-center sm:w-24 py-2 sm:py-0 ${resultConf.bg}`}>
                        <div className="flex sm:flex-col items-center gap-1.5 sm:gap-0.5">
                          {ResultIcon && <ResultIcon size={18} className={resultConf.color} />}
                          <span className={`text-xs font-bold ${resultConf.color}`}>{resultConf.label}</span>
                        </div>
                      </div>
                    )}

                    {match.status === "upcoming" && (
                      <div className="flex items-center justify-center bg-primary-50 sm:w-24 py-2 sm:py-0">
                        <div className="flex sm:flex-col items-center gap-1.5 sm:gap-0">
                          <span className="text-lg font-bold text-primary-600 font-display">{match.time}</span>
                          <span className="text-xs text-primary-500">{match.date}</span>
                        </div>
                      </div>
                    )}

                    {isDraft && (
                      <div className={`flex items-center justify-center sm:w-24 py-2 sm:py-0 ${
                        match.status === "pending" ? "bg-amber-50" : match.status === "cancelled" ? "bg-red-50" : "bg-gray-50"
                      }`}>
                        <span className={`text-xs font-bold ${
                          match.status === "pending" ? "text-amber-600" : match.status === "cancelled" ? "text-red-500" : "text-gray-400"
                        }`}>
                          {match.status === "challenge"
                            ? "Défi envoyé"
                            : match.status === "pending"
                            ? "Accepté"
                            : match.status === "cancelled"
                            ? "Annulé"
                            : "Brouillon"}
                        </span>
                      </div>
                    )}

                    {/* Main content */}
                    <div className="flex-1 p-4 sm:p-5">
                      {/* Teams */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Shield size={16} className={match.isHome ? "text-primary-500" : "text-gray-400"} />
                          <span className={`text-sm truncate ${match.isHome ? "font-bold text-gray-900" : "text-gray-600"}`}>
                            {match.homeTeamName}
                          </span>
                        </div>

                        {match.scoreHome !== null && match.scoreAway !== null ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-lg font-bold text-gray-900 font-display">{match.scoreHome}</span>
                            <span className="text-xs text-gray-400">-</span>
                            <span className="text-lg font-bold text-gray-900 font-display">{match.scoreAway}</span>
                          </div>
                        ) : (
                          <span className="shrink-0 text-xs font-medium text-gray-400">
                            {isDraft && !match.awayTeamName ? "?" : "VS"}
                          </span>
                        )}

                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={`text-sm truncate ${!match.isHome ? "font-bold text-gray-900" : "text-gray-600"}`}>
                            {match.awayTeamName || "À définir"}
                          </span>
                          <Shield size={16} className={!match.isHome ? "text-primary-500" : "text-gray-400"} />
                        </div>
                      </div>

                      {/* Meta row */}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} /> {match.date}
                        </span>
                        {match.venueName ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {match.venueName}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-500">
                            <MapPin size={12} /> Terrain à définir
                          </span>
                        )}
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium">
                          {match.format}
                        </span>
                      </div>

                      {/* Referee + Players row (upcoming/draft only) */}
                      {(match.status === "upcoming" || isDraft) && (
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${refConf.color}`}>
                            <RefIcon size={12} /> {refConf.label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Users size={12} />
                              Confirmations:
                            </span>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-0.5 border border-gray-100">
                              <span className="text-[10px] uppercase font-bold text-gray-400">Dom.</span>
                              <span className={`text-xs font-bold ${match.confirmedHome >= getMinConfirmed(match.format) ? "text-emerald-600" : "text-amber-600"}`}>
                                {match.confirmedHome}
                              </span>
                              <span className="text-gray-300">/</span>
                              <span className="text-[10px] uppercase font-bold text-gray-400">Ext.</span>
                              <span className={`text-xs font-bold ${match.confirmedAway >= getMinConfirmed(match.format) ? "text-emerald-600" : "text-amber-600"}`}>
                                {match.confirmedAway}
                              </span>
                              <span className="text-gray-300 ml-1">|</span>
                              <span className="text-[10px] font-medium text-gray-400 ml-1">Total {FORMAT_TOTAL_PLAYERS[match.format] || 0}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Referee application management */}
                      {match.refereeStatus === "pending" && match.managerId === user?.uid && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <Award size={16} className="text-amber-600" />
                              <span className="text-sm font-bold text-amber-900">Demande d'arbitrage</span>
                            </div>
                            <span className="text-xs font-bold text-amber-700 italic">{match.refereeName}</span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRespondReferee(match.id, true)}
                              disabled={respondingToRef === match.id}
                              className="flex-1 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                            >
                              {respondingToRef === match.id ? "Validation..." : "Accepter l'arbitre"}
                            </button>
                            <button
                              onClick={() => handleRespondReferee(match.id, false)}
                              disabled={respondingToRef === match.id}
                              className="flex-1 rounded-lg border border-amber-300 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              Refuser
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Referee name (completed) */}
                      {match.status === "completed" && match.refereeName && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                          <Award size={12} /> Arbitre : {match.refereeName}
                        </div>
                      )}

                      {/* Actions */}
                      {match.status === "upcoming" && (
                        <div className="mt-4 flex flex-col gap-3">
                          {match.modificationRequest ? (
                            <div className="rounded-lg border border-primary-200 bg-primary-50 p-3">
                              <p className="text-sm font-medium text-primary-800 mb-1">Demande de modification</p>
                              <div className="text-xs text-primary-700 bg-white/50 rounded p-2 mb-2">
                                <p><strong>Nouvelle date:</strong> {match.modificationRequest.date} à {match.modificationRequest.time}</p>
                                <p><strong>Nouveau terrain:</strong> {match.modificationRequest.venueName || "Non spécifié"}</p>
                                <p className="mt-1 italic">"{match.modificationRequest.reason}"</p>
                              </div>
                              {match.modificationRequest.requestedBy === user?.uid ? (
                                <p className="text-xs font-semibold text-primary-600">En attente de validation adverse</p>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleRespondModification(match, true)}
                                    disabled={respondingToMod === match.id}
                                    className="flex-1 rounded bg-primary-600 py-1.5 text-xs font-bold text-white hover:bg-primary-700 disabled:opacity-50"
                                  >
                                    {respondingToMod === match.id ? "Validation..." : "Accepter"}
                                  </button>
                                  <button
                                    onClick={() => handleRespondModification(match, false)}
                                    disabled={respondingToMod === match.id}
                                    className="flex-1 rounded border border-primary-300 py-1.5 text-xs font-bold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
                                  >
                                    Refuser
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => openModifyModal(match)}
                                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <Edit3 size={14} /> Modifier
                              </button>
                              <button
                                onClick={() => handleCancelMatch(match.id)}
                                className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <XCircle size={14} /> Annuler
                              </button>
                              {match.refereeStatus === "none" && match.managerId === user?.uid && (
                                <a
                                  href={`/referees?matchId=${match.id}`}
                                  className="flex items-center gap-1 rounded-lg border border-primary-200 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                                >
                                  <Award size={14} /> Trouver un arbitre
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {(isDraft || match.status === "pending") && (
                        <div className="mt-4 flex flex-col gap-2">
                          {match.status === "pending" && (
                             <div className="mb-2 p-3 rounded-lg bg-amber-50 border border-amber-100 italic">
                               <p className="text-[11px] text-amber-700">
                                 En attente du quota minimum de joueurs ({getMinConfirmed(match.format)} confirmés par équipe).
                               </p>
                             </div>
                          )}

                          {match.status !== "pending" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleForceComplete(match.id)}
                                disabled={completing === match.id || match.confirmedHome < getMinConfirmed(match.format) || match.confirmedAway < getMinConfirmed(match.format)}
                                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                          <button
                            onClick={() => handleCancelMatch(match.id)}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={14} /> {match.status === "challenge" || match.status === "pending" ? "Annuler le défi" : "Supprimer"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Arrow (completed) */}
                    {match.status === "completed" && (
                      <div className="hidden sm:flex items-center pr-4">
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {displayed.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
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
                {tab === "draft" && "Aucun brouillon"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {tab === "upcoming"
                  ? "Programme ton prochain match avec le bouton ci-dessus"
                  : tab === "completed"
                  ? "L'historique de tes matchs apparaîtra ici"
                  : "Les matchs en cours de préparation apparaîtront ici"}
              </p>
            </motion.div>
          )}
        </div>
      )}

      {/* Modification Modal */}
      <AnimatePresence>
        {modifyingMatch && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setModifyingMatch(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <h3 className="text-lg font-bold text-gray-900 font-display">Modifier le match</h3>
                <button onClick={() => setModifyingMatch(null)} className="text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleRequestModification} className="p-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Nouvelle date</label>
                      <input
                        type="date"
                        value={modDate}
                        onChange={(e) => setModDate(e.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-primary-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Nouvelle heure</label>
                      <input
                        type="time"
                        value={modTime}
                        onChange={(e) => setModTime(e.target.value)}
                        required
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nouveau terrain</label>
                    <select
                      value={modVenueId}
                      onChange={(e) => setModVenueId(e.target.value)}
                      required
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-primary-500"
                    >
                      <option value="">Sélectionner un terrain</option>
                      {venues.map((v) => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Motif de la modification</label>
                    <textarea
                      value={modReason}
                      onChange={(e) => setModReason(e.target.value)}
                      required
                      placeholder="Expliquez pourquoi vous souhaitez modifier ce match..."
                      className="w-full h-24 resize-none rounded-lg border border-gray-200 px-3 py-2 outline-none focus:border-primary-500 text-sm"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModifyingMatch(null)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submittingMod}
                    className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                  >
                    {submittingMod ? <Loader2 size={16} className="animate-spin" /> : "Envoyer la demande"}
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
