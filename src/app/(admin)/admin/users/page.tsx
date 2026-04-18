"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Search, Filter, ChevronDown, MoreVertical,
  UserCheck, UserX, Shield, Mail, Phone, MapPin, Calendar,
  Eye, Ban, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import { getAllUsers, toggleUserActive } from "@/lib/admin-firestore";
import type { UserProfile, UserRole } from "@/types";
import toast from "react-hot-toast";

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  player: { label: "Joueur", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
  manager: { label: "Manager", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-400" },
  referee: { label: "Arbitre", color: "text-purple-700", bg: "bg-purple-50", dot: "bg-purple-400" },
  venue_owner: { label: "Propriétaire", color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-400" },
  superadmin: { label: "Admin", color: "text-red-700", bg: "bg-red-50", dot: "bg-red-400" },
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const date = (dateStr as any)?.toDate ? (dateStr as any).toDate() : new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `il y a ${Math.floor(diff / 86400)}j`;
  return new Date(date).toLocaleDateString("fr-FR");
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    getAllUsers(500)
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.userType !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(s) ||
          (u.email?.toLowerCase().includes(s) ?? false) ||
          (u.locationCity?.toLowerCase().includes(s) ?? false)
        );
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => map.set(u.userType, (map.get(u.userType) ?? 0) + 1));
    return map;
  }, [users]);

  const handleToggleActive = async (uid: string, currentActive: boolean) => {
    setToggling(uid);
    try {
      await toggleUserActive(uid, !currentActive);
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, isActive: !currentActive } : u))
      );
      toast.success(currentActive ? "Utilisateur désactivé" : "Utilisateur réactivé");
    } catch (err) {
      toast.error("Erreur lors de la modification");
    } finally {
      setToggling(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-2xl font-extrabold text-gray-900 font-display"
        >
          Gestion des utilisateurs
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 }}
          className="text-sm text-gray-500 mt-0.5"
        >
          {users.length} utilisateurs au total sur la plateforme
        </motion.p>
      </div>

      {/* Role filter pills */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2"
      >
        {[
          { value: "all" as const, label: "Tous", count: users.length },
          { value: "player" as const, label: "Joueurs", count: roleCounts.get("player") ?? 0 },
          { value: "manager" as const, label: "Managers", count: roleCounts.get("manager") ?? 0 },
          { value: "referee" as const, label: "Arbitres", count: roleCounts.get("referee") ?? 0 },
          { value: "venue_owner" as const, label: "Propriétaires", count: roleCounts.get("venue_owner") ?? 0 },
        ].map((pill) => (
          <button
            key={pill.value}
            onClick={() => setRoleFilter(pill.value)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
              roleFilter === pill.value
                ? "bg-gray-900 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            {pill.label}
            <span
              className={`h-4 min-w-4 rounded-full px-1 text-[10px] leading-4 font-bold text-center ${
                roleFilter === pill.value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {pill.count}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Search + filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap gap-3"
      >
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">Tous statuts</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </select>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users size={40} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Utilisateur</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Rôle</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Ville</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Contact</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Statut</th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Inscrit</th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u, i) => {
                  const roleConf = ROLE_CONFIG[u.userType] ?? ROLE_CONFIG.player;
                  return (
                    <motion.tr
                      key={u.uid}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="group hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-xs font-bold text-gray-600 uppercase">
                            {u.firstName?.[0]}{u.lastName?.[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[180px]">{u.email || u.phone || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleConf.bg} ${roleConf.color}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${roleConf.dot}`} />
                          {roleConf.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-gray-600">{u.locationCity || "—"}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {u.email && <Mail size={14} className="text-gray-400" />}
                          {u.phone && <Phone size={14} className="text-gray-400" />}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                            <CheckCircle size={13} /> Actif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-500">
                            <XCircle size={13} /> Inactif
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-xs text-gray-500">{timeAgo(u.createdAt)}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => handleToggleActive(u.uid, u.isActive)}
                          disabled={toggling === u.uid}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            u.isActive
                              ? "bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          } disabled:opacity-50`}
                        >
                          {toggling === u.uid ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : u.isActive ? (
                            <>
                              <UserX size={13} /> Désactiver
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} /> Activer
                            </>
                          )}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Footer count */}
      {!loading && (
        <p className="text-xs text-gray-400 text-right">
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""}
        </p>
      )}

      {/* User detail modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-900">
                {selectedUser.firstName} {selectedUser.lastName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{selectedUser.email}</p>
              <button
                onClick={() => setSelectedUser(null)}
                className="mt-4 text-sm text-blue-600 hover:text-blue-700"
              >
                Fermer
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
