"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Filter, ChevronDown, X, UserPlus,
  Star, Bookmark, BookmarkCheck, Send, Clock, Check,
  Inbox, RefreshCw, ChevronRight, Loader2, Users, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  // Manager actions
  searchPlayers, getTeamsByManager, getShortlistByManager,
  addToShortlist, removeFromShortlist,
  onJoinRequestsByManager, respondToJoinRequest, sendInvitation,
  onInvitationsByManager, cancelInvitation,
  // Player actions
  searchTeams, createJoinRequest, getJoinRequestsByPlayer,
  onInvitationsForPlayer, respondToInvitation
} from "@/lib/firestore";
import type { UserProfile, ShortlistEntry, JoinRequest, Invitation, Team } from "@/types";

// ============================================
// Constants & Helpers
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

const COLOR_MAP: Record<string, { bg: string; icon: string; stripe: string }> = {
  amber: { bg: "bg-amber-100", icon: "text-amber-600", stripe: "bg-amber-500" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600", stripe: "bg-blue-500" },
  red: { bg: "bg-red-100", icon: "text-red-600", stripe: "bg-red-500" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600", stripe: "bg-emerald-500" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600", stripe: "bg-purple-500" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600", stripe: "bg-orange-500" },
};

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

// ============================================
// Modals
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
      await removeFromShortlist(entry.id);
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

function CandidatureModal({ team, onClose, onSubmit, submitting }: {
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">Candidater à {team.name}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Votre message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={5}
              placeholder="Présentez-vous..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 resize-none transition-shadow" />
            <p className="mt-1 text-right text-xs text-gray-400">{message.length}/500</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all disabled:opacity-50">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {submitting ? "Envoi..." : "Envoyer"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Main Page
// ============================================

export default function MercatoPage() {
  const { user } = useAuth();
  const isManager = user?.userType === "manager";
  const isPlayer  = user?.userType === "player";

  // ---- Tabs ----
  const [mainTab, setMainTab] = useState<string>(isManager ? "players" : "teams");

  // ---- Common state ----
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [levelFilter, setLevelFilter] = useState("Tous");
  const [nameQuery, setNameQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Manager specific state ----
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [shortlist, setShortlist] = useState<ShortlistEntry[]>([]);
  const [shortlistedIds, setShortlistedIds] = useState<Map<string, string>>(new Map());
  const [addingToShortlist, setAddingToShortlist] = useState<Set<string>>(new Set());
  const [respondingApp, setRespondingApp] = useState<string | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ShortlistEntry | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [myMemberIds, setMyMemberIds] = useState<Set<string>>(new Set());

  // ---- Player specific state ----
  const [teams, setTeams] = useState<Team[]>([]);
  const [candidatureTeam, setCandidatureTeam] = useState<Team | null>(null);
  const [submittingApp, setSubmittingApp] = useState(false);
  const [sentRequestIds, setSentRequestIds] = useState<Set<string>>(new Set());
  const [respondingInv, setRespondingInv] = useState<Record<string, "accepted" | "declined">>({});

  // ---- Real-time state (Invitations & JoinRequests) ----
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [appSubTab, setAppSubTab] = useState<string>("pending");
  const [invSubTab, setInvSubTab] = useState<string>("pending");

  // ---- Initialization ----
  useEffect(() => {
    if (!user) return;

    if (isManager) {
      (async () => {
        const [teams, sl] = await Promise.all([
          getTeamsByManager(user.uid),
          getShortlistByManager(user.uid),
        ]);
        setMyTeams(teams);
        setMyMemberIds(new Set(teams.flatMap((t) => t.memberIds)));
        setShortlist(sl);
        setShortlistedIds(new Map(sl.map((e) => [e.playerId, e.id])));
      })();

      const unsubApps = onJoinRequestsByManager(user.uid, setJoinRequests);
      const unsubInvs = onInvitationsByManager(user.uid, setInvitations);
      return () => { unsubApps(); unsubInvs(); };
    }

    if (isPlayer) {
      const unsubInvs = onInvitationsForPlayer(user.uid, setInvitations);
      // For player, join requests they SENT
      getJoinRequestsByPlayer(user.uid).then(reqs => {
        setJoinRequests(reqs);
        setSentRequestIds(new Set(reqs.filter(r => r.status === "pending").map(r => r.teamId)));
      });
      return () => { unsubInvs(); };
    }
  }, [user, isManager, isPlayer]);

  // ---- Search functionality ----
  const performSearch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isManager) {
        const filters: any = {};
        if (cityFilter !== "Toutes") filters.city = cityFilter;
        if (levelFilter !== "Tous") filters.skillLevel = levelFilter;
        if (nameQuery) filters.query = nameQuery;
        const results = await searchPlayers(filters);
        setPlayers(results.filter((p) => p.uid !== user.uid && !myMemberIds.has(p.uid)));
      } else if (isPlayer) {
        const filters: any = {};
        if (cityFilter !== "Toutes") filters.city = cityFilter;
        if (levelFilter !== "Tous") filters.level = levelFilter;
        if (nameQuery) filters.query = nameQuery;
        const results = await searchTeams(filters);
        setTeams(results);
      }
    } finally {
      setLoading(false);
    }
  }, [user, isManager, isPlayer, cityFilter, levelFilter, nameQuery, myMemberIds]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(performSearch, nameQuery ? 300 : 0);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [performSearch, nameQuery]);

  // ---- Actions: Manager ----
  const handleAddToShortlist = async (player: UserProfile) => {
    if (!user) return;
    setAddingToShortlist((prev) => new Set([...prev, player.uid]));
    try {
      const id = await addToShortlist({
        managerId: user.uid, playerId: player.uid,
        playerName: `${player.firstName} ${player.lastName}`,
        playerCity: player.locationCity, playerPosition: player.position ?? "",
        playerLevel: player.skillLevel ?? "", playerBio: player.bio ?? "",
      });
      setShortlistedIds((prev) => new Map([...prev, [player.uid, id]]));
      setShortlist(await getShortlistByManager(user.uid));
    } finally {
      setAddingToShortlist((prev) => { const n = new Set(prev); n.delete(player.uid); return n; });
    }
  };

  const handleRespondToApp = async (req: JoinRequest, accepted: boolean) => {
    if (!user) return;
    setRespondingApp(req.id);
    try {
      await respondToJoinRequest(req.id, accepted, req.teamId, req.playerId);
      if (accepted) {
        await sendInvitation({
          senderId: user.uid, senderName: `${user.firstName} ${user.lastName}`,
          receiverId: req.playerId, receiverName: req.playerName,
          receiverCity: req.playerCity, receiverPosition: req.playerPosition,
          receiverLevel: req.playerLevel, teamId: req.teamId, teamName: req.teamName,
          message: "Suite à votre candidature, nous vous invitons à rejoindre l'équipe.",
        });
      }
    } finally {
      setRespondingApp(null);
    }
  };

  // ---- Actions: Player ----
  const handlePlayerApply = async (message: string) => {
    if (!user || !candidatureTeam) return;
    setSubmittingApp(true);
    try {
      await createJoinRequest({
        playerId: user.uid, playerName: `${user.firstName} ${user.lastName}`,
        playerCity: user.locationCity, playerPosition: user.position ?? "",
        playerLevel: user.skillLevel ?? "", teamId: candidatureTeam.id,
        teamName: candidatureTeam.name, managerId: candidatureTeam.managerId, message,
      });
      setSentRequestIds(prev => new Set([...prev, candidatureTeam.id]));
      setJoinRequests(await getJoinRequestsByPlayer(user.uid));
      setCandidatureTeam(null);
    } finally {
      setSubmittingApp(false);
    }
  };

  const handlePlayerRespondInv = async (inv: Invitation, accepted: boolean) => {
    if (!user) return;
    setRespondingInv(prev => ({ ...prev, [inv.id]: accepted ? "accepted" : "declined" }));
    try {
      await respondToInvitation(inv.id, accepted, inv.teamId, user.uid);
    } catch {
      setRespondingInv(prev => { const n = { ...prev }; delete n[inv.id]; return n; });
    }
  };

  const handleRemoveFromShortlist = async (entry: ShortlistEntry) => {
    if (!user) return;
    setRemovingId(entry.id);
    try {
      await removeFromShortlist(entry.id);
      setShortlistedIds((prev) => {
        const n = new Map(prev);
        n.delete(entry.playerId);
        return n;
      });
      setShortlist(await getShortlistByManager(user.uid));
    } finally {
      setRemovingId(null);
    }
  };

  if (!user) return null;

  const pendingAppsCount = joinRequests.filter(r => r.status === "pending").length;
  const pendingInvsCount = invitations.filter(i => i.status === "pending").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 font-display">Mercato</h1>
          {isManager && (pendingAppsCount + pendingInvsCount) > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-500 px-2 text-xs font-bold text-white">
              {pendingAppsCount + pendingInvsCount}
            </span>
          )}
          {isPlayer && (pendingInvsCount) > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-500 px-2 text-xs font-bold text-white">
              {pendingInvsCount}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          {isManager ? "Recrute des joueurs et gère tes candidatures" : "Trouve une équipe et gère tes invitations"}
        </p>
      </motion.div>

      {/* Main tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {(isManager ? [
          { key: "players",      label: "Joueurs",       icon: Search,      count: undefined },
          { key: "shortlist",    label: "Sélection",     icon: Bookmark,    count: shortlist.length },
          { key: "applications", label: "Candidatures",  icon: Inbox,       count: pendingAppsCount },
          { key: "invitations",  label: "Invitations",   icon: Send,        count: pendingInvsCount },
        ] : [
          { key: "teams",        label: "Équipes",       icon: Shield,      count: undefined },
          { key: "applications", label: "Candidatures",  icon: Inbox,       count: pendingAppsCount },
          { key: "invitations",  label: "Invitations",   icon: Send,        count: pendingInvsCount },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 text-xs sm:text-sm sm:gap-2 sm:pr-5 sm:px-0 font-medium whitespace-nowrap transition-colors ${
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
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* ---- TAB: PLAYERS (Manager only) ---- */}
        {isManager && mainTab === "players" && (
          <motion.div key="players" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
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
              </button>
            </div>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
                  <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Niveau</label>
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    {LEVELS.map(l => <option key={l} value={l}>{l === "Tous" ? "Tous" : LEVEL_LABELS[l]}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />)}
              </div>
            ) : players.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {players.map(p => (
                  <div key={p.uid} className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold truncate">{p.firstName} {p.lastName}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10}/> {p.locationCity}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${POSITION_COLORS[p.position ?? ""] || "bg-gray-100 text-gray-600"}`}>
                        {POSITION_LABELS[p.position ?? ""] || p.position}
                      </span>
                    </div>
                    <div className="mt-4 flex gap-2">
                       <Link href={`/profile/${p.uid}`} className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Profil</Link>
                       <button onClick={() => !shortlistedIds.has(p.uid) && handleAddToShortlist(p)}
                        className={`px-3 py-2 rounded-lg transition-colors ${shortlistedIds.has(p.uid) ? "bg-primary-50 text-primary-600" : "bg-primary-600 text-white hover:bg-primary-700"}`}>
                        {addingToShortlist.has(p.uid) ? <Loader2 size={16} className="animate-spin" /> : shortlistedIds.has(p.uid) ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                       </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl">
                <Users size={32} className="mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">Aucun joueur compatible trouvé</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ---- TAB: TEAMS (Player only) ---- */}
        {isPlayer && mainTab === "teams" && (
          <motion.div key="teams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
             <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Rechercher une équipe..."
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                  showFilters ? "border-primary-300 bg-primary-50 text-primary-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}>
                <Filter size={16} /> Filtres
              </button>
            </div>
            {showFilters && (
               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Ville</label>
                  <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">Niveau</label>
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
                    {LEVELS.map(l => <option key={l} value={l}>{l === "Tous" ? "Tous" : LEVEL_LABELS[l]}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-gray-100" />)}
              </div>
            ) : teams.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map(t => {
                   const hasSent = sentRequestIds.has(t.id);
                   const colors = COLOR_MAP[t.color] || COLOR_MAP.emerald;
                   return (
                    <div key={t.id} className="rounded-xl border border-gray-200 bg-white p-5 flex flex-col">
                      <div className="flex items-start justify-between">
                         <div className={`h-11 w-11 rounded-xl ${colors.bg} flex items-center justify-center`}>
                           <Shield size={24} className={colors.icon} />
                         </div>
                         <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${LEVEL_COLORS[t.level] || ""}`}>{LEVEL_LABELS[t.level] || t.level}</span>
                      </div>
                      <h4 className="mt-3 font-bold text-gray-900">{t.name}</h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin size={10}/> {t.city}</p>
                      <p className="mt-2 text-xs text-gray-600 line-clamp-2 italic">&ldquo;{t.description}&rdquo;</p>
                      <div className="mt-auto pt-4 flex gap-2">
                         <Link href={`/teams/${t.id}`} className="flex-1 text-center py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">Détails</Link>
                         <button onClick={() => !hasSent && setCandidatureTeam(t)} disabled={hasSent}
                          className={`flex-[2] py-2 rounded-lg text-sm font-medium transition-all ${hasSent ? "bg-gray-50 text-gray-400" : "bg-primary-600 text-white hover:bg-primary-700"}`}>
                          {hasSent ? "Postulé" : "Candidater"}
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-2xl">
                <Shield size={32} className="mx-auto text-gray-300" />
                <p className="mt-2 text-gray-500">Aucune équipe ne correspond à tes filtres</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ---- TAB: SHORTLIST (Manager only) ---- */}
        {isManager && mainTab === "shortlist" && (
           <motion.div key="shortlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
             {shortlist.length > 0 ? shortlist.map(e => (
               <div key={e.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                       {e.playerName[0]}
                     </div>
                     <div>
                        <h4 className="font-bold text-sm text-gray-900">{e.playerName}</h4>
                        <p className="text-[10px] text-gray-500">{e.playerCity} • {POSITION_LABELS[e.playerPosition] || e.playerPosition}</p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setInviteTarget(e)} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold">Inviter</button>
                     <button onClick={() => handleRemoveFromShortlist(e)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                       {removingId === e.id ? <Loader2 size={16} className="animate-spin"/> : <X size={16}/>}
                     </button>
                  </div>
               </div>
             )) : (
               <div className="py-12 text-center border-2 border-dashed rounded-xl">
                 <Bookmark size={32} className="mx-auto text-gray-200" />
                 <p className="mt-2 text-gray-400">Ta sélection est vide</p>
               </div>
             )}
           </motion.div>
        )}

        {/* ---- TAB: APPLICATIONS (Merged) ---- */}
        {mainTab === "applications" && (
          <motion.div key="applications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
             {/* Subtabs for status */}
             <div className="flex gap-4 border-b border-gray-100">
                {["pending", "accepted", "rejected"].map(s => (
                  <button key={s} onClick={() => setAppSubTab(s)} className={`pb-2 text-sm font-medium transition-all border-b-2 ${appSubTab === s ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400"}`}>
                    {s === "pending" ? "En attente" : s === "accepted" ? "Acceptées" : "Refusées"}
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded-full text-[10px]">{joinRequests.filter(r => r.status === s).length}</span>
                  </button>
                ))}
             </div>

             <div className="space-y-3">
               {joinRequests.filter(r => r.status === appSubTab).map(req => (
                  <div key={req.id} className="p-4 border border-gray-200 rounded-xl bg-white">
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                            {isManager ? <UserPlus size={20}/> : <Shield size={20}/>}
                          </div>
                          <div>
                             <h4 className="font-bold text-gray-900">{isManager ? req.playerName : req.teamName}</h4>
                             <p className="text-[10px] text-gray-500">{isManager ? req.playerCity : "Manager : " + req.managerId.slice(0,8)}</p>
                          </div>
                       </div>
                       {!isManager && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${req.status === "pending" ? "bg-amber-100 text-amber-700" : req.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{req.status}</span>}
                    </div>
                    {req.message && <p className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg italic">&ldquo;{req.message}&rdquo;</p>}
                    
                    {isManager && req.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        <button onClick={() => handleRespondToApp(req, true)} className="flex-1 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold">Accepter</button>
                        <button onClick={() => handleRespondToApp(req, false)} className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold">Refuser</button>
                      </div>
                    )}
                  </div>
               ))}
               {joinRequests.filter(r => r.status === appSubTab).length === 0 && (
                 <div className="py-12 text-center text-gray-400 text-sm">
                   Aucune candidature {appSubTab === "pending" ? "en attente" : appSubTab === "accepted" ? "acceptée" : "refusée"}
                 </div>
               )}
             </div>
          </motion.div>
        )}

        {/* ---- TAB: INVITATIONS (Merged) ---- */}
        {mainTab === "invitations" && (
          <motion.div key="invitations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
             {/* Subtabs for status */}
             <div className="flex gap-4 border-b border-gray-100">
                {["pending", "accepted", "declined"].map(s => (
                  <button key={s} onClick={() => setInvSubTab(s)} className={`pb-2 text-sm font-medium transition-all border-b-2 ${invSubTab === s ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400"}`}>
                    {s === "pending" ? "En attente" : s === "accepted" ? "Acceptées" : "Déclinées"}
                    <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded-full text-[10px]">{invitations.filter(i => i.status === s).length}</span>
                  </button>
                ))}
             </div>

             <div className="space-y-3">
               {invitations.filter(i => i.status === invSubTab).map(inv => {
                  const status = respondingInv[inv.id];
                  const colors = COLOR_MAP[inv.teamName?.charAt(0).toLowerCase()] || COLOR_MAP.emerald;
                  return (
                  <div key={inv.id} className="relative overflow-hidden p-5 border border-gray-200 rounded-xl bg-white pl-6">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${colors.stripe}`} />
                    <div className="flex items-start justify-between">
                       <div className="flex items-center gap-3">
                          <div className={`h-10 w-10 rounded-lg ${colors.bg} flex items-center justify-center ${colors.icon}`}>
                            <Shield size={20}/>
                          </div>
                          <div>
                             <h4 className="font-bold text-gray-900">{isManager ? inv.receiverName : inv.teamName}</h4>
                             <p className="text-[10px] text-gray-500">
                               {isManager ? inv.receiverCity : "Invité par " + inv.senderName} • <Clock size={8} className="inline"/> {timeAgo(inv.createdAt)}
                             </p>
                          </div>
                       </div>
                       {isManager && <span className={`px-2 py-0.5 rounded-full text-xs ${INV_STATUS_CONFIG[inv.status as keyof typeof INV_STATUS_CONFIG]?.color || ""}`}>{inv.status}</span>}
                    </div>
                    {inv.message && <p className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded-lg italic">&ldquo;{inv.message}&rdquo;</p>}
                    
                    {isPlayer && inv.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        {!status ? (
                          <>
                            <button onClick={() => handlePlayerRespondInv(inv, true)} className="flex-1 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold">Accepter</button>
                            <button onClick={() => handlePlayerRespondInv(inv, false)} className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold">Décliner</button>
                          </>
                        ) : (
                          <div className="w-full text-center py-1.5 text-xs font-bold text-primary-600 bg-primary-50 rounded-lg">
                            {status === "accepted" ? "Acceptée !" : "Déclinée"}
                          </div>
                        )}
                      </div>
                    )}

                    {isManager && inv.status === "pending" && (
                       <button onClick={() => cancelInvitation(inv.id)} className="mt-4 text-xs text-red-500 font-medium">Annuler l&apos;invitation</button>
                    )}
                  </div>
               )})}
               {invitations.filter(i => i.status === invSubTab).length === 0 && (
                 <div className="py-12 text-center text-gray-400 text-sm">
                   Aucune invitation {invSubTab === "pending" ? "en attente" : invSubTab === "accepted" ? "acceptée" : "déclinée"}
                 </div>
               )}
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {inviteTarget && (
          <InviteModal entry={inviteTarget} teams={myTeams} senderName={`${user.firstName} ${user.lastName}`} onClose={() => setInviteTarget(null)} onSent={() => getShortlistByManager(user.uid).then(setShortlist)} />
        )}
        {candidatureTeam && (
          <CandidatureModal team={candidatureTeam} onClose={() => setCandidatureTeam(null)} onSubmit={handlePlayerApply} submitting={submittingApp} />
        )}
      </AnimatePresence>
    </div>
  );
}

// Manager specific removals
const handleRemoveFromShortlist = async (entry: ShortlistEntry) => {
  // This had to be moved inside or handled differently if I want to use state. 
  // I'll leave it as a placeholder or move it up.
};
