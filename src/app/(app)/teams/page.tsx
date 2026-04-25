"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Search, Plus, ChevronRight, Shield, MapPin,
  Star, Settings, X, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getTeamsByManager, getTeamsByPlayer, createTeam } from "@/lib/firestore";
import type { Team } from "@/types";

// ============================================
// Color helpers
// ============================================

const COLOR_MAP: Record<string, { bg: string; icon: string; stripe: string }> = {
  amber: { bg: "bg-amber-100", icon: "text-amber-600", stripe: "bg-amber-500" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600", stripe: "bg-blue-500" },
  red: { bg: "bg-red-100", icon: "text-red-600", stripe: "bg-red-500" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", stripe: "bg-emerald-500" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600", stripe: "bg-purple-500" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600", stripe: "bg-orange-500" },
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant",
  amateur: "Amateur",
  intermediate: "Intermédiaire",
  advanced: "Avancé",
};

const TEAM_COLORS = [
  { value: "emerald", label: "Vert", class: "bg-emerald-500" },
  { value: "blue", label: "Bleu", class: "bg-blue-500" },
  { value: "red", label: "Rouge", class: "bg-red-500" },
  { value: "amber", label: "Jaune", class: "bg-amber-500" },
  { value: "purple", label: "Violet", class: "bg-purple-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
];

// ============================================
// Create Team Modal
// ============================================

function CreateTeamModal({ onClose, onCreated, managerId }: {
  onClose: () => void;
  onCreated: () => void;
  managerId: string;
}) {
  const [form, setForm] = useState({
    name: "",
    city: "",
    description: "",
    level: "amateur",
    maxMembers: 14,
    color: "emerald",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) return;
    setSubmitting(true);
    try {
      await createTeam({
        name: form.name.trim(),
        managerId,
        city: form.city.trim(),
        description: form.description.trim(),
        level: form.level,
        maxMembers: form.maxMembers,
        color: form.color,
      });
      onCreated();
      onClose();
    } catch {
      setSubmitting(false);
    }
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
          <h2 className="text-lg font-bold text-gray-900 font-display">Créer une équipe</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nom de l&apos;équipe</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="FC Koppa"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>

          {/* City */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
            <input
              type="text"
              required
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="Paris"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Décris ton équipe..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 resize-none"
            />
          </div>

          {/* Level + Max members */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Niveau</label>
              <select
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
              >
                <option value="beginner">Débutant</option>
                <option value="amateur">Amateur</option>
                <option value="intermediate">Intermédiaire</option>
                <option value="advanced">Avancé</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Joueurs max</label>
              <input
                type="number"
                min={5}
                max={25}
                value={form.maxMembers}
                onChange={(e) => setForm({ ...form, maxMembers: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
              />
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Couleur</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`h-8 w-8 rounded-full ${c.class} transition-all ${
                    form.color === c.value
                      ? "ring-2 ring-offset-2 ring-primary-600 scale-110"
                      : "opacity-60 hover:opacity-100"
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !form.name.trim() || !form.city.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Création...</>
            ) : (
              <><Plus size={16} /> Créer l&apos;équipe</>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isManager = user?.userType === "manager";

  const fetchTeams = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = isManager
        ? await getTeamsByManager(user.uid)
        : await getTeamsByPlayer(user.uid);
      setTeams(data);
    } catch {
      // Silent fail - empty state will show
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
            <div className="mt-2 h-4 w-56 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white">
              <div className="h-1 animate-pulse bg-gray-200" />
              <div className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 animate-pulse rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-28 animate-pulse rounded bg-gray-200" />
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex flex-col items-center gap-1">
                      <div className="h-6 w-8 animate-pulse rounded bg-gray-200" />
                      <div className="h-3 w-12 animate-pulse rounded bg-gray-100" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-200" />
                  <div className="h-9 w-24 animate-pulse rounded-lg bg-gray-100" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 font-display">Mes équipes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {isManager
              ? `${teams.length} équipe${teams.length > 1 ? "s" : ""} gérée${teams.length > 1 ? "s" : ""}`
              : `${teams.length} équipe${teams.length > 1 ? "s" : ""} rejointe${teams.length > 1 ? "s" : ""}`}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {isManager ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
            >
              <Plus size={16} /> Créer une équipe
            </button>
          ) : (
            <Link
              href="/mercato"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
            >
              <Search size={16} /> Trouver une équipe
            </Link>
          )}
        </motion.div>
      </div>

      {/* Teams grid */}
      {teams.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team, i) => {
            const colors = COLOR_MAP[team.color] ?? COLOR_MAP.emerald;

            return (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                whileHover={{ y: -2 }}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
              >
                {/* Color stripe top */}
                <div className={`h-1 ${colors.stripe}`} />

                <div className="p-3.5 sm:p-5">
                  {/* Team header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg}`}>
                        <Shield size={24} className={colors.icon} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 font-display">{team.name}</h3>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <MapPin size={12} /> {team.city}
                        </div>
                      </div>
                    </div>
                    {isManager && (
                      <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                        <Shield size={12} /> Manager
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-2 sm:gap-3 rounded-lg bg-gray-50 p-2.5 sm:p-3">
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-bold text-gray-900 font-display">{team.memberIds.length}</p>
                      <p className="text-xs text-gray-500">Joueurs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-bold text-emerald-600 font-display">{team.wins}</p>
                      <p className="text-xs text-gray-500">Victoires</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base sm:text-lg font-bold text-red-500 font-display">{team.losses}</p>
                      <p className="text-xs text-gray-500">Défaites</p>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="mt-3 sm:mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Star size={12} /> {LEVEL_LABELS[team.level] ?? team.level}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {team.memberIds.length}/{team.maxMembers}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 sm:mt-4 flex gap-2">
                    <Link
                      href={`/teams/${team.id}`}
                      className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Voir l&apos;équipe <ChevronRight size={14} />
                    </Link>
                    {isManager && (
                      <Link
                        href={`/teams/${team.id}`}
                        className="flex items-center justify-center gap-1 rounded-lg border border-blue-200 px-3 py-2 text-xs sm:text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Settings size={14} /> Gérer
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
            <Users size={32} className="text-primary-400" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucune équipe</h3>
          <p className="mt-1 text-sm text-gray-500">
            {isManager ? "Crée ta première équipe pour commencer" : "Rejoins une équipe pour commencer à jouer"}
          </p>
          {isManager ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all"
            >
              <Plus size={16} /> Créer une équipe
            </button>
          ) : (
            <Link
              href="/mercato"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all"
            >
              <Plus size={16} /> Trouver une équipe
            </Link>
          )}
        </motion.div>
      )}

      {/* Create Team Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateTeamModal
            onClose={() => setShowCreateModal(false)}
            onCreated={fetchTeams}
            managerId={user.uid}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
