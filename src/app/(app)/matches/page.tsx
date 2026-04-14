"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Calendar, MapPin, Clock, Users, Shield,
  Plus, CheckCircle, XCircle, Timer, ChevronRight,
  Edit3, Trash2, Award, X, AlertCircle, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMatchesByManager,
  getTeamsByManager,
  getVenues,
  createMatch,
  deleteMatch,
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
  pending: { label: "Arbitre en attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  none: { label: "Non assigné", color: "bg-gray-100 text-gray-500", icon: AlertCircle },
};

const FORMAT_PLAYERS: Record<string, number> = { "5v5": 5, "7v7": 7, "11v11": 11 };

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

type Tab = "upcoming" | "completed" | "draft";

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [format, setFormat] = useState("11v11");
  const [isHome, setIsHome] = useState(true);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter matches by tab
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const completed = matches.filter((m) => m.status === "completed");
  const drafts = matches.filter(
    (m) => m.status === "draft" || m.status === "challenge" || m.status === "pending",
  );
  const displayed = tab === "upcoming" ? upcoming : tab === "completed" ? completed : drafts;

  // Create match handler
  const handleCreate = async () => {
    if (!user || !selectedTeamId || !opponentName || !matchDate || !matchTime) return;
    const team = teams.find((t) => t.id === selectedTeamId);
    if (!team) return;

    const venue = venues.find((v) => v.id === selectedVenueId);
    const homeTeamName = isHome ? team.name : opponentName;
    const awayTeamName = isHome ? opponentName : team.name;
    const playersTotal = FORMAT_PLAYERS[format] ?? 11;

    setCreating(true);
    try {
      await createMatch({
        homeTeamId: isHome ? team.id : "",
        awayTeamId: isHome ? "" : team.id,
        homeTeamName,
        awayTeamName,
        managerId: user.uid,
        awayManagerId: "",
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
      setOpponentName("");
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

  // Delete/cancel match handler
  const handleDelete = async (matchId: string) => {
    try {
      await deleteMatch(matchId);
      setMatches((prev) => prev.filter((m) => m.id !== matchId));
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
    }
  };

  const tabs: { key: Tab; label: string; count: number; icon: typeof Calendar }[] = [
    { key: "upcoming", label: "À venir", count: upcoming.length, icon: Calendar },
    { key: "completed", label: "Terminés", count: completed.length, icon: Trophy },
    { key: "draft", label: "Brouillons", count: drafts.length, icon: Edit3 },
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
                {/* Opponent */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">Adversaire</label>
                  <input
                    type="text"
                    value={opponentName}
                    onChange={(e) => setOpponentName(e.target.value)}
                    placeholder="Nom de l'équipe adverse"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                  />
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
                  disabled={creating || !selectedTeamId || !opponentName || !matchDate || !matchTime}
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
        className="flex border-b border-gray-200"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon size={16} /> {t.label}
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                tab === t.key ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Loading state */}
      {loading && <MatchSkeleton />}

      {/* Match cards */}
      {!loading && (
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
                match.status === "pending";

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
                      <div className="flex items-center justify-center bg-gray-50 sm:w-24 py-2 sm:py-0">
                        <span className="text-xs font-bold text-gray-400">
                          {match.status === "challenge"
                            ? "Défi"
                            : match.status === "pending"
                            ? "En attente"
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
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Users size={12} />
                            <span className="font-semibold text-gray-700">{match.playersConfirmed}</span>/{match.playersTotal} joueurs confirmés
                          </span>
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
                        <div className="mt-4 flex gap-2">
                          <button className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                            <Edit3 size={14} /> Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(match.id)}
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <XCircle size={14} /> Annuler
                          </button>
                          {match.refereeStatus === "none" && (
                            <a
                              href="/referees"
                              className="flex items-center gap-1 rounded-lg border border-primary-200 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors"
                            >
                              <Award size={14} /> Trouver un arbitre
                            </a>
                          )}
                        </div>
                      )}

                      {isDraft && (
                        <div className="mt-4 flex gap-2">
                          <button className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
                            <Edit3 size={14} /> Compléter
                          </button>
                          <button
                            onClick={() => handleDelete(match.id)}
                            className="flex items-center gap-1 rounded-lg text-sm font-medium text-red-500 hover:text-red-700 px-3 py-2 transition-colors"
                          >
                            <Trash2 size={14} /> Supprimer
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
    </div>
  );
}
