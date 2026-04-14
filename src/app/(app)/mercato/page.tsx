"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Filter, ChevronDown, X, UserPlus,
  Star, Bookmark, BookmarkCheck, Send, Clock, Check,
  Inbox, RefreshCw, ChevronRight, Loader2, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  searchPlayers, getTeamsByManager, getShortlistByManager,
  addToShortlist, removeFromShortlist,
  onJoinRequestsByManager, respondToJoinRequest, sendInvitation,
  onInvitationsByManager, cancelInvitation,
} from "@/lib/firestore";
import type { UserProfile, ShortlistEntry, JoinRequest, Invitation, Team } from "@/types";

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
  pending:  { label: "En attente", color: "bg-amber-100 text-amber-700" },
  accepted: { label: "Acceptée",   color: "bg-emerald-100 text-emerald-700" },
  declined: { label: "Déclinée",   color: "bg-red-100 text-red-700" },
};

type MainTab = "players" | "shortlist" | "applications" | "invitations";
type InvTab  = "pending" | "accepted" | "declined";
type AppTab  = "pending" | "accepted" | "rejected";

// ============================================
// Invite Modal
// ============================================

function InviteModal({ entry, teams, senderName, onClose, onSent }: {
  entry: ShortlistEntry;
  teams: Team[];
  senderName: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!teamId) return;
    setSending(true);
    try {
      const team = teams.find((t) => t.id === teamId);
      await sendInvitation({
        senderId: entry.managerId,
        senderName,
        receiverId: entry.playerId,
        receiverName: entry.playerName,
        receiverCity: entry.playerCity,
        receiverPosition: entry.playerPosition,
        receiverLevel: entry.playerLevel,
        teamId,
        teamName: team?.name ?? "",
        message,
      });
      onSent();
      onClose();
    } catch {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 font-display">Inviter {entry.playerName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Équipe</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="Un petit mot pour le joueur..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:border-primary-600 focus:outline-none" />
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button onClick={handleSend} disabled={sending || !teamId}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Envoi..." : "Envoyer l'invitation"}
          </button>
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function MercatoPage() {
  const { user } = useAuth();

  // ---- Players tab ----
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [nameQuery, setNameQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [positionFilter, setPositionFilter] = useState("Toutes");
  const [levelFilter, setLevelFilter] = useState("Tous");
  const [showFilters, setShowFilters] = useState(false);
  const [myMemberIds, setMyMemberIds] = useState<Set<string>>(new Set());
  const [shortlistedIds, setShortlistedIds] = useState<Map<string, string>>(new Map()); // playerId → shortlistId
  const [addingToShortlist, setAddingToShortlist] = useState<Set<string>>(new Set());

  // ---- Shortlist tab ----
  const [shortlist, setShortlist] = useState<ShortlistEntry[]>([]);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [inviteTarget, setInviteTarget] = useState<ShortlistEntry | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ---- Applications tab ----
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [appTab, setAppTab] = useState<AppTab>("pending");
  const [respondingApp, setRespondingApp] = useState<string | null>(null);

  // ---- Invitations tab ----
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loadingInvs, setLoadingInvs] = useState(true);
  const [invTab, setInvTab] = useState<InvTab>("pending");

  // ---- Navigation ----
  const [mainTab, setMainTab] = useState<MainTab>("players");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Load base data ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [teams, sl] = await Promise.all([
        getTeamsByManager(user.uid),
        getShortlistByManager(user.uid),
      ]);
      setMyTeams(teams);
      const ids = new Set(teams.flatMap((t) => t.memberIds));
      setMyMemberIds(ids);
      const slMap = new Map(sl.map((e) => [e.playerId, e.id]));
      setShortlistedIds(slMap);
      setShortlist(sl);
    })();
  }, [user]);

  // ---- Real-time: join requests ----
  useEffect(() => {
    if (!user) return;
    const unsub = onJoinRequestsByManager(user.uid, (data) => {
      setJoinRequests(data);
      setLoadingApps(false);
    });
    return unsub;
  }, [user]);

  // ---- Real-time: invitations ----
  useEffect(() => {
    if (!user) return;
    const unsub = onInvitationsByManager(user.uid, (data) => {
      setInvitations(data);
      setLoadingInvs(false);
    });
    return unsub;
  }, [user]);

  // ---- Fetch players (debounced) ----
  const fetchPlayers = useCallback(async () => {
    if (!user) return;
    setLoadingPlayers(true);
    try {
      const filters: { city?: string; position?: string; skillLevel?: string; query?: string } = {};
      if (cityFilter !== "Toutes") filters.city = cityFilter;
      if (positionFilter !== "Toutes") filters.position = positionFilter;
      if (levelFilter !== "Tous") filters.skillLevel = levelFilter;
      if (nameQuery) filters.query = nameQuery;
      const results = await searchPlayers(filters);
      setPlayers(results.filter((p) => p.uid !== user.uid && !myMemberIds.has(p.uid)));
    } catch {
      setPlayers([]);
    } finally {
      setLoadingPlayers(false);
    }
  }, [cityFilter, positionFilter, levelFilter, nameQuery, user, myMemberIds]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPlayers, nameQuery ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchPlayers, nameQuery]);

  // ---- Shortlist actions ----
  const handleAddToShortlist = async (player: UserProfile) => {
    if (!user) return;
    setAddingToShortlist((prev) => new Set([...prev, player.uid]));
    try {
      const pos = (player as unknown as { position?: string }).position ?? "";
      const lvl = (player as unknown as { skillLevel?: string }).skillLevel ?? "";
      const id = await addToShortlist({
        managerId: user.uid,
        playerId: player.uid,
        playerName: `${player.firstName} ${player.lastName}`,
        playerCity: player.locationCity,
        playerPosition: pos,
        playerLevel: lvl,
        playerBio: player.bio ?? "",
      });
      setShortlistedIds((prev) => new Map([...prev, [player.uid, id]]));
      const sl = await getShortlistByManager(user.uid);
      setShortlist(sl);
    } finally {
      setAddingToShortlist((prev) => { const n = new Set(prev); n.delete(player.uid); return n; });
    }
  };

  const handleRemoveFromShortlist = async (entry: ShortlistEntry) => {
    setRemovingId(entry.id);
    try {
      await removeFromShortlist(entry.id);
      setShortlistedIds((prev) => { const n = new Map(prev); n.delete(entry.playerId); return n; });
      setShortlist((prev) => prev.filter((e) => e.id !== entry.id));
    } finally {
      setRemovingId(null);
    }
  };

  // ---- Application actions ----
  const handleAcceptApp = async (req: JoinRequest) => {
    if (!user) return;
    setRespondingApp(req.id);
    try {
      await respondToJoinRequest(req.id, true);
      await sendInvitation({
        senderId: user.uid,
        senderName: `${user.firstName} ${user.lastName}`,
        receiverId: req.playerId,
        receiverName: req.playerName,
        receiverCity: req.playerCity,
        receiverPosition: req.playerPosition,
        receiverLevel: req.playerLevel,
        teamId: req.teamId,
        teamName: req.teamName,
        message: "Suite à votre candidature, nous vous invitons à rejoindre l'équipe.",
      });
    } finally {
      setRespondingApp(null);
    }
  };

  const handleRejectApp = async (req: JoinRequest) => {
    setRespondingApp(req.id);
    try {
      await respondToJoinRequest(req.id, false);
    } finally {
      setRespondingApp(null);
    }
  };

  if (!user) return null;

  const pendingApps = joinRequests.filter((r) => r.status === "pending").length;
  const pendingInvs = invitations.filter((i) => i.status === "pending").length;

  const appsByTab = joinRequests.filter((r) => r.status === appTab);
  const invsByTab = invitations.filter((i) => i.status === invTab);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-display">Mercato</h1>
          {(pendingApps + pendingInvs) > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-500 px-2 text-xs font-bold text-white">
              {pendingApps + pendingInvs}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">Recrute des joueurs et gère tes candidatures</p>
      </motion.div>

      {/* Main tabs */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
        className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {([
          { key: "players" as const,      label: "Joueurs",       icon: Search,      count: undefined },
          { key: "shortlist" as const,     label: "Sélection",     icon: Bookmark,    count: shortlist.length },
          { key: "applications" as const,  label: "Candidatures",  icon: Inbox,       count: pendingApps },
          { key: "invitations" as const,   label: "Invitations",   icon: Send,        count: pendingInvs },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 pr-5 text-sm font-medium transition-colors ${
              mainTab === tab.key ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}>
            <tab.icon size={15} /> {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                mainTab === tab.key ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ===================== TAB: PLAYERS ===================== */}
      {mainTab === "players" && (
        <div className="space-y-4">
          {/* Search + filters */}
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  showFilters ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}>
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
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Poste</label>
                  <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    {POSITIONS.map((p) => <option key={p} value={p}>{p === "Toutes" ? "Toutes" : POSITION_LABELS[p]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Niveau</label>
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
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

          {!loadingPlayers && (
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-900">{players.length}</span> joueur{players.length !== 1 ? "s" : ""} disponible{players.length !== 1 ? "s" : ""}
            </p>
          )}

          {loadingPlayers ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />)}
            </div>
          ) : players.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {players.map((player, i) => {
                const pos = (player as unknown as { position?: string }).position ?? "";
                const lvl = (player as unknown as { skillLevel?: string }).skillLevel ?? "";
                const initials = `${player.firstName[0] ?? ""}${player.lastName[0] ?? ""}`;
                const isShortlisted = shortlistedIds.has(player.uid);
                const isAdding = addingToShortlist.has(player.uid);

                return (
                  <motion.div key={player.uid} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.05 }} whileHover={{ y: -3 }}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md">
                    <div className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                          <span className="text-sm font-bold text-emerald-600">{initials}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-gray-900 font-display truncate">{player.firstName} {player.lastName}</h3>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin size={11} /> {player.locationCity || "—"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {pos && <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-700"}`}>{POSITION_LABELS[pos] ?? pos}</span>}
                        {lvl && <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${LEVEL_COLORS[lvl] ?? "bg-gray-100 text-gray-700"}`}>{LEVEL_LABELS[lvl] ?? lvl}</span>}
                      </div>
                      {player.bio && <p className="mt-3 text-xs text-gray-500 line-clamp-2">{player.bio}</p>}
                      <div className="mt-4 flex gap-2">
                        <Link href={`/profile/${player.uid}`}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                          Voir le profil <ChevronRight size={14} />
                        </Link>
                        <button onClick={() => !isShortlisted && handleAddToShortlist(player)}
                          disabled={isShortlisted || isAdding}
                          title={isShortlisted ? "Déjà dans la sélection" : "Ajouter à la sélection"}
                          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            isShortlisted
                              ? "bg-primary-50 text-primary-600 cursor-default"
                              : "bg-primary-600 text-white hover:bg-primary-700 hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
                          } disabled:opacity-60`}>
                          {isAdding ? <Loader2 size={15} className="animate-spin" /> : isShortlisted ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16">
              <Users size={32} className="text-gray-300" />
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucun joueur trouvé</h3>
              <p className="mt-1 text-sm text-gray-500">Essaie d&apos;élargir tes critères de recherche</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: SHORTLIST ===================== */}
      {mainTab === "shortlist" && (
        <div className="space-y-3">
          {shortlist.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {shortlist.map((entry, i) => (
                <motion.div key={entry.id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <span className="text-sm font-bold text-emerald-600">
                        {entry.playerName[0] ?? ""}{entry.playerName.split(" ")[1]?.[0] ?? ""}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{entry.playerName}</h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><MapPin size={11} /> {entry.playerCity}</span>
                        {entry.playerPosition && (
                          <span className={`rounded-md px-1.5 py-0.5 font-medium ${POSITION_COLORS[entry.playerPosition] ?? "bg-gray-100 text-gray-600"}`}>
                            {POSITION_LABELS[entry.playerPosition] ?? entry.playerPosition}
                          </span>
                        )}
                        {entry.playerLevel && (
                          <span className={`rounded-md px-1.5 py-0.5 font-medium ${LEVEL_COLORS[entry.playerLevel] ?? "bg-gray-100 text-gray-600"}`}>
                            {LEVEL_LABELS[entry.playerLevel] ?? entry.playerLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/profile/${entry.playerId}`}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                      Profil
                    </Link>
                    <button onClick={() => setInviteTarget(entry)}
                      className="rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700 transition-colors">
                      Inviter
                    </button>
                    <button onClick={() => handleRemoveFromShortlist(entry)}
                      disabled={removingId === entry.id}
                      className="flex items-center rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                      {removingId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16">
              <Bookmark size={32} className="text-gray-300" />
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Sélection vide</h3>
              <p className="mt-1 text-sm text-gray-500">Ajoute des joueurs depuis l&apos;onglet Joueurs</p>
              <button onClick={() => setMainTab("players")}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all">
                <Search size={14} /> Voir les joueurs
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: APPLICATIONS ===================== */}
      {mainTab === "applications" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex border-b border-gray-200">
            {(["pending", "accepted", "rejected"] as AppTab[]).map((t) => {
              const labels = { pending: "En attente", accepted: "Acceptées", rejected: "Refusées" };
              const count = joinRequests.filter((r) => r.status === t).length;
              return (
                <button key={t} onClick={() => setAppTab(t)}
                  className={`flex items-center gap-2 border-b-2 pb-3 pr-5 text-sm font-medium transition-colors ${
                    appTab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}>
                  {labels[t]}
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${
                    appTab === t ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {loadingApps ? (
            <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : (
            <AnimatePresence mode="popLayout">
              {appsByTab.map((req, i) => (
                <motion.div key={req.id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                        <UserPlus size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 font-display">{req.playerName}</h3>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><MapPin size={11} /> {req.playerCity}</span>
                          {req.playerPosition && (
                            <span className={`rounded-md px-1.5 py-0.5 font-medium ${POSITION_COLORS[req.playerPosition] ?? "bg-gray-100 text-gray-600"}`}>
                              {POSITION_LABELS[req.playerPosition] ?? req.playerPosition}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                      {req.teamName}
                    </span>
                  </div>
                  {req.message && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{req.message}&rdquo;</p>
                    </div>
                  )}
                  {req.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => handleAcceptApp(req)} disabled={respondingApp === req.id}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50">
                        {respondingApp === req.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        Accepter &amp; inviter
                      </button>
                      <button onClick={() => handleRejectApp(req)} disabled={respondingApp === req.id}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
                        <X size={15} /> Refuser
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loadingApps && appsByTab.length === 0 && (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16">
              <Inbox size={32} className="text-gray-300" />
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                {appTab === "pending" ? "Aucune candidature en attente" : appTab === "accepted" ? "Aucune candidature acceptée" : "Aucune candidature refusée"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">Les candidatures des joueurs apparaîtront ici</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: INVITATIONS ===================== */}
      {mainTab === "invitations" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex border-b border-gray-200">
            {(["pending", "accepted", "declined"] as InvTab[]).map((t) => {
              const count = invitations.filter((i) => i.status === t).length;
              return (
                <button key={t} onClick={() => setInvTab(t)}
                  className={`flex items-center gap-2 border-b-2 pb-3 pr-5 text-sm font-medium transition-colors ${
                    invTab === t ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
                  }`}>
                  {INV_STATUS_CONFIG[t].label}
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${
                    invTab === t ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {loadingInvs ? (
            <div className="space-y-3">{[1,2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : (
            <AnimatePresence mode="popLayout">
              {invsByTab.map((inv, i) => (
                <motion.div key={inv.id} layout
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -60, height: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100">
                        <UserPlus size={20} className="text-gray-500" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 font-display">{inv.receiverName}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <MapPin size={11} /> {inv.receiverCity}
                          {inv.receiverPosition && (
                            <span className={`rounded-md px-1.5 py-0.5 font-medium ${POSITION_COLORS[inv.receiverPosition] ?? "bg-gray-100 text-gray-600"}`}>
                              {POSITION_LABELS[inv.receiverPosition] ?? inv.receiverPosition}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${INV_STATUS_CONFIG[inv.status as keyof typeof INV_STATUS_CONFIG]?.color ?? "bg-gray-100 text-gray-600"}`}>
                      {INV_STATUS_CONFIG[inv.status as keyof typeof INV_STATUS_CONFIG]?.label ?? inv.status}
                    </span>
                  </div>
                  {inv.message && (
                    <div className="mt-3 rounded-lg bg-gray-50 p-3">
                      <p className="text-sm text-gray-600 leading-relaxed">&ldquo;{inv.message}&rdquo;</p>
                      <p className="mt-1.5 text-xs text-gray-400">Pour <span className="font-medium text-gray-600">{inv.teamName}</span></p>
                    </div>
                  )}
                  {inv.status === "pending" && (
                    <div className="mt-4 flex gap-2">
                      <button onClick={() => cancelInvitation(inv.id)}
                        className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                        <X size={14} /> Annuler
                      </button>
                    </div>
                  )}
                  {inv.status === "declined" && (
                    <div className="mt-4">
                      <button onClick={() => setMainTab("players")}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                        <Search size={14} /> Voir les joueurs <ChevronRight size={14} />
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {!loadingInvs && invsByTab.length === 0 && (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16">
              <Inbox size={32} className="text-gray-300" />
              <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
                {invTab === "pending" ? "Aucune invitation en attente" : invTab === "accepted" ? "Aucune invitation acceptée" : "Aucune invitation déclinée"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {invTab === "pending" ? "Invite des joueurs depuis ta sélection" : "Les réponses apparaîtront ici"}
              </p>
              {invTab === "pending" && (
                <button onClick={() => setMainTab("shortlist")}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all">
                  <Star size={14} /> Ma sélection
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Invite modal */}
      <AnimatePresence>
        {inviteTarget && (
          <InviteModal
            entry={inviteTarget}
            teams={myTeams}
            senderName={`${user.firstName} ${user.lastName}`}
            onClose={() => setInviteTarget(null)}
            onSent={async () => {
              const sl = await getShortlistByManager(user.uid);
              setShortlist(sl);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
