"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, MapPin, Filter, X,
  Bookmark, BookmarkCheck, Send, Clock,
  ChevronRight, Loader2, Users, Shield,
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
  onInvitationsForPlayer, respondToInvitation,
  // Réhydratation des avatars/logos absents des vieux documents
  getUsersByIds, getTeamsByIds,
} from "@/lib/firestore";
import { PlayerAvatar, TeamCrest } from "@/components/ui/EntityAvatar";
import MercatoPublic from "@/components/mercato/MercatoPublic";
import type { UserProfile, ShortlistEntry, JoinRequest, Invitation, Team } from "@/types";

// ============================================
// Constants & Helpers
// ============================================

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Gardien", defender: "Défenseur", midfielder: "Milieu", forward: "Attaquant",
};
// Le poste garde sa couleur : c'est l'axe sur lequel un manager balaie une
// grille de trente joueurs. Le niveau, lui, est passe en gris — deux echelles
// de couleur cote a cote se lisent moins bien qu'une seule.
const POSITION_COLORS: Record<string, string> = {
  goalkeeper: "bg-orange-100 text-orange-700", defender: "bg-blue-100 text-blue-700",
  midfielder: "bg-emerald-100 text-emerald-700", forward: "bg-amber-100 text-amber-700",
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Avancé",
};
const LEVEL_COLORS: Record<string, string> = {
  beginner: "bg-gray-100 text-gray-600", amateur: "bg-gray-100 text-gray-600",
  intermediate: "bg-gray-100 text-gray-600", advanced: "bg-gray-900 text-white",
};
// Villes du public visé. La liste gelée proposait Paris/Lyon/Marseille/Toulouse,
// héritage d'avant le pivot — inutilisable pour une audience togolaise.
const CITIES = ["Toutes", "Lomé", "Kara", "Sokodé", "Kpalimé", "Atakpamé", "Dapaong", "Tsévié"];

// NB : searchPlayers accepte aussi un filtre `position`, jamais câblé dans l'UI.

const LEVELS = ["Tous", "beginner", "amateur", "intermediate", "advanced"];

const FOOT_LABELS: Record<string, string> = {
  left: "gauche", right: "droit", both: "ambidextre",
};

/** Age in whole years, or null when no date of birth is on file. */
function playerAge(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : null;
}

const INV_STATUS_CONFIG = {
  pending:  { label: "En attente", color: "bg-gray-100 text-gray-600" },
  accepted: { label: "Acceptée",   color: "bg-emerald-700 text-white" },
  declined: { label: "Déclinée",   color: "bg-gray-900 text-white" },
};

// Les gabarits affichaient jusqu'ici la valeur brute de la base — "pending",
// "accepted" — a des lecteurs francophones.
const APP_STATUS_LABELS: Record<string, string> = {
  pending: "En attente", accepted: "Acceptée", rejected: "Refusée",
};

// Couleur de fond du blason d'une equipe qui n'a pas de logo. Le liseré
// (`stripe`) a disparu avec les cartes d'invitation : il etait choisi par la
// premiere lettre du nom d'equipe contre des cles qui sont des noms de
// couleurs, donc il retombait toujours sur emerald.
const COLOR_MAP: Record<string, { bg: string; icon: string }> = {
  amber: { bg: "bg-amber-100", icon: "text-amber-600" },
  blue: { bg: "bg-blue-100", icon: "text-blue-600" },
  red: { bg: "bg-red-100", icon: "text-red-600" },
  emerald: { bg: "bg-emerald-100", icon: "text-emerald-600" },
  purple: { bg: "bg-purple-100", icon: "text-purple-600" },
  orange: { bg: "bg-orange-100", icon: "text-orange-600" },
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
        receiverPhoto: entry.playerPhoto,
        teamLogo: team?.logoUrl ?? null,
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
    <div className="fixed inset-0 modal-layer flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md border border-gray-200/70 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <PlayerAvatar name={entry.playerName} photo={entry.playerPhoto} size={40} />
            <h3 className="truncate font-display text-lg font-black tracking-tight text-gray-900">Inviter {entry.playerName}</h3>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 text-gray-400 transition-colors hover:text-gray-900"><X size={20} /></button>
        </div>
        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Équipe</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none">
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
              placeholder="Un petit mot pour le joueur..."
              className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none" />
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <button onClick={handleSend} disabled={sending || !teamId}
            className="flex flex-1 items-center justify-center gap-2 bg-gray-900 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            {sending ? "Envoi..." : "Envoyer"}
          </button>
          <button onClick={onClose}
            className="border border-gray-200/70 px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900">
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
    <div className="fixed inset-0 modal-layer flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md border border-gray-200/70 bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <TeamCrest name={team.name} logo={team.logoUrl} size={40} />
            <h2 className="truncate font-display text-lg font-black tracking-tight text-gray-900">Candidater à {team.name}</h2>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="shrink-0 p-1 text-gray-400 transition-colors hover:text-gray-900">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div>
            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Ton message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} rows={5}
              placeholder="Présente-toi..."
              className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none" />
            <p className="mt-1 text-right text-[11px] font-bold text-gray-400">{message.length}/500</p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200/70 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 bg-gray-900 px-4 py-3.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
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
  // Post-pivot the side of the market a user sees follows their ACTIVATED
  // role, not their account type: an organizer who also activated the
  // manager space keeps `userType: "organizer"`, so gating on userType
  // alone would show them the player view. userType stays as the fallback
  // for accounts created before /evolution existed.
  const role = user?.evolutionRole ?? user?.userType ?? null;
  const isManager = role === "manager";
  const isPlayer = role === "player";

  // ---- Tabs ----
  const [mainTab, setMainTab] = useState<string>(isManager ? "players" : "teams");

  // Deep link (« Recruter » depuis la page équipe → /mercato?tab=players).
  // Lu sur window plutôt que via useSearchParams, comme /feed?post= : pas de
  // frontière Suspense à poser pour un paramètre facultatif.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    const allowed = isManager
      ? ["players", "shortlist", "applications", "invitations"]
      : ["teams", "applications", "invitations"];
    if (wanted && allowed.includes(wanted)) setMainTab(wanted);
  }, [isManager]);

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

  // ---- Avatars & logos manquants ----
  // Les candidatures, invitations et sélections créées avant que la photo et
  // le blason ne soient recopiés dans le document n'en portent pas. On relit
  // les profils et les équipes concernés en une passe : sans ça la moitié du
  // marché resterait en initiales et en icônes génériques.
  const [photoById, setPhotoById] = useState<Record<string, string | null>>({});
  const [logoById, setLogoById] = useState<Record<string, string | null>>({});
  const askedRef = useRef<Set<string>>(new Set());

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
        const filters: Parameters<typeof searchPlayers>[0] = {};
        if (cityFilter !== "Toutes") filters.city = cityFilter;
        if (levelFilter !== "Tous") filters.skillLevel = levelFilter;
        if (nameQuery) filters.query = nameQuery;
        const results = await searchPlayers(filters);
        setPlayers(results.filter((p) => p.uid !== user.uid && !myMemberIds.has(p.uid)));
      } else if (isPlayer) {
        const filters: Parameters<typeof searchTeams>[0] = {};
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

  // Clés stables : les listes temps réel changent d'identité à chaque
  // snapshot, les garder en dépendance relancerait la lecture sans arrêt.
  const missingPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of shortlist) if (!e.playerPhoto) ids.add(e.playerId);
    for (const r of joinRequests) if (!r.playerPhoto) ids.add(r.playerId);
    for (const i of invitations) if (!i.receiverPhoto) ids.add(i.receiverId);
    return [...ids].sort().join(",");
  }, [shortlist, joinRequests, invitations]);

  const missingTeamIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of joinRequests) if (!r.teamLogo) ids.add(r.teamId);
    for (const i of invitations) if (!i.teamLogo) ids.add(i.teamId);
    return [...ids].sort().join(",");
  }, [joinRequests, invitations]);

  useEffect(() => {
    const ids = (missingPlayerIds ? missingPlayerIds.split(",") : [])
      .filter((id) => id && !askedRef.current.has(`u:${id}`));
    if (ids.length === 0) return;
    ids.forEach((id) => askedRef.current.add(`u:${id}`));
    getUsersByIds(ids)
      .then((users) => {
        const found = new Map(users.map((u) => [u.uid, u.profilePictureUrl]));
        // Les introuvables sont mémorisés à null, sinon la requête repartirait
        // à chaque rendu pour un compte supprimé.
        setPhotoById((prev) => ({
          ...prev,
          ...Object.fromEntries(ids.map((id) => [id, found.get(id) ?? null])),
        }));
      })
      .catch(() => {});
  }, [missingPlayerIds]);

  useEffect(() => {
    const ids = (missingTeamIds ? missingTeamIds.split(",") : [])
      .filter((id) => id && !askedRef.current.has(`t:${id}`));
    if (ids.length === 0) return;
    ids.forEach((id) => askedRef.current.add(`t:${id}`));
    getTeamsByIds(ids)
      .then((found) => {
        const byId = new Map(found.map((t) => [t.id, t.logoUrl ?? null]));
        setLogoById((prev) => ({
          ...prev,
          ...Object.fromEntries(ids.map((id) => [id, byId.get(id) ?? null])),
        }));
      })
      .catch(() => {});
  }, [missingTeamIds]);

  const photoOf = (id: string, denormalized?: string | null) =>
    denormalized ?? photoById[id] ?? null;
  const logoOf = (id: string, denormalized?: string | null) =>
    denormalized ?? logoById[id] ?? null;

  // ---- Actions: Manager ----
  const handleAddToShortlist = async (player: UserProfile) => {
    if (!user) return;
    setAddingToShortlist((prev) => new Set([...prev, player.uid]));
    try {
      const id = await addToShortlist({
        managerId: user.uid, playerId: player.uid,
        playerName: `${player.firstName} ${player.lastName}`,
        playerPhoto: player.profilePictureUrl,
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
          receiverPhoto: photoOf(req.playerId, req.playerPhoto),
          teamLogo: logoOf(req.teamId, req.teamLogo)
            ?? myTeams.find((t) => t.id === req.teamId)?.logoUrl ?? null,
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
        playerPhoto: user.profilePictureUrl,
        playerCity: user.locationCity, playerPosition: user.position ?? "",
        playerLevel: user.skillLevel ?? "", teamId: candidatureTeam.id,
        teamName: candidatureTeam.name, teamLogo: candidatureTeam.logoUrl ?? null,
        managerId: candidatureTeam.managerId, message,
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

  // A visitor gets the public side of the market rather than a blank page:
  // confirmed arrivals are information, the tools below are actions.
  if (!user) return <MercatoPublic />;

  // The market has two sides and no neutral one: without an activated role
  // every tab below is gated off and the page would render empty.
  if (!isManager && !isPlayer) {
    return (
      <div className="mx-auto max-w-3xl pb-24 pt-4">
        <p className="max-w-lg text-base leading-relaxed text-gray-500">
          Le marché a deux côtés et pas de neutre : entre en <strong className="font-black text-gray-900">joueur</strong> pour
          trouver une équipe, en <strong className="font-black text-gray-900">manager</strong> pour recruter.
        </p>
        <Link
          href="/evolution"
          className="mt-7 inline-flex items-center gap-2 border border-gray-900 bg-gray-900 px-6 py-4 text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:border-emerald-700 hover:bg-emerald-700"
        >
          Choisir mon rôle
          <ChevronRight size={15} />
        </Link>
      </div>
    );
  }

  const pendingAppsCount = joinRequests.filter(r => r.status === "pending").length;
  const pendingInvsCount = invitations.filter(i => i.status === "pending").length;
  // Un manager attend des reponses des deux cotes ; un joueur ne repond qu'aux
  // invitations, ses candidatures sont dans le camp d'en face.
  const waitingCount = isManager ? pendingAppsCount + pendingInvsCount : pendingInvsCount;

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-24 pt-4">
      {/* Pas de titre : « Mercato » est deja dans la barre du haut, et un H1
          qui repete l'onglet actif ne fait que manger le haut de l'ecran.
          Ce qui attend une reponse, en revanche, ne se lit nulle part
          ailleurs — et se dit en toutes lettres plutot qu'en pastille : le
          chiffre seul n'apprend pas ce qu'il compte. */}
      {waitingCount > 0 && (
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700">
          {waitingCount} {waitingCount > 1 ? "réponses attendues" : "réponse attendue"}
        </p>
      )}

      {/* Onglets. Les icones sont tombees : les libelles sont deja courts et
          sans ambiguite, l'icone repetait le mot au lieu de l'abreger. */}
      <div className="flex gap-7 overflow-x-auto border-b border-gray-200/70">
        {(isManager ? [
          { key: "players",      label: "Joueurs",       count: undefined },
          { key: "shortlist",    label: "Sélection",     count: shortlist.length },
          { key: "applications", label: "Candidatures",  count: pendingAppsCount },
          { key: "invitations",  label: "Invitations",   count: pendingInvsCount },
        ] : [
          { key: "teams",        label: "Équipes",       count: undefined },
          { key: "applications", label: "Candidatures",  count: pendingAppsCount },
          { key: "invitations",  label: "Invitations",   count: pendingInvsCount },
        ]).map((tab) => (
          <button key={tab.key} onClick={() => setMainTab(tab.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 pb-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
              mainTab === tab.key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-2 ${mainTab === tab.key ? "text-emerald-700" : "text-emerald-600/70"}`}>{tab.count}</span>
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
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Rechercher par nom..."
                  className="w-full border border-gray-200/70 bg-white py-3 pl-11 pr-3 text-sm font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-gray-900 focus:outline-none" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex shrink-0 items-center gap-2 border px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                  showFilters ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900"
                }`}>
                <Filter size={14} /> Filtres
              </button>
            </div>
            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-5 border border-gray-200/70 bg-gray-50 p-5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Ville</label>
                  <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none">
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Niveau</label>
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none">
                    {LEVELS.map(l => <option key={l} value={l}>{l === "Tous" ? "Tous" : LEVEL_LABELS[l]}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="h-52 animate-pulse border border-gray-200/70 bg-gray-100" />)}
              </div>
            ) : players.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {players.map(p => {
                  const shortlisted = shortlistedIds.has(p.uid);
                  const age = playerAge(p.dateOfBirth);
                  return (
                  <div key={p.uid} className="flex flex-col border border-gray-200/70 bg-white p-5 transition-colors hover:border-gray-900">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-lg font-black text-gray-500">
                        {p.profilePictureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profilePictureUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <>{p.firstName[0]}{p.lastName[0]}</>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-display text-lg font-black tracking-tight text-gray-900">{p.firstName} {p.lastName}</h4>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
                          <MapPin size={10} className="shrink-0" /> {p.locationCity || "Ville non précisée"}
                        </p>
                      </div>
                    </div>

                    {/* What a manager actually scouts on */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.position && (
                        <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${POSITION_COLORS[p.position] || "bg-gray-100 text-gray-600"}`}>
                          {POSITION_LABELS[p.position] || p.position}
                        </span>
                      )}
                      {p.skillLevel && (
                        <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${LEVEL_COLORS[p.skillLevel] || "bg-gray-100 text-gray-600"}`}>
                          {LEVEL_LABELS[p.skillLevel] || p.skillLevel}
                        </span>
                      )}
                    </div>

                    {(age !== null || p.strongFoot || p.height) && (
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500">
                        {age !== null && <span>{age} ans</span>}
                        {p.strongFoot && <span>Pied {FOOT_LABELS[p.strongFoot]}</span>}
                        {p.height && <span>{p.height} cm</span>}
                      </div>
                    )}

                    <div className="mt-auto flex gap-2 pt-4">
                       <Link href={`/profile/${p.uid}`} className="flex-1 border border-gray-200/70 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900">Profil</Link>
                       <button
                         onClick={() => !shortlisted && handleAddToShortlist(p)}
                         disabled={shortlisted || addingToShortlist.has(p.uid)}
                         aria-label={shortlisted ? "Déjà dans la shortlist" : "Ajouter à la shortlist"}
                         className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                           shortlisted
                             ? "border border-emerald-700 text-emerald-700"
                             : "bg-gray-900 text-white hover:bg-emerald-700"
                         }`}
                       >
                        {addingToShortlist.has(p.uid) ? <Loader2 size={16} className="animate-spin" /> : shortlisted ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
                        <span className="hidden sm:inline">{shortlisted ? "Suivi" : "Suivre"}</span>
                       </button>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-gray-200/70 bg-white px-6 py-16 text-center">
                <Users size={30} strokeWidth={1.4} className="mx-auto text-gray-300" />
                <p className="mt-3 text-base font-bold text-gray-400">Aucun joueur ne correspond à tes filtres</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ---- TAB: TEAMS (Player only) ---- */}
        {isPlayer && mainTab === "teams" && (
          <motion.div key="teams" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
             <div className="flex gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={nameQuery} onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Rechercher une équipe..."
                  className="w-full border border-gray-200/70 bg-white py-3 pl-11 pr-3 text-sm font-bold text-gray-900 placeholder:font-medium placeholder:text-gray-400 focus:border-gray-900 focus:outline-none" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`flex shrink-0 items-center gap-2 border px-5 py-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                  showFilters ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900"
                }`}>
                <Filter size={14} /> Filtres
              </button>
            </div>
            {showFilters && (
               <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="flex flex-wrap gap-5 border border-gray-200/70 bg-gray-50 p-5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Ville</label>
                  <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none">
                    {CITIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Niveau</label>
                  <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="border border-gray-200/70 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 focus:border-gray-900 focus:outline-none">
                    {LEVELS.map(l => <option key={l} value={l}>{l === "Tous" ? "Tous" : LEVEL_LABELS[l]}</option>)}
                  </select>
                </div>
              </motion.div>
            )}
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => <div key={i} className="h-52 animate-pulse border border-gray-200/70 bg-gray-100" />)}
              </div>
            ) : teams.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {teams.map(t => {
                   const hasSent = sentRequestIds.has(t.id);
                   const colors = COLOR_MAP[t.color] || COLOR_MAP.emerald;
                   const full = t.memberIds.length >= t.maxMembers;
                   const played = t.matchesPlayed ?? 0;
                   return (
                    <div key={t.id} className="flex flex-col border border-gray-200/70 bg-white p-5 transition-colors hover:border-gray-900">
                      <div className="flex items-start justify-between gap-3">
                         <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden ${colors.bg}`}>
                           {t.logoUrl ? (
                             // eslint-disable-next-line @next/next/no-img-element
                             <img src={t.logoUrl} alt="" className="h-full w-full object-cover" />
                           ) : (
                             <Shield size={32} className={colors.icon} />
                           )}
                         </div>
                         <div className="flex flex-col items-end gap-1.5">
                           <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${LEVEL_COLORS[t.level] || "bg-gray-100 text-gray-600"}`}>
                             {LEVEL_LABELS[t.level] || t.level}
                           </span>
                           {/* Whether they are taking players is the first thing
                               a player needs to know. */}
                           {t.isRecruiting && !full && (
                             <span className="bg-emerald-700 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                               Recrute
                             </span>
                           )}
                         </div>
                      </div>

                      <h4 className="mt-4 truncate font-display text-lg font-black tracking-tight text-gray-900">{t.name}</h4>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
                        <MapPin size={10} className="shrink-0" /> {t.city || "Ville non précisée"}
                      </p>

                      {t.description && (
                        <p className="mt-2 line-clamp-2 text-xs italic leading-relaxed text-gray-500">
                          &ldquo;{t.description}&rdquo;
                        </p>
                      )}

                      {/* Squad size and record — what tells a player whether
                          there is room, and what they would be joining. */}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-bold">
                        <span className={full ? "text-red-500" : "text-gray-600"}>
                          {t.memberIds.length}/{t.maxMembers} joueurs{full ? " · complet" : ""}
                        </span>
                        {played > 0 && (
                          <span className="text-gray-500">
                            <span className="text-emerald-600">{t.wins}V</span>
                            {" · "}{t.draws}N{" · "}
                            <span className="text-red-500">{t.losses}D</span>
                          </span>
                        )}
                      </div>

                      <div className="mt-auto flex gap-2 pt-4">
                         <Link href={`/teams/${t.id}?from=mercato`} className="flex-1 border border-gray-200/70 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900">Détails</Link>
                         <button
                           onClick={() => !hasSent && !full && setCandidatureTeam(t)}
                           disabled={hasSent || full}
                           className={`flex-[2] py-2.5 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                             hasSent || full
                               ? "border border-gray-200/70 text-gray-400"
                               : "bg-gray-900 text-white hover:bg-emerald-700"
                           }`}
                         >
                          {hasSent ? "Candidature envoyée" : full ? "Effectif complet" : "Candidater"}
                         </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-gray-200/70 bg-white px-6 py-16 text-center">
                <Shield size={30} strokeWidth={1.4} className="mx-auto text-gray-300" />
                <p className="mt-3 text-base font-bold text-gray-400">Aucune équipe ne correspond à tes filtres</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ---- TAB: SHORTLIST (Manager only) ---- */}
        {isManager && mainTab === "shortlist" && (
           <motion.div key="shortlist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
             {shortlist.length > 0 ? (
               <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
                 {shortlist.map(e => (
                 <div key={e.id} className="flex items-center gap-4 px-5 py-4">
                    <PlayerAvatar name={e.playerName} photo={photoOf(e.playerId, e.playerPhoto)} size={40} />
                    <div className="min-w-0 flex-1">
                       <h4 className="truncate text-base font-bold text-gray-900">{e.playerName}</h4>
                       <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
                         {e.playerCity} · {POSITION_LABELS[e.playerPosition] || e.playerPosition}
                       </p>
                    </div>
                    <button onClick={() => setInviteTarget(e)} className="shrink-0 bg-gray-900 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:bg-emerald-700">Inviter</button>
                    <button onClick={() => handleRemoveFromShortlist(e)} aria-label="Retirer de la sélection" className="shrink-0 p-2 text-gray-300 transition-colors hover:text-red-600">
                      {removingId === e.id ? <Loader2 size={16} className="animate-spin"/> : <X size={16}/>}
                    </button>
                 </div>
                 ))}
               </div>
             ) : (
               <div className="border border-gray-200/70 bg-white px-6 py-16 text-center">
                 <Bookmark size={30} strokeWidth={1.4} className="mx-auto text-gray-300" />
                 <p className="mt-3 text-base font-bold text-gray-400">Ta sélection est vide</p>
               </div>
             )}
           </motion.div>
        )}

        {/* ---- TAB: APPLICATIONS (Merged) ---- */}
        {mainTab === "applications" && (
          <motion.div key="applications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
             {/* Subtabs for status */}
             <div className="flex gap-6 border-b border-gray-200/70">
                {["pending", "accepted", "rejected"].map(s => (
                  <button key={s} onClick={() => setAppSubTab(s)} className={`border-b-2 pb-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${appSubTab === s ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
                    {s === "pending" ? "En attente" : s === "accepted" ? "Acceptées" : "Refusées"}
                    <span className="ml-2 text-gray-300">{joinRequests.filter(r => r.status === s).length}</span>
                  </button>
                ))}
             </div>

             <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
               {joinRequests.filter(r => r.status === appSubTab).map(req => (
                  <div key={req.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                       <div className="flex min-w-0 items-center gap-4">
                          {isManager ? (
                            <PlayerAvatar name={req.playerName} photo={photoOf(req.playerId, req.playerPhoto)} size={40} />
                          ) : (
                            <TeamCrest name={req.teamName} logo={logoOf(req.teamId, req.teamLogo)} size={40} />
                          )}
                          <div className="min-w-0">
                             <h4 className="truncate text-base font-bold text-gray-900">{isManager ? req.playerName : req.teamName}</h4>
                             <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">{isManager ? req.playerCity : "Manager : " + req.managerId.slice(0,8)}</p>
                          </div>
                       </div>
                       {!isManager && <span className={`shrink-0 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${req.status === "pending" ? "bg-gray-100 text-gray-600" : req.status === "accepted" ? "bg-emerald-700 text-white" : "bg-gray-900 text-white"}`}>{APP_STATUS_LABELS[req.status] || req.status}</span>}
                    </div>
                    {req.message && <p className="mt-3 border-l-2 border-gray-200 pl-3 text-sm italic leading-relaxed text-gray-600">&ldquo;{req.message}&rdquo;</p>}
                    
                    {isManager && req.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        {/* Disabled while in flight: accepting also fires an
                            invitation, so a double-click sends it twice. */}
                        <button
                          onClick={() => handleRespondToApp(req, true)}
                          disabled={respondingApp === req.id}
                          className="flex-1 bg-gray-900 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
                        >
                          {respondingApp === req.id ? "..." : "Accepter"}
                        </button>
                        <button
                          onClick={() => handleRespondToApp(req, false)}
                          disabled={respondingApp === req.id}
                          className="flex-1 border border-gray-200/70 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900 disabled:opacity-40"
                        >
                          Refuser
                        </button>
                      </div>
                    )}
                  </div>
               ))}
               {joinRequests.filter(r => r.status === appSubTab).length === 0 && (
                 <div className="px-6 py-16 text-center text-base font-bold text-gray-400">
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
             <div className="flex gap-6 border-b border-gray-200/70">
                {["pending", "accepted", "declined"].map(s => (
                  <button key={s} onClick={() => setInvSubTab(s)} className={`border-b-2 pb-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${invSubTab === s ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"}`}>
                    {s === "pending" ? "En attente" : s === "accepted" ? "Acceptées" : "Déclinées"}
                    <span className="ml-2 text-gray-300">{invitations.filter(i => i.status === s).length}</span>
                  </button>
                ))}
             </div>

             <div className="divide-y divide-gray-200/70 border border-gray-200/70 bg-white">
               {invitations.filter(i => i.status === invSubTab).map(inv => {
                  const status = respondingInv[inv.id];
                  return (
                  <div key={inv.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                       <div className="flex min-w-0 items-center gap-4">
                          {isManager ? (
                            <PlayerAvatar name={inv.receiverName} photo={photoOf(inv.receiverId, inv.receiverPhoto)} size={40} />
                          ) : (
                            <TeamCrest name={inv.teamName} logo={logoOf(inv.teamId, inv.teamLogo)} size={40} />
                          )}
                          <div className="min-w-0">
                             <h4 className="truncate text-base font-bold text-gray-900">{isManager ? inv.receiverName : inv.teamName}</h4>
                             <p className="flex items-center gap-1 truncate text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">
                               {isManager ? inv.receiverCity : "Invité par " + inv.senderName}
                               <span className="text-gray-300">·</span>
                               <Clock size={9} className="shrink-0"/> {timeAgo(inv.createdAt)}
                             </p>
                          </div>
                       </div>
                       {isManager && <span className={`shrink-0 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${INV_STATUS_CONFIG[inv.status as keyof typeof INV_STATUS_CONFIG]?.color || "bg-gray-100 text-gray-600"}`}>{INV_STATUS_CONFIG[inv.status as keyof typeof INV_STATUS_CONFIG]?.label || inv.status}</span>}
                    </div>
                    {inv.message && <p className="mt-3 border-l-2 border-gray-200 pl-3 text-sm italic leading-relaxed text-gray-600">&ldquo;{inv.message}&rdquo;</p>}
                    
                    {isPlayer && inv.status === "pending" && (
                      <div className="mt-4 flex gap-2">
                        {!status ? (
                          <>
                            <button onClick={() => handlePlayerRespondInv(inv, true)} className="flex-1 bg-gray-900 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-white transition-colors hover:bg-emerald-700">Accepter</button>
                            <button onClick={() => handlePlayerRespondInv(inv, false)} className="flex-1 border border-gray-200/70 py-2.5 text-[11px] font-black uppercase tracking-[0.15em] text-gray-600 transition-colors hover:border-gray-900 hover:text-gray-900">Décliner</button>
                          </>
                        ) : (
                          <div className="w-full border border-emerald-700 py-2.5 text-center text-[11px] font-black uppercase tracking-[0.15em] text-emerald-700">
                            {status === "accepted" ? "Acceptée" : "Déclinée"}
                          </div>
                        )}
                      </div>
                    )}

                    {isManager && inv.status === "pending" && (
                       <button onClick={() => cancelInvitation(inv.id)} className="mt-4 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 transition-colors hover:text-red-600">Annuler l&apos;invitation</button>
                    )}
                  </div>
               )})}
               {invitations.filter(i => i.status === invSubTab).length === 0 && (
                 <div className="px-6 py-16 text-center text-base font-bold text-gray-400">
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
