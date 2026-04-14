"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Search, MapPin, Users, Star, Shield, Filter,
  UserPlus, ChevronDown, X,
} from "lucide-react";

// ============================================
// Mock data
// ============================================

interface SearchTeam {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  maxMembers: number;
  level: "beginner" | "amateur" | "intermediate" | "advanced";
  lookingFor: string[];
  description: string;
  wins: number;
  matchesPlayed: number;
  color: string;
}

const AVAILABLE_TEAMS: SearchTeam[] = [
  {
    id: "t1",
    name: "AS Tonnerre",
    city: "Lyon",
    memberCount: 10,
    maxMembers: 14,
    level: "intermediate",
    lookingFor: ["Gardien", "Milieu"],
    description: "Équipe conviviale cherchant joueurs motivés pour matchs hebdomadaires.",
    wins: 12,
    matchesPlayed: 18,
    color: "amber",
  },
  {
    id: "t2",
    name: "FC Étoile",
    city: "Paris",
    memberCount: 8,
    maxMembers: 14,
    level: "beginner",
    lookingFor: ["Attaquant", "Défenseur", "Milieu"],
    description: "Nouvelle équipe, ambiance détendue, tous niveaux bienvenus !",
    wins: 3,
    matchesPlayed: 8,
    color: "blue",
  },
  {
    id: "t3",
    name: "Olympique Réunis",
    city: "Marseille",
    memberCount: 13,
    maxMembers: 16,
    level: "advanced",
    lookingFor: ["Gardien"],
    description: "Équipe compétitive, entraînements 2x/semaine, objectif tournoi.",
    wins: 20,
    matchesPlayed: 25,
    color: "emerald",
  },
  {
    id: "t4",
    name: "Red Wolves FC",
    city: "Toulouse",
    memberCount: 7,
    maxMembers: 11,
    level: "amateur",
    lookingFor: ["Attaquant", "Défenseur", "Gardien", "Milieu"],
    description: "Équipe en construction, matchs le week-end, bonne humeur garantie.",
    wins: 6,
    matchesPlayed: 12,
    color: "red",
  },
  {
    id: "t5",
    name: "Inter Quartier",
    city: "Paris",
    memberCount: 12,
    maxMembers: 16,
    level: "intermediate",
    lookingFor: ["Milieu", "Attaquant"],
    description: "Équipe de quartier avec bon état d'esprit. Matchs amicaux et tournois.",
    wins: 9,
    matchesPlayed: 15,
    color: "purple",
  },
  {
    id: "t6",
    name: "FC Phenix",
    city: "Lyon",
    memberCount: 11,
    maxMembers: 14,
    level: "amateur",
    lookingFor: ["Défenseur"],
    description: "Cherchons un défenseur solide pour renforcer notre arrière-garde.",
    wins: 7,
    matchesPlayed: 14,
    color: "orange",
  },
];

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
// Component
// ============================================

export default function TeamSearchPage() {
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [levelFilter, setLevelFilter] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [appliedTeams, setAppliedTeams] = useState<Set<string>>(new Set());

  const filtered = AVAILABLE_TEAMS.filter((t) => {
    if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (cityFilter !== "Toutes" && t.city !== cityFilter) return false;
    if (levelFilter !== "Tous" && t.level !== levelFilter) return false;
    return true;
  });

  const handleApply = (teamId: string) => {
    setAppliedTeams((prev) => new Set([...prev, teamId]));
  };

  return (
    <div className="space-y-6">
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
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{filtered.length}</span> équipe{filtered.length > 1 ? "s" : ""} trouvée{filtered.length > 1 ? "s" : ""}
      </p>

      {/* Results grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team, i) => {
            const colors = COLOR_MAP[team.color] ?? COLOR_MAP.emerald;
            const hasApplied = appliedTeams.has(team.id);
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
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${LEVEL_COLORS[team.level]}`}>
                      {LEVEL_LABELS[team.level]}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">{team.description}</p>

                  {/* Looking for */}
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

                  {/* Stats */}
                  <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {team.memberCount}/{team.maxMembers}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={12} /> {winRate}% victoires
                    </span>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleApply(team.id)}
                    disabled={hasApplied}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      hasApplied
                        ? "bg-primary-50 text-primary-600 cursor-default"
                        : "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
                    }`}
                  >
                    {hasApplied ? (
                      <>Candidature envoyée</>
                    ) : (
                      <><UserPlus size={16} /> Rejoindre</>
                    )}
                  </button>
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
    </div>
  );
}
