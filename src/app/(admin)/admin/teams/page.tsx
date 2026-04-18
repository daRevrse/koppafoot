"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Shield, Search, Users, MapPin, Trophy, TrendingUp,
  Loader2, ChevronRight, Star,
} from "lucide-react";
import { getAllTeams } from "@/lib/admin-firestore";
import type { Team } from "@/types";

const LEVEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  beginner: { label: "Débutant", color: "text-green-700", bg: "bg-green-50" },
  amateur: { label: "Amateur", color: "text-blue-700", bg: "bg-blue-50" },
  intermediate: { label: "Intermédiaire", color: "text-amber-700", bg: "bg-amber-50" },
  advanced: { label: "Avancé", color: "text-red-700", bg: "bg-red-50" },
};

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  useEffect(() => {
    getAllTeams(300)
      .then(setTeams)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return teams.filter((t) => {
      if (levelFilter !== "all" && t.level !== levelFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.name.toLowerCase().includes(s) || t.city.toLowerCase().includes(s);
      }
      return true;
    });
  }, [teams, search, levelFilter]);

  const avgMembers = teams.length > 0
    ? Math.round(teams.reduce((a, t) => a + t.memberIds.length, 0) / teams.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Gestion des équipes
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          {teams.length} équipe{teams.length > 1 ? "s" : ""} enregistrée{teams.length > 1 ? "s" : ""}
        </motion.p>
      </div>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Shield, label: "Total équipes", value: teams.length, color: "bg-emerald-50 text-emerald-600" },
          { icon: Users, label: "Joueurs moyens/équipe", value: avgMembers, color: "bg-blue-50 text-blue-600" },
          { icon: Star, label: "En recrutement", value: teams.filter((t) => t.isRecruiting).length, color: "bg-amber-50 text-amber-600" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${s.color}`}>
              <s.icon size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 font-display">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">Tous niveaux</option>
          <option value="beginner">Débutant</option>
          <option value="amateur">Amateur</option>
          <option value="intermediate">Intermédiaire</option>
          <option value="advanced">Avancé</option>
        </select>
      </div>

      {/* Teams grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Shield size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">Aucune équipe trouvée</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team, i) => {
            const lvl = LEVEL_CONFIG[team.level] ?? LEVEL_CONFIG.beginner;
            const winRate = team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0;
            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                whileHover={{ y: -2 }}
                className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-sm"
                      style={{ backgroundColor: team.color || "#059669" }}
                    >
                      {team.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{team.name}</h3>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={11} /> {team.city}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lvl.bg} ${lvl.color}`}>
                    {lvl.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-lg font-bold text-gray-900 font-display">{team.memberIds.length}</p>
                    <p className="text-[10px] text-gray-500">Joueurs</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-lg font-bold text-gray-900 font-display">{team.matchesPlayed}</p>
                    <p className="text-[10px] text-gray-500">Matchs</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 text-center">
                    <p className="text-lg font-bold text-emerald-600 font-display">{winRate}%</p>
                    <p className="text-[10px] text-gray-500">Victoires</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Trophy size={12} className="text-emerald-500" /> {team.wins}V
                    </span>
                    <span>{team.draws}N</span>
                    <span>{team.losses}D</span>
                  </div>
                  {team.isRecruiting && (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5">
                      Recrute
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">
        {filtered.length} équipe{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
