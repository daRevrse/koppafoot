"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, MapPin, Users, Star, ChevronLeft, Settings,
  Trash2, UserMinus, UserPlus, Edit3, X, Check,
  Loader2, Trophy, Calendar,
  ToggleLeft, ToggleRight, AlertTriangle, ClipboardList,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTeamById, updateTeam, deleteTeam, removeTeamMember,
  getUsersByIds, getMatchesByTeamIds,
  onJoinRequestsByTeam, respondToJoinRequest, sendInvitation,
} from "@/lib/firestore";
import type { Team, UserProfile, Match, JoinRequest } from "@/types";

// ============================================
// Constants
// ============================================

const COLOR_MAP: Record<string, { bg: string; icon: string; stripe: string; ring: string }> = {
  amber:   { bg: "bg-amber-100",   icon: "text-amber-600",   stripe: "bg-amber-500",   ring: "ring-amber-500" },
  blue:    { bg: "bg-blue-100",    icon: "text-blue-600",    stripe: "bg-blue-500",    ring: "ring-blue-500" },
  red:     { bg: "bg-red-100",     icon: "text-red-600",     stripe: "bg-red-500",     ring: "ring-red-500" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", stripe: "bg-emerald-500", ring: "ring-emerald-500" },
  purple:  { bg: "bg-purple-100",  icon: "text-purple-600",  stripe: "bg-purple-500",  ring: "ring-purple-500" },
  orange:  { bg: "bg-orange-100",  icon: "text-orange-600",  stripe: "bg-orange-500",  ring: "ring-orange-500" },
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: "Debutant", amateur: "Amateur", intermediate: "Intermediaire", advanced: "Avance",
};

const TEAM_COLORS = [
  { value: "emerald", label: "Vert", class: "bg-emerald-500" },
  { value: "blue", label: "Bleu", class: "bg-blue-500" },
  { value: "red", label: "Rouge", class: "bg-red-500" },
  { value: "amber", label: "Jaune", class: "bg-amber-500" },
  { value: "purple", label: "Violet", class: "bg-purple-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
];

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Gardien", defender: "Defenseur", midfielder: "Milieu", forward: "Attaquant",
};

const POSITION_COLORS: Record<string, string> = {
  goalkeeper: "bg-orange-100 text-orange-700", defender: "bg-blue-100 text-blue-700",
  midfielder: "bg-emerald-100 text-emerald-700", forward: "bg-amber-100 text-amber-700",
};

type ActiveTab = "roster" | "matches" | "settings" | "candidatures";

// ============================================
// Edit Team Modal
// ============================================

function EditTeamModal({ team, onClose, onSaved }: {
  team: Team;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: team.name,
    city: team.city,
    description: team.description,
    level: team.level,
    maxMembers: team.maxMembers,
    color: team.color,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) return;
    setSubmitting(true);
    try {
      await updateTeam(team.id, {
        name: form.name.trim(),
        city: form.city.trim(),
        description: form.description.trim(),
        level: form.level as Team["level"],
        max_members: form.maxMembers,
        color: form.color,
      });
      onSaved();
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
          <h2 className="text-lg font-bold text-gray-900 font-display">Modifier l&apos;equipe</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
            <input type="text" required value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Niveau</label>
              <select value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as Team["level"] })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                <option value="beginner">Debutant</option>
                <option value="amateur">Amateur</option>
                <option value="intermediate">Intermediaire</option>
                <option value="advanced">Avance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Joueurs max</label>
              <input type="number" min={5} max={25} value={form.maxMembers}
                onChange={(e) => setForm({ ...form, maxMembers: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Couleur</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button key={c.value} type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`h-8 w-8 rounded-full ${c.class} transition-all ${
                    form.color === c.value ? "ring-2 ring-offset-2 ring-primary-600 scale-110" : "opacity-60 hover:opacity-100"
                  }`} title={c.label} />
              ))}
            </div>
          </div>
          <button type="submit" disabled={submitting || !form.name.trim() || !form.city.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Sauvegarde...</> : <><Check size={16} /> Enregistrer</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Delete Confirmation Modal
// ============================================

function DeleteConfirmModal({ teamName, onClose, onConfirm, deleting }: {
  teamName: string;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-center gap-3 text-red-600">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle size={20} />
          </div>
          <h3 className="text-lg font-bold font-display">Supprimer l&apos;equipe</h3>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Es-tu sur de vouloir supprimer <span className="font-semibold">{teamName}</span> ? Cette action est irreversible.
        </p>
        <div className="mt-5 flex gap-3">
          <button onClick={onConfirm} disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-all disabled:opacity-50">
            {deleting ? <><Loader2 size={16} className="animate-spin" /> Suppression...</> : <><Trash2 size={16} /> Supprimer</>}
          </button>
          <button onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const teamId = params.id;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("roster");

  // Join requests (real-time)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);

  const isTeamManager = team?.managerId === user?.uid;
  const isTeamMember = team?.memberIds.includes(user?.uid ?? "") ?? false;

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const data = await getTeamById(teamId);
      setTeam(data);
      if (data) {
        // Fetch members
        const memberProfiles = await getUsersByIds(data.memberIds);
        setMembers(memberProfiles);
        // Fetch matches
        const teamMatches = await getMatchesByTeamIds([data.id]);
        setMatches(teamMatches);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Real-time join requests listener (manager only)
  useEffect(() => {
    if (!teamId || !isTeamManager) return;
    const unsub = onJoinRequestsByTeam(teamId, (requests) => {
      // Sort: pending first, then rest
      const sorted = [...requests].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });
      setJoinRequests(sorted);
    });
    return unsub;
  }, [teamId, isTeamManager]);

  const handleDeleteTeam = async () => {
    if (!team) return;
    setDeleting(true);
    try {
      await deleteTeam(team.id);
      router.push("/teams");
    } catch {
      setDeleting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!team) return;
    setRemovingMember(memberId);
    try {
      await removeTeamMember(team.id, memberId);
      await fetchTeam();
    } catch {
      // Silent
    } finally {
      setRemovingMember(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!team || !user) return;
    setLeavingTeam(true);
    try {
      await removeTeamMember(team.id, user.uid);
      router.push("/teams");
    } catch {
      setLeavingTeam(false);
    }
  };

  const handleToggleRecruiting = async () => {
    if (!team) return;
    try {
      await updateTeam(team.id, { is_recruiting: !team.isRecruiting });
      await fetchTeam();
    } catch {
      // Silent
    }
  };

  const handleAccept = async (request: JoinRequest) => {
    if (!team || !user) return;
    setRespondingId(request.id);
    try {
      await respondToJoinRequest(request.id, true);
      await sendInvitation({
        senderId: user.uid,
        senderName: `${user.firstName} ${user.lastName}`,
        receiverId: request.playerId,
        receiverName: request.playerName,
        receiverCity: request.playerCity,
        receiverPosition: request.playerPosition,
        receiverLevel: request.playerLevel,
        teamId: team.id,
        teamName: team.name,
        message: `Votre candidature pour ${team.name} a été acceptée. Rejoignez-nous !`,
      });
    } catch {
      // Silent
    } finally {
      setRespondingId(null);
    }
  };

  const handleRefuse = async (requestId: string) => {
    setRespondingId(requestId);
    try {
      await respondToJoinRequest(requestId, false);
    } catch {
      // Silent
    } finally {
      setRespondingId(null);
    }
  };

  if (!user) return null;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="h-2 animate-pulse bg-gray-200" />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 animate-pulse rounded-2xl bg-gray-200" />
              <div className="space-y-2">
                <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not found
  if (!team) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Shield size={48} className="text-gray-300" />
        <h2 className="mt-4 text-xl font-bold text-gray-900 font-display">Equipe introuvable</h2>
        <p className="mt-2 text-sm text-gray-500">Cette equipe n&apos;existe pas ou a ete supprimee</p>
        <Link href="/teams"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all">
          <ChevronLeft size={16} /> Retour aux equipes
        </Link>
      </div>
    );
  }

  const colors = COLOR_MAP[team.color] ?? COLOR_MAP.emerald;
  const winRate = team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0;
  const upcomingMatches = matches.filter((m) => m.status === "upcoming");
  const completedMatches = matches.filter((m) => m.status === "completed");
  const pendingCount = joinRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Back button */}
      <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
        <Link href="/teams" className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
          <ChevronLeft size={16} /> Mes equipes
        </Link>
      </motion.div>

      {/* Team header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
        <div className={`h-2 ${colors.stripe}`} />
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${colors.bg}`}>
                <Shield size={32} className={colors.icon} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-display">{team.name}</h1>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1"><MapPin size={14} /> {team.city}</span>
                  <span className="flex items-center gap-1"><Star size={14} /> {LEVEL_LABELS[team.level] ?? team.level}</span>
                  {team.isRecruiting && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Recrute</span>
                  )}
                </div>
              </div>
            </div>

            {/* Manager actions */}
            {isTeamManager && (
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEditModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                  <Edit3 size={14} /> Modifier
                </button>
                <button onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            {/* Player leave */}
            {!isTeamManager && isTeamMember && (
              <button onClick={handleLeaveTeam} disabled={leavingTeam}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                {leavingTeam ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                Quitter
              </button>
            )}
          </div>

          {/* Description */}
          {team.description && (
            <p className="mt-4 text-sm text-gray-600 leading-relaxed">{team.description}</p>
          )}

          {/* Stats grid */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 font-display">{team.memberIds.length}</p>
              <p className="text-xs text-gray-500">Joueurs</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 font-display">{team.wins}</p>
              <p className="text-xs text-gray-500">Victoires</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-500 font-display">{team.losses}</p>
              <p className="text-xs text-gray-500">Defaites</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-600 font-display">{winRate}%</p>
              <p className="text-xs text-gray-500">Taux victoire</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex border-b border-gray-200"
      >
        {([
          { key: "roster" as const, label: "Effectif", icon: Users, count: members.length },
          { key: "matches" as const, label: "Matchs", icon: Calendar, count: matches.length },
          ...(isTeamManager ? [
            { key: "candidatures" as const, label: "Candidatures", icon: ClipboardList, count: pendingCount, badge: true },
            { key: "settings" as const, label: "Parametres", icon: Settings, count: undefined as number | undefined, badge: false },
          ] : []),
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as ActiveTab)}
            className={`relative flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
              activeTab === tab.key ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            <tab.icon size={16} />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                "badge" in tab && tab.badge
                  ? "bg-red-100 text-red-600"
                  : activeTab === tab.key
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-500"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ===================== TAB: ROSTER ===================== */}
      {activeTab === "roster" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {members.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {members.map((member, i) => {
                const isManagerMember = member.uid === team.managerId;
                const pos = (member as unknown as { position?: string }).position ?? "";
                const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`;

                return (
                  <motion.div key={member.uid} layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -60, height: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                        <span className="text-sm font-bold text-emerald-600">{initials}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
                          {isManagerMember && (
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Manager</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin size={11} /> {member.locationCity}
                          {pos && (
                            <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-600"}`}>
                              {POSITION_LABELS[pos] ?? pos}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remove button (manager only, can't remove self) */}
                    {isTeamManager && !isManagerMember && (
                      <button
                        onClick={() => handleRemoveMember(member.uid)}
                        disabled={removingMember === member.uid}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {removingMember === member.uid ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <UserMinus size={12} />
                        )}
                        Retirer
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
              <Users size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun membre dans l&apos;equipe</p>
            </div>
          )}

          {/* Invite CTA for manager */}
          {isTeamManager && (
            <Link href="/recruitment"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
              <UserPlus size={16} /> Recruter des joueurs
            </Link>
          )}
        </motion.div>
      )}

      {/* ===================== TAB: MATCHES ===================== */}
      {activeTab === "matches" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Upcoming matches */}
          {upcomingMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">A venir</h3>
              {upcomingMatches.map((match, i) => (
                <motion.div key={match.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 font-display">
                        {match.homeTeamName} vs {match.awayTeamName}
                      </h4>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {match.date} a {match.time}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {match.venueName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{match.format}</span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        {match.playersConfirmed}/{match.playersTotal}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Completed matches */}
          {completedMatches.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Termines</h3>
              {completedMatches.map((match, i) => (
                <motion.div key={match.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 font-display">
                        {match.homeTeamName} {match.scoreHome ?? "?"} - {match.scoreAway ?? "?"} {match.awayTeamName}
                      </h4>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span>{match.date}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {match.venueName}</span>
                      </div>
                    </div>
                    {match.result && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        match.result === "win" ? "bg-emerald-100 text-emerald-700" :
                        match.result === "loss" ? "bg-red-100 text-red-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {match.result === "win" ? "Victoire" : match.result === "loss" ? "Defaite" : "Nul"}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {matches.length === 0 && (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
              <Trophy size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun match programme</p>
              {isTeamManager && (
                <Link href="/matches"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-all">
                  <Calendar size={14} /> Programmer un match
                </Link>
              )}
            </div>
          )}

          {/* CTA for manager */}
          {isTeamManager && matches.length > 0 && (
            <Link href="/matches"
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
              <Calendar size={16} /> Programmer un match
            </Link>
          )}
        </motion.div>
      )}

      {/* ===================== TAB: CANDIDATURES (Manager only) ===================== */}
      {activeTab === "candidatures" && isTeamManager && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-3"
        >
          {joinRequests.length > 0 ? (
            joinRequests.map((request, i) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{request.playerName}</span>
                      <span className="text-gray-400">—</span>
                      <span className="text-sm text-gray-600">{request.playerCity}</span>
                      {request.playerPosition && (
                        <>
                          <span className="text-gray-400">—</span>
                          <span className="text-sm text-gray-600">{request.playerPosition}</span>
                        </>
                      )}
                      {request.playerLevel && (
                        <>
                          <span className="text-gray-400">—</span>
                          <span className="text-sm text-gray-600">{LEVEL_LABELS[request.playerLevel] ?? request.playerLevel}</span>
                        </>
                      )}
                    </div>
                    {request.message && (
                      <p className="mt-2 text-sm text-gray-500 italic">
                        &ldquo;{request.message}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Status badge or action buttons */}
                  {request.status === "pending" ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleAccept(request)}
                        disabled={respondingId === request.id}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        {respondingId === request.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        Accepter
                      </button>
                      <button
                        onClick={() => handleRefuse(request.id)}
                        disabled={respondingId === request.id}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {respondingId === request.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <X size={12} />
                        )}
                        Refuser
                      </button>
                    </div>
                  ) : (
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      request.status === "accepted"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                      {request.status === "accepted" ? "Acceptée" : "Refusée"}
                    </span>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
              <ClipboardList size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucune candidature pour le moment</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ===================== TAB: SETTINGS (Manager only) ===================== */}
      {activeTab === "settings" && isTeamManager && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Recruiting toggle */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Statut de recrutement</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {team.isRecruiting ? "L'equipe apparait dans les resultats de recherche" : "L'equipe n'est pas visible pour les joueurs"}
                </p>
              </div>
              <button onClick={handleToggleRecruiting}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  team.isRecruiting
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {team.isRecruiting ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {team.isRecruiting ? "Actif" : "Inactif"}
              </button>
            </div>
          </div>

          {/* Team info summary */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="font-semibold text-gray-900">Informations</h3>
            <dl className="mt-3 space-y-3">
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Capacite</dt>
                <dd className="font-medium text-gray-900">{team.memberIds.length} / {team.maxMembers} joueurs</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Matchs joues</dt>
                <dd className="font-medium text-gray-900">{team.matchesPlayed}</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Bilan</dt>
                <dd className="font-medium text-gray-900">{team.wins}V / {team.draws}N / {team.losses}D</dd>
              </div>
              <div className="flex justify-between text-sm">
                <dt className="text-gray-500">Taux de victoire</dt>
                <dd className="font-medium text-gray-900">{winRate}%</dd>
              </div>
            </dl>
          </div>

          {/* Danger zone */}
          <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
            <h3 className="font-semibold text-red-700">Zone dangereuse</h3>
            <p className="mt-1 text-sm text-red-600/80">
              Supprimer l&apos;equipe supprimera toutes les donnees associees de maniere irreversible.
            </p>
            <button onClick={() => setShowDeleteModal(true)}
              className="mt-4 flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-all">
              <Trash2 size={14} /> Supprimer l&apos;equipe
            </button>
          </div>
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showEditModal && (
          <EditTeamModal team={team} onClose={() => setShowEditModal(false)} onSaved={fetchTeam} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteConfirmModal
            teamName={team.name}
            onClose={() => setShowDeleteModal(false)}
            onConfirm={handleDeleteTeam}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
