"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Users, Star, Shield, Filter,
  UserPlus, ChevronDown, X, Loader2, Send,
} from "lucide-react";
import { searchTeams, createJoinRequest, getJoinRequestsByPlayer } from "@/lib/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { Team } from "@/types";

// ============================================
// Helpers
// ============================================

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  amateur: "Amateur",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700",
  amateur: "bg-blue-100 text-blue-700",
  intermediate: "bg-amber-100 text-amber-700",
  advanced: "bg-red-100 text-red-700",
};

const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  amber: { bg: "bg-amber-100", icon: "text-amber-600" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600" },
  red: { bg: "bg-red-100", icon: "text-red-600" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600" },
};

const CITIES = ["Toutes", "Paris", "Lyon", "Marseille", "Toulouse"];
const LEVELS = ["Tous", "beginner", "amateur", "intermediate", "advanced"];

// ============================================
// Candidature Modal
// ============================================

function CandidatureModal({
  team,
  onClose,
  onSubmit,
  submitting,
}: {
  team: Team;
  onClose: () => void;
  onSubmit: (message: string) => Promise<void>;
  submitting: boolean;
}) {
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">
            Candidater à {team.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Votre message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={500}
              rows={5}
              placeholder="Présentez-vous et expliquez pourquoi vous souhaitez rejoindre cette équipe..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 resize-none transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {message.length}/500
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><Loader2 size={16} className="animate-spin" /> Envoi...</>
              ) : (
                <><Send size={16} /> Envoyer ma candidature</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function TeamSearchPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [levelFilter, setLevelFilter] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [candidatureTeam, setCandidatureTeam] = useState<Team | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successTeam, setSuccessTeam] = useState<string | null>(null);

  const isPlayer = user?.userType === "player";

  // Fetch teams when filters change
  useEffect(() => {
    let cancelled = false;

    const fetchTeams = async () => {
      setLoading(true);
      try {
        const filters: { city?: string; level?: string; query?: string } = {};
        if (cityFilter !== "Toutes") filters.city = cityFilter;
        if (levelFilter !== "Tous") filters.level = levelFilter;
        if (query.trim()) filters.query = query.trim();

        const data = await searchTeams(filters);
        if (!cancelled) {
          setTeams(data);
        }
      } catch {
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Debounce the query filter
    const timer = setTimeout(fetchTeams, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, cityFilter, levelFilter]);

  // Pre-load existing pending candidatures on mount
  useEffect(() => {
    if (!user) return;
    getJoinRequestsByPlayer(user.uid).then((reqs) => {
      const pending = reqs.filter((r) => r.status === "pending").map((r) => r.teamId);
      setSentRequests(new Set(pending));
    });
  }, [user]);

  // Auto-dismiss success toast
  useEffect(() => {
    if (!successTeam) return;
    const t = setTimeout(() => setSuccessTeam(null), 3000);
    return () => clearTimeout(t);
  }, [successTeam]);

  const handleCandidatureSubmit = async (message: string) => {
    if (!user || !candidatureTeam) return;
    setSubmitting(true);
    try {
      await createJoinRequest({
        playerId: user.uid,
        playerName: `${user.firstName} ${user.lastName}`,
        playerCity: user.locationCity,
        playerPosition: user.position ?? "",
        playerLevel: user.skillLevel ?? "",
        teamId: candidatureTeam.id,
        teamName: candidatureTeam.name,
        managerId: candidatureTeam.managerId,
        message,
      });
      setSentRequests((prev) => new Set([...prev, candidatureTeam.id]));
      setSuccessTeam(candidatureTeam.name);
      setCandidatureTeam(null);
    } catch {
      // Silent
    } finally {
      setSubmitting(false);
    }
  };

  // Loading skeleton
  const renderSkeleton = () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 animate-pulse rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="h-5 w-20 animate-pulse rounded-full bg-gray-200" />
          </div>
          <div className="h-10 animate-pulse rounded bg-gray-100" />
          <div className="flex gap-1.5">
            <div className="h-5 w-16 animate-pulse rounded-md bg-gray-100" />
            <div className="h-5 w-14 animate-pulse rounded-md bg-gray-100" />
          </div>
          <div className="flex gap-4">
            <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-10 animate-pulse rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Success toast */}
      <AnimatePresence>
        {successTeam && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg"
          >
            Candidature envoyée !
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">Trouver une équipe</h1>
        <p className="mt-1 text-sm text-gray-500">Explore les équipes qui recrutent près de chez toi</p>
      </motion.div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="space-y-3"
      >
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom d'équipe..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              showFilters
                ? "border-primary-300 bg-primary-50 text-primary-700"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter size={16} /> Filtres
            <ChevronDown size={14} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none"
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Niveau</label>
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l === "Tous" ? "Tous" : LEVEL_LABELS[l]}</option>
                ))}
              </select>
            </div>
            {(cityFilter !== "Toutes" || levelFilter !== "Tous") && (
              <button
                onClick={() => { setCityFilter("Toutes"); setLevelFilter("Tous"); }}
                className="mt-auto flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <X size={14} /> Réinitialiser
              </button>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{teams.length}</span> équipe{teams.length > 1 ? "s" : ""} trouvée{teams.length > 1 ? "s" : ""}
        </p>
      )}

      {/* Results grid */}
      {loading ? (
        renderSkeleton()
      ) : teams.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team, i) => {
            const colors = COLOR_MAP[team.color] ?? COLOR_MAP.emerald;
            const hasSent = sentRequests.has(team.id);
            const winRate = team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0;

            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                <div className="p-5">
                  {/* Team head */}
                  <div className="flex items-start gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colors.bg}`}>
                      <Shield size={22} className={colors.icon} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 font-display truncate">{team.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <MapPin size={12} /> {team.city}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_COLORS[team.level] ?? ""}`}>
                      {LEVEL_LABELS[team.level] ?? team.level}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">{team.description}</p>

                  {/* Looking for */}
                  {team.lookingFor.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {team.lookingFor.map((pos) => (
                        <span
                          key={pos}
                          className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                        >
                          {pos}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {team.memberIds.length}/{team.maxMembers}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={12} /> {winRate}% victoires
                    </span>
                  </div>

                  {/* CTA — only for players */}
                  {isPlayer && (
                    <button
                      onClick={() => !hasSent && setCandidatureTeam(team)}
                      disabled={hasSent}
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                        hasSent
                          ? "bg-primary-50 text-primary-600 cursor-default"
                          : "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
                      }`}
                    >
                      {hasSent ? (
                        <>Candidature envoyée</>
                      ) : (
                        <><UserPlus size={16} /> Candidater</>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
        >
          <Search size={32} className="text-gray-300" />
          <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucun résultat</h3>
          <p className="mt-1 text-sm text-gray-500">Essaie d&apos;élargir tes critères de recherche</p>
        </motion.div>
      )}

      {/* Candidature Modal */}
      <AnimatePresence>
        {candidatureTeam && (
          <CandidatureModal
            team={candidatureTeam}
            onClose={() => setCandidatureTeam(null)}
            onSubmit={handleCandidatureSubmit}
            submitting={submitting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
