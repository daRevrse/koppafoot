"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  Trophy, Search, Calendar, MapPin, Users, Loader2,
  Clock, CheckCircle, XCircle, AlertCircle, Zap,
} from "lucide-react";
import { getAllMatches } from "@/lib/admin-firestore";
import type { Match, MatchStatus } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  challenge: { label: "Défi envoyé", color: "text-yellow-700", bg: "bg-yellow-50", icon: Zap },
  pending: { label: "En attente", color: "text-amber-700", bg: "bg-amber-50", icon: Clock },
  upcoming: { label: "À venir", color: "text-blue-700", bg: "bg-blue-50", icon: Calendar },
  completed: { label: "Terminé", color: "text-emerald-700", bg: "bg-emerald-50", icon: CheckCircle },
  cancelled: { label: "Annulé", color: "text-red-700", bg: "bg-red-50", icon: XCircle },
};

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MatchStatus | "all">("all");

  useEffect(() => {
    getAllMatches(300)
      .then(setMatches)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return matches.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          m.homeTeamName.toLowerCase().includes(s) ||
          m.awayTeamName.toLowerCase().includes(s) ||
          m.venueName.toLowerCase().includes(s) ||
          m.venueCity.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [matches, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    matches.forEach((m) => map.set(m.status, (map.get(m.status) ?? 0) + 1));
    return map;
  }, [matches]);

  return (
    <div className="space-y-6">
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Gestion des matchs
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          {matches.length} match{matches.length > 1 ? "s" : ""} au total
        </motion.p>
      </div>

      {/* Status filter pills */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {[
          { value: "all" as const, label: "Tous" },
          { value: "challenge" as const, label: "Défis" },
          { value: "pending" as const, label: "En attente" },
          { value: "upcoming" as const, label: "À venir" },
          { value: "completed" as const, label: "Terminés" },
          { value: "cancelled" as const, label: "Annulés" },
        ].map((pill) => {
          const count = pill.value === "all" ? matches.length : (statusCounts.get(pill.value) ?? 0);
          return (
            <button
              key={pill.value}
              onClick={() => setStatusFilter(pill.value)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === pill.value
                  ? "bg-gray-900 text-white shadow-md"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"
              }`}
            >
              {pill.label}
              <span className={`h-4 min-w-4 rounded-full px-1 text-[10px] leading-4 font-bold text-center ${
                statusFilter === pill.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par équipe, terrain, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </motion.div>

      {/* Matches list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Trophy size={40} className="mb-3 opacity-40" />
          <p className="text-sm font-medium">Aucun match trouvé</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Match</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Date & Heure</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Terrain</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Format</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Score</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Arbitre</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((m, i) => {
                  const statusConf = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = statusConf.icon;
                  return (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
                            <Trophy size={14} className="text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                              {m.homeTeamName} <span className="text-gray-400 font-normal">vs</span> {m.awayTeamName}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-sm text-gray-900">{m.date}</p>
                          <p className="text-xs text-gray-500">{m.time}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-sm text-gray-700">{m.venueName}</p>
                          <p className="text-xs text-gray-400">{m.venueCity}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {m.format}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {m.status === "completed" && m.scoreHome != null ? (
                          <span className="text-sm font-bold text-gray-900 font-display">
                            {m.scoreHome} - {m.scoreAway}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-gray-600">{m.refereeName || "—"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConf.bg} ${statusConf.color}`}>
                          <StatusIcon size={12} />
                          {statusConf.label}
                        </span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">
        {filtered.length} match{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}
