"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users, Shield, Trophy, MapPin, TrendingUp, Activity,
  UserPlus, Calendar, MessageCircle, Award, RefreshCw,
  ArrowUpRight, ChevronRight, Zap, Eye, Clock,
} from "lucide-react";
import {
  getPlatformCounts,
  getRecentUsers,
  getRecentMatches,
  type PlatformCounts,
} from "@/lib/admin-firestore";
import type { UserProfile, Match, UserRole } from "@/types";

// ============================================
// Badge helpers
// ============================================

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  player: { label: "Joueur", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  manager: { label: "Manager", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  referee: { label: "Arbitre", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  venue_owner: { label: "Propriétaire", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  superadmin: { label: "Admin", color: "text-red-700", bg: "bg-red-50 border-red-200" },
};

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  challenge: { label: "Défi", dot: "bg-yellow-400", bg: "bg-yellow-50 text-yellow-700" },
  pending: { label: "En attente", dot: "bg-amber-400", bg: "bg-amber-50 text-amber-700" },
  upcoming: { label: "À venir", dot: "bg-blue-400", bg: "bg-blue-50 text-blue-700" },
  completed: { label: "Terminé", dot: "bg-emerald-400", bg: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Annulé", dot: "bg-red-400", bg: "bg-red-50 text-red-700" },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = dateStr?.toDate ? (dateStr as any).toDate() : new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  return `il y a ${Math.floor(diff / 86400)}j`;
}

// ============================================
// StatCard
// ============================================

function AdminStatCard({
  icon: Icon,
  value,
  label,
  color,
  accent,
  delay = 0,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  value: number | string;
  label: string;
  color: string;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 100 }}
      whileHover={{ y: -3, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
      className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all"
    >
      {/* Accent bar */}
      <div className={`absolute left-0 top-0 h-full w-1 ${accent}`} />
      {/* Subtle glow on hover */}
      <div className={`absolute -right-8 -top-8 h-20 w-20 rounded-full ${color} opacity-0 blur-2xl transition-opacity group-hover:opacity-30`} />
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <ArrowUpRight size={16} className="text-gray-300 transition-colors group-hover:text-gray-500" />
      </div>
      <p className="mt-3 text-3xl font-extrabold text-gray-900 font-display tracking-tight">{value}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-500">{label}</p>
    </motion.div>
  );
}

// ============================================
// Role distribution mini chart
// ============================================

function RoleDistribution({ counts }: { counts: PlatformCounts }) {
  const total = counts.users || 1;
  const roles = [
    { role: "player", count: counts.players, color: "bg-emerald-500", label: "Joueurs" },
    { role: "manager", count: counts.managers, color: "bg-blue-500", label: "Managers" },
    { role: "referee", count: counts.referees, color: "bg-purple-500", label: "Arbitres" },
    { role: "venue_owner", count: counts.venueOwners, color: "bg-orange-500", label: "Propriétaires" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-gray-900 font-display">Répartition par rôle</h3>
        <Users size={18} className="text-gray-400" />
      </div>
      {/* Bar */}
      <div className="flex h-3 overflow-hidden rounded-full bg-gray-100 mb-4">
        {roles.map((r) => (
          <motion.div
            key={r.role}
            initial={{ width: 0 }}
            animate={{ width: `${(r.count / total) * 100}%` }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className={`${r.color} first:rounded-l-full last:rounded-r-full`}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2">
        {roles.map((r) => (
          <div key={r.role} className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${r.color}`} />
            <span className="text-xs text-gray-600">
              {r.label}
              <span className="ml-1 font-semibold text-gray-900">{r.count}</span>
              <span className="ml-1 text-gray-400">({total > 0 ? Math.round((r.count / total) * 100) : 0}%)</span>
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ============================================
// Match Status Chart
// ============================================

function MatchStatusChart({ counts }: { counts: PlatformCounts }) {
  const statuses = [
    { label: "En attente", count: counts.matchesPending, color: "bg-amber-400" },
    { label: "À venir", count: counts.matchesUpcoming, color: "bg-blue-400" },
    { label: "Terminés", count: counts.matchesCompleted, color: "bg-emerald-400" },
  ];
  const total = counts.matches || 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-bold text-gray-900 font-display">Statut des matchs</h3>
        <Trophy size={18} className="text-gray-400" />
      </div>
      <div className="space-y-3">
        {statuses.map((s) => {
          const pct = Math.round((s.count / total) * 100);
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-600">{s.label}</span>
                <span className="text-sm font-bold text-gray-900">{s.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className={`h-full rounded-full ${s.color}`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ============================================
// Activity Feed
// ============================================

function ActivityItem({
  icon: Icon,
  title,
  subtitle,
  time,
  iconColor,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  time: string;
  iconColor: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
        <Icon size={15} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{title}</p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <span className="shrink-0 text-xs text-gray-400 mt-0.5">{time}</span>
    </div>
  );
}

// ============================================
// Main Dashboard
// ============================================

export default function AdminDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<PlatformCounts | null>(null);
  const [recentUsers, setRecentUsers] = useState<UserProfile[]>([]);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [c, u, m] = await Promise.all([
        getPlatformCounts(),
        getRecentUsers(8),
        getRecentMatches(8),
      ]);
      setCounts(c);
      setRecentUsers(u);
      setRecentMatches(m);
    } catch (err) {
      console.error("Admin dashboard fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (!user) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton */}
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-64 rounded-2xl bg-gray-100 animate-pulse lg:col-span-2" />
          <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-extrabold text-gray-900 font-display"
          >
            Centre de contrôle
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-gray-500 mt-0.5"
          >
            Surveillance globale de la plateforme KOPPAFOOT
          </motion.p>
        </div>
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Actualiser
        </motion.button>
      </div>

      {/* Quick stats */}
      {counts && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            icon={Users}
            value={counts.users}
            label="Utilisateurs inscrits"
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            accent="bg-blue-500"
            delay={0}
          />
          <AdminStatCard
            icon={Shield}
            value={counts.teams}
            label="Équipes créées"
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
            accent="bg-emerald-500"
            delay={0.05}
          />
          <AdminStatCard
            icon={Trophy}
            value={counts.matches}
            label="Matchs joués"
            color="bg-gradient-to-br from-amber-500 to-orange-500"
            accent="bg-amber-500"
            delay={0.1}
          />
          <AdminStatCard
            icon={MapPin}
            value={counts.venues}
            label="Terrains enregistrés"
            color="bg-gradient-to-br from-purple-500 to-purple-600"
            accent="bg-purple-500"
            delay={0.15}
          />
        </div>
      )}

      {/* Secondary stats */}
      {counts && (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { icon: Zap, label: "Joueurs", value: counts.players, color: "text-emerald-600 bg-emerald-50" },
            { icon: Award, label: "Managers", value: counts.managers, color: "text-blue-600 bg-blue-50" },
            { icon: Eye, label: "Arbitres", value: counts.referees, color: "text-purple-600 bg-purple-50" },
            { icon: MapPin, label: "Propriétaires", value: counts.venueOwners, color: "text-orange-600 bg-orange-50" },
            { icon: MessageCircle, label: "Posts", value: counts.posts, color: "text-pink-600 bg-pink-50" },
            { icon: Calendar, label: "Matchs à venir", value: counts.matchesUpcoming, color: "text-sky-600 bg-sky-50" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.03 }}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 font-display leading-none">{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Charts section */}
      {counts && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RoleDistribution counts={counts} />
          <MatchStatusChart counts={counts} />
        </div>
      )}

      {/* Recent activity grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
              <UserPlus size={18} className="text-blue-500" />
              Dernières inscriptions
            </h3>
            <a href="/admin/users" className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Voir tout <ChevronRight size={14} />
            </a>
          </div>
          <div className="space-y-0">
            {recentUsers.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Aucun utilisateur</p>
            ) : (
              recentUsers.map((u) => {
                const roleConf = ROLE_CONFIG[u.userType] ?? ROLE_CONFIG.player;
                return (
                  <div key={u.uid} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 font-bold text-gray-600 text-xs uppercase">
                      {u.firstName?.[0]}{u.lastName?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{u.locationCity || u.email}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${roleConf.bg} ${roleConf.color}`}>
                      {roleConf.label}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">{timeAgo(u.createdAt)}</span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Recent Matches */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 font-display flex items-center gap-2">
              <Activity size={18} className="text-amber-500" />
              Derniers matchs
            </h3>
            <a href="/admin/matches" className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors">
              Voir tout <ChevronRight size={14} />
            </a>
          </div>
          <div className="space-y-0">
            {recentMatches.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">Aucun match</p>
            ) : (
              recentMatches.map((m) => {
                const statusConf = STATUS_CONFIG[m.status] ?? STATUS_CONFIG.pending;
                return (
                  <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-orange-50">
                      <Trophy size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {m.homeTeamName} vs {m.awayTeamName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {m.date} • {m.time} • {m.venueName}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusConf.bg}`}>
                      {statusConf.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>

      {/* Platform health bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
              <Zap size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Plateforme opérationnelle</h3>
              <p className="text-xs text-gray-400">Tous les systèmes fonctionnent normalement</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">En ligne</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock size={14} />
              {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
