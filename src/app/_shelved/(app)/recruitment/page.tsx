"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Filter, ChevronDown, X, UserPlus,
  Star, Circle, Inbox, Clock, Check, RefreshCw,
  ChevronRight, Send,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  searchPlayers, sendInvitation, onInvitationsByManager,
  cancelInvitation, getTeamsByManager,
} from "@/lib/firestore";
import type { UserProfile, Invitation, Team } from "@/types";

// ============================================
// Constants
// ============================================

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Gardien", defender: "Défenseur", midfielder: "Milieu", forward: "Attaquant",
};
const POSITION_COLORS: Record<string, string> = {
  goalkeeper: "bg-orange-100 text-orange-700", defender: "bg-blue-100 text-blue-700",
  midfielder: "bg-emerald-100 text-emerald-700", forward: "bg-amber-100 text-amber-700",
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Avancé",
};
const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-green-100 text-green-700", amateur: "bg-blue-100 text-blue-700",
  intermediate: "bg-amber-100 text-amber-700", advanced: "bg-red-100 text-red-700",
};
const CITIES = ["Toutes", "Paris", "Lyon", "Marseille", "Toulouse"];
const POSITIONS = ["Toutes", "goalkeeper", "defender", "midfielder", "forward"];
const LEVELS = ["Tous", "beginner", "amateur", "intermediate", "advanced"];

const INV_STATUS_CONFIG = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  accepted: { label: "Acceptée", color: "bg-emerald-100 text-emerald-700", icon: Check },
  declined: { label: "Déclinée", color: "bg-red-100 text-red-700", icon: X },
};

type MainTab = "players" | "invitations";
type InvTab = "pending" | "accepted" | "declined";

// ============================================
// Component
// ============================================

export default function RecruitmentPage() {
  const { user } = useAuth();

  // Player search state
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [positionFilter, setPositionFilter] = useState("Toutes");
  const [levelFilter, setLevelFilter] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [invitedPlayers, setInvitedPlayers] = useState<Set<string>>(new Set());
  const [memberPlayers, setMemberPlayers] = useState<Set<string>>(new Set());

  // Invitation state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(true);
  const [resent, setResent] = useState<Set<string>>(new Set());

  // Teams (for invite target selection)
  const [myTeams, setMyTeams] = useState<Team[]>([]);

  // Tabs
  const [mainTab, setMainTab] = useState<MainTab>("players");
  const [invTab, setInvTab] = useState<InvTab>("pending");

  // Invite modal
  const [inviteTarget, setInviteTarget] = useState<UserProfile | null>(null);
  const [inviteTeamId, setInviteTeamId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch players
  const fetchPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    try {
      const filters: { city?: string; position?: string; skillLevel?: string; query?: string } = {};
      if (cityFilter !== "Toutes") filters.city = cityFilter;
      if (positionFilter !== "Toutes") filters.position = positionFilter;
      if (levelFilter !== "Tous") filters.skillLevel = levelFilter;
      if (query) filters.query = query;
      const results = await searchPlayers(filters);
      // Exclude self
      setPlayers(results.filter((p) => p.uid !== user?.uid));
    } catch {
      setPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  }, [cityFilter, positionFilter, levelFilter, query, user?.uid]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

  // Fetch teams and their members to exclude them from recruitment
  useEffect(() => {
    if (!user) return;
    getTeamsByManager(user.uid).then((teams) => {
      setMyTeams(teams);
      const members = new Set<string>();
      teams.forEach(t => t.memberIds.forEach(m => members.add(m)));
      setMemberPlayers(members);
    }).catch(() => {});
  }, [user]);

  // Real-time invitations
  useEffect(() => {
    if (!user) return;
    const unsub = onInvitationsByManager(user.uid, (data) => {
      setInvitations(data);
      // Track all receivers of pending invitations
      const pendingIds = new Set(data.filter(i => i.status === "pending").map(i => i.receiverId));
      setInvitedPlayers(pendingIds);
      setLoadingInvitations(false);
    });
    return unsub;
  }, [user]);

  const handleInviteOpen = (player: UserProfile) => {
    setInviteTarget(player);
    setInviteTeamId(myTeams[0]?.id ?? "");
    setInviteMessage("");
  };

  const handleInviteSend = async () => {
    if (!user || !inviteTarget || !inviteTeamId) return;
    setSending(true);
    try {
      const team = myTeams.find((t) => t.id === inviteTeamId);
      await sendInvitation({
        senderId: user.uid,
        senderName: `${user.firstName} ${user.lastName}`,
        receiverId: inviteTarget.uid,
        receiverName: `${inviteTarget.firstName} ${inviteTarget.lastName}`,
        receiverCity: inviteTarget.locationCity,
        receiverPosition: (inviteTarget as unknown as { position?: string }).position ?? "",
        receiverLevel: (inviteTarget as unknown as { skillLevel?: string }).skillLevel ?? "",
        teamId: inviteTeamId,
        teamName: team?.name ?? "",
        message: inviteMessage,
      });
      setInvitedPlayers((prev) => new Set([...prev, inviteTarget.uid]));
      setInviteTarget(null);
    } catch { /* toast error */ } finally {
      setSending(false);
    }
  };

  const handleCancel = async (id: string) => {
    try { await cancelInvitation(id); } catch { /* toast error */ }
  };

  const pendingCount = invitations.filter((i) => i.status === "pending").length;
  const invCounts = {
    pending: invitations.filter((i) => i.status === "pending").length,
    accepted: invitations.filter((i) => i.status === "accepted").length,
    declined: invitations.filter((i) => i.status === "declined").length,
  };
  const displayedInvitations = invitations.filter((i) => i.status === invTab);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <h1 className="text-2xl font-bold text-gray-900 font-display">Recrutement</h1>
        <p className="mt-1 text-sm text-gray-500">Trouve des joueurs et gère tes invitations</p>
      </motion.div>

      {/* Main tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex border-b border-gray-200"
      >
        <button
          onClick={() => setMainTab("players")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            mainTab === "players" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Search size={16} /> Joueurs disponibles
        </button>
        <button
          onClick={() => setMainTab("invitations")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            mainTab === "invitations" ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Send size={16} /> Invitations envoyées
          {pendingCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-500 px-1.5 text-xs font-bold text-white">
              {pendingCount}
            </span>
          )}
        </button>
      </motion.div>

      {/* ===================== TAB: PLAYERS ===================== */}
      {mainTab === "players" && (
        <>
          {/* Search + Filters */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 transition-shadow focus:shadow-[0_0_0_3px_rgba(5,150,105,0.1)]"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  showFilters ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Filter size={16} /> Filtres
                <ChevronDown size={14} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
              </button>
            </div>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
                  <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none">
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Poste</label>
                  <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none">
                    {POSITIONS.map((p) => <option key={p} value={p}>{p === "Toutes" ? "Toutes" : POSITION_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Niveau</label>
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-600 focus:outline-none">
                    {LEVELS.map((l) => <option key={l} value={l}>{l === "Tous" ? "Tous" : LEVEL_LABELS[l]}</option>)}
                  </select>
                </div>
                {(cityFilter !== "Toutes" || positionFilter !== "Toutes" || levelFilter !== "Tous") && (
                  <button onClick={() => { setCityFilter("Toutes"); setPositionFilter("Toutes"); setLevelFilter("Tous"); }}
                    className="mt-auto flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50">
                    <X size={14} /> Réinitialiser
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {/* Results count (filtering out already invited/members) */}
          {(() => {
            const filteredPlayers = players.filter(p => !invitedPlayers.has(p.uid) && !memberPlayers.has(p.uid));
            return (
              <>
                <p className="text-sm text-gray-500">
                  <span className="font-semibold text-gray-900">{filteredPlayers.length}</span> joueur{filteredPlayers.length > 1 ? "s" : ""} disponible{filteredPlayers.length > 1 ? "s" : ""}
                </p>

                {/* Player grid */}
                {loadingPlayers ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-56 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />
                    ))}
                  </div>
                ) : filteredPlayers.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredPlayers.map((player, i) => {
                      const pos = (player as unknown as { position?: string }).position ?? "";
                      const lvl = (player as unknown as { skillLevel?: string }).skillLevel ?? "";
                      const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`;

                      return (
                        <motion.div key={player.uid} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.06 }} whileHover={{ y: -3 }}
                          className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
                          <div className="p-5">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
                                <span className="text-sm font-bold text-emerald-600">{initials}</span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-900 font-display truncate">{player.firstName} {player.lastName}</h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <MapPin size={12} /> {player.locationCity || "—"}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {pos && <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-700"}`}>{POSITION_LABELS[pos] ?? pos}</span>}
                              {lvl && <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[lvl] ?? "bg-gray-100 text-gray-700"}`}>{LEVEL_LABELS[lvl] ?? lvl}</span>}
                            </div>
                            {player.bio && <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">{player.bio}</p>}
                            <button
                              onClick={() => handleInviteOpen(player)}
                              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-3 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-700 hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]">
                              <UserPlus size={16} /> Inviter
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16">
                    <Search size={32} className="text-gray-300" />
                    <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucun joueur correspondant</h3>
                    <p className="mt-1 text-sm text-gray-500">Tous les joueurs suggérés ont déjà été invités ou sont dans tes équipes.</p>
                  </motion.div>
                )}
              </>
            );
          })()}

          {/* Invite modal */}
          <AnimatePresence>
            {inviteTarget && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
                <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                  <h3 className="text-lg font-bold text-gray-900 font-display">
                    Inviter {inviteTarget.firstName} {inviteTarget.lastName}
                  </h3>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Équipe</label>
                      <select value={inviteTeamId} onChange={(e) => setInviteTeamId(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600">
                        {myTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">Message</label>
                      <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)}
                        rows={3} placeholder="Un petit mot pour le joueur..."
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 resize-none" />
                    </div>
                  </div>
                  <div className="mt-5 flex gap-3">
                    <button onClick={handleInviteSend} disabled={sending || !inviteTeamId}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50">
                      <Send size={16} /> {sending ? "Envoi..." : "Envoyer l'invitation"}
                    </button>
                    <button onClick={() => setInviteTarget(null)}
                      className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      Annuler
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ===================== TAB: INVITATIONS ===================== */}
      {mainTab === "invitations" && (
        <>
          {/* Sub-tabs */}
          <div className="flex border-b border-gray-200">
            {(["pending", "accepted", "declined"] as InvTab[]).map((t) => (
              <button key={t} onClick={() => setInvTab(t)}
                className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
                  invTab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
                }`}>
                {INV_STATUS_CONFIG[t].label}
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  invTab === t ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
                }`}>{invCounts[t]}</span>
              </button>
            ))}
          </div>

          {/* Invitation cards */}
          {loadingInvitations ? (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {displayedInvitations.map((inv, i) => {
                  const statusConf = INV_STATUS_CONFIG[inv.status];
                  const StatusIcon = statusConf.icon;
                  const posColor = POSITION_COLORS[inv.receiverPosition] ?? "bg-gray-100 text-gray-700";

                  return (
                    <motion.div key={inv.id} layout
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -60, height: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.06 }}
                      className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                              <UserPlus size={20} className="text-gray-500" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900 font-display">{inv.receiverName}</h3>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1"><MapPin size={12} /> {inv.receiverCity}</span>
                                {inv.receiverPosition && (
                                  <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${posColor}`}>
                                    {POSITION_LABELS[inv.receiverPosition] ?? inv.receiverPosition}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusConf.color}`}>
                            <StatusIcon size={12} /> {statusConf.label}
                          </span>
                        </div>
                        {inv.message && (
                          <div className="mt-3 rounded-lg bg-gray-50 p-3">
                            <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{inv.message}&rdquo;</p>
                            <p className="mt-2 text-xs text-gray-400">Pour <span className="font-medium text-gray-600">{inv.teamName}</span></p>
                          </div>
                        )}
                        {inv.status === "pending" && (
                          <div className="mt-4 flex gap-2">
                            {resent.has(inv.id) ? (
                              <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-50 py-2.5 text-sm font-medium text-primary-600">
                                <Check size={16} /> Relancée
                              </div>
                            ) : (
                              <button onClick={() => setResent((prev) => new Set([...prev, inv.id]))}
                                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                                <RefreshCw size={14} /> Relancer
                              </button>
                            )}
                            <button onClick={() => handleCancel(inv.id)}
                              className="flex items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                              <X size={14} /> Annuler
                            </button>
                          </div>
                        )}
                        {inv.status === "declined" && (
                          <div className="mt-4">
                            <button onClick={() => setMainTab("players")}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                              <UserPlus size={14} /> Chercher un autre joueur <ChevronRight size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {displayedInvitations.length === 0 && (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                    <Inbox size={32} className="text-gray-300" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                    {invTab === "pending" ? "Aucune invitation en attente" : invTab === "accepted" ? "Aucune invitation acceptée" : "Aucune invitation déclinée"}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {invTab === "pending" ? "Invite des joueurs depuis l'onglet Joueurs disponibles" : "Les réponses apparaîtront ici"}
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
