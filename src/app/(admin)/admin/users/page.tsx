"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, Search, Filter, ChevronDown, MoreVertical,
  UserCheck, UserX, Shield, ShieldCheck, ClipboardList, UserMinus,
  Mail, Phone, MapPin, Calendar,
  Eye, Ban, CheckCircle, XCircle, Loader2,
} from "lucide-react";
import { getAllUsers, getModeratorIds, toggleUserActive } from "@/lib/admin-firestore";
import {
  ESPACE_LABELS, espacesDuCompte, roleEffectif, roleHerite, type EspaceAcces,
} from "@/lib/espaces-acces";
import RecordActions from "@/components/admin/RecordActions";
import { useAuth } from "@/contexts/AuthContext";
import type { EvolutionRole, UserProfile, UserRole } from "@/types";
import toast from "react-hot-toast";

/**
 * Les rôles, et rien d'autre.
 *
 * Organisateur, propriétaire de terrain et administrateur figuraient ici :
 * ce ne sont pas des rôles mais des CASQUETTES, ce qu'un compte FAIT en plus
 * de ce qu'il EST sur le terrain (voir lib/hats). Les mélanger donnait une
 * colonne où « organisateur » chassait « joueur », alors que le même compte
 * est les deux. Ils vivent maintenant dans la colonne des espaces, avec la
 * console live et l'administration.
 */
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  player: { label: "Joueur", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-400" },
  manager: { label: "Manager", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-400" },
  referee: { label: "Arbitre", color: "text-purple-700", bg: "bg-purple-50", dot: "bg-purple-400" },
  venue_owner: { label: "Propriétaire", color: "text-orange-700", bg: "bg-orange-50", dot: "bg-orange-400" },
  organizer: { label: "Organisateur", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-400" },
  superadmin: { label: "Admin", color: "text-red-700", bg: "bg-red-50", dot: "bg-red-400" },
};

// The two roles /api/admin/promote can grant. Everything else (player,
// manager, referee) is chosen by the user at signup, not handed out here.
type RoleAction = "organizer" | "superadmin" | "revoke";

function timeAgo(dateInput: any): string {
  if (!dateInput) return "";
  const date = dateInput && typeof dateInput.toDate === "function" 
    ? dateInput.toDate() 
    : new Date(dateInput);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `il y a ${Math.floor(diff / 86400)}j`;
  return new Date(date).toLocaleDateString("fr-FR");
}

const ROLE_OPTION_TONES = {
  amber: "border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-700",
  red: "border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700",
  gray: "border-gray-200 bg-gray-50/50 hover:bg-gray-50 text-gray-700",
} as const;

function RoleOption({
  icon: Icon, label, hint, tone, busy, disabled, onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  hint: string;
  tone: keyof typeof ROLE_OPTION_TONES;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 ${ROLE_OPTION_TONES[tone]}`}
    >
      {busy ? <Loader2 size={17} className="animate-spin shrink-0" /> : <Icon size={17} className="shrink-0" />}
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-xs text-gray-500">{hint}</span>
      </span>
    </button>
  );
}

export default function AdminUsersPage() {
  const { firebaseUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Sur le rôle EFFECTIF : celui qu'on a activé dans Évolution, ou à défaut
  // celui déclaré à l'inscription pour les comptes plus anciens. Voir
  // lib/espaces-acces, même raisonnement que pour les casquettes.
  const [roleFilter, setRoleFilter] = useState<"all" | "sans" | EvolutionRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  // CE QU'UN COMPTE PEUT OUVRIR, et non ce que dit `user_type` — qui vaut
  // « player » par défaut à l'inscription, choisi ou non. Un espace s'ouvre
  // par le rôle OU par une casquette OU par une modération, voir
  // lib/espaces-acces.
  const [espaceFilter, setEspaceFilter] = useState<"all" | "aucun" | EspaceAcces>("all");
  const [moderateurs, setModerateurs] = useState<Set<string>>(new Set());
  const [roleTarget, setRoleTarget] = useState<UserProfile | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState<RoleAction | null>(null);

  // Pas de `setLoading(true)` ici : l'état de départ est déjà « en
  // chargement », et le poser depuis l'effet déclencherait un rendu en
  // cascade. Un rechargement après correction remplace la liste sans clignoter.
  const charger = useCallback(() => {
    getAllUsers(500)
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Une seule traversée des compétitions répond pour toute la liste : la
  // console live s'ouvre sur `moderator_ids`, pas sur le compte.
  useEffect(() => {
    getModeratorIds().then(setModerateurs).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const role = roleEffectif(u);
      if (roleFilter === "sans" && role) return false;
      if (roleFilter !== "all" && roleFilter !== "sans" && role !== roleFilter) return false;
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "inactive" && u.isActive) return false;
      if (espaceFilter !== "all") {
        const ouverts = espacesDuCompte(u, moderateurs);
        if (espaceFilter === "aucun" ? ouverts.length > 0 : !ouverts.includes(espaceFilter)) {
          return false;
        }
      }
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
  }, [users, search, roleFilter, statusFilter, espaceFilter, moderateurs]);

  const roleCounts = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => {
      const cle = roleEffectif(u) ?? "sans";
      map.set(cle, (map.get(cle) ?? 0) + 1);
    });
    return map;
  }, [users]);

  const sansEspace = useMemo(
    () => users.filter((u) => espacesDuCompte(u, moderateurs).length === 0).length,
    [users, moderateurs],
  );

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

  const handleRoleChange = async (target: UserProfile, choice: RoleAction) => {
    if (!firebaseUser) return;
    setSavingRole(choice);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          choice === "revoke"
            ? { uid: target.uid, action: "revoke" }
            : { uid: target.uid, action: "promote", role: choice },
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erreur lors du changement de rôle.");
        return;
      }
      const newType = data.user_type as UserRole;
      setUsers((prev) =>
        prev.map((u) => (u.uid === target.uid ? { ...u, userType: newType } : u)),
      );
      toast.success(data.message ?? "Casquettes mises à jour.");
      setRoleTarget(null);
    } catch {
      toast.error("Erreur réseau.");
    } finally {
      setSavingRole(null);
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
          {users.length} utilisateurs au total, dont {sansEspace} sans aucun espace
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
          // Les casquettes ne sont pas des rôles : elles se filtrent par la
          // liste des espaces, à côté, où elles cohabitent avec le rôle au
          // lieu de le remplacer.
          { value: "sans" as const, label: "Sans rôle", count: roleCounts.get("sans") ?? 0 },
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
          value={espaceFilter}
          onChange={(e) => setEspaceFilter(e.target.value as "all" | "aucun" | EspaceAcces)}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        >
          <option value="all">Tous les espaces</option>
          <option value="aucun">Aucun espace</option>
          {(Object.keys(ESPACE_LABELS) as EspaceAcces[]).map((e) => (
            <option key={e} value={e}>Accès {ESPACE_LABELS[e].toLowerCase()}</option>
          ))}
        </select>
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
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Espaces ouverts</th>
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
                  const role = roleEffectif(u);
                  const roleConf = role ? ROLE_CONFIG[role] : null;
                  const herite = roleHerite(u);
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
                            <p className="text-xs text-gray-500 truncate max-w-[180px]">{u.email || u.phone || ","}</p>
                          </div>
                        </div>
                      </td>
                      {/* CE QUE LE COMPTE PEUT OUVRIR, calculé comme le
                          calcule la navigation du produit : rôle, casquettes,
                          modération. Une pastille vide dit ce que `user_type`
                          cachait — un compte qui ne voit que les scores. */}
                      <td className="px-5 py-3">
                        {/* Cliquable, parce que c'est ICI que se règle ce qui
                            s'accorde : les casquettes organisateur et
                            administrateur. Elles ouvrent un espace, donc elles
                            se donnent depuis la colonne des espaces. */}
                        <button
                          onClick={() => setRoleTarget(u)}
                          title="Gérer les casquettes"
                          className="flex flex-wrap items-center gap-1 rounded-lg px-1 py-0.5 text-left transition-all hover:ring-2 hover:ring-gray-200"
                        >
                          {(() => {
                            const ouverts = espacesDuCompte(u, moderateurs);
                            if (ouverts.length === 0) {
                              return (
                                <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                                  Aucun
                                </span>
                              );
                            }
                            return ouverts.map((e) => (
                              <span
                                key={e}
                                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-700"
                              >
                                {ESPACE_LABELS[e]}
                              </span>
                            ));
                          })()}
                          <ChevronDown size={11} className="text-gray-300" />
                        </button>
                      </td>
                      {/* Le rôle ne se donne pas depuis ici : c'est le compte
                          qui le choisit, dans Évolution. Une pastille cliquable
                          laissait croire le contraire. Ce qui S'ACCORDE — les
                          casquettes — se règle depuis la colonne des espaces. */}
                      <td className="px-5 py-3">
                        {roleConf ? (
                          <span
                            title={herite
                              ? "Déclaré à l'inscription, jamais activé dans Évolution : le produit ne lui ouvre pas cet espace."
                              : "Activé dans Évolution"}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${roleConf.bg} ${roleConf.color}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${roleConf.dot}`} />
                            {roleConf.label}
                            {/* Hérité : le rôle est déclaré mais pas activé, et
                                la navigation n'ouvre l'espace qu'une fois
                                activé. Sans cette marque, la colonne « Rôle »
                                et la colonne « Espaces » se contrediraient sans
                                qu'on comprenne pourquoi. */}
                            {herite && <span className="font-normal opacity-60">hérité</span>}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-gray-300">Aucun</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-sm text-gray-600">{u.locationCity || ","}</span>
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
                        {/* La correction d'identité et l'effacement d'un compte
                            vivent à côté de la suspension : trois gestes de la
                            même colonne, du plus réversible au moins. Le rôle,
                            lui, garde son propre chemin (la pastille). */}
                        <span className="ml-2 inline-flex align-middle">
                          <RecordActions
                            resource="user"
                            id={u.uid}
                            label={`${u.firstName} ${u.lastName}`}
                            onDone={charger}
                            champs={[
                              { cle: "first_name", label: "Prénom" },
                              { cle: "last_name", label: "Nom" },
                              { cle: "location_city", label: "Ville" },
                              { cle: "bio", label: "Bio" },
                            ]}
                            valeurs={{
                              first_name: u.firstName, last_name: u.lastName,
                              location_city: u.locationCity, bio: u.bio ?? "",
                            }}
                          />
                        </span>
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

      {/* Role change modal */}
      <AnimatePresence>
        {roleTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 modal-layer flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => savingRole === null && setRoleTarget(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-gray-900">
                Casquettes de {roleTarget.firstName} {roleTarget.lastName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Ouvre{" "}
                <span className="font-medium text-gray-700">
                  {espacesDuCompte(roleTarget, moderateurs).map((e) => ESPACE_LABELS[e]).join(", ")
                    || "aucun espace"}
                </span>
                {", "}
                {roleTarget.email || roleTarget.phone || "sans contact"}
              </p>

              {roleTarget.uid === firebaseUser?.uid ? (
                <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500">
                  Vous ne pouvez pas modifier vos propres casquettes.
                </p>
              ) : (
                <div className="mt-5 space-y-2">
                  {roleTarget.userType !== "organizer" && (
                    <RoleOption
                      icon={ClipboardList}
                      label="Promouvoir organisateur"
                      hint="Peut créer et gérer ses compétitions."
                      tone="amber"
                      busy={savingRole === "organizer"}
                      disabled={savingRole !== null}
                      onClick={() => handleRoleChange(roleTarget, "organizer")}
                    />
                  )}
                  {roleTarget.userType !== "superadmin" && (
                    <RoleOption
                      icon={ShieldCheck}
                      label="Promouvoir superadmin"
                      hint="Accès total au panel d'administration."
                      tone="red"
                      busy={savingRole === "superadmin"}
                      disabled={savingRole !== null}
                      onClick={() => handleRoleChange(roleTarget, "superadmin")}
                    />
                  )}
                  {(roleTarget.userType === "organizer" || roleTarget.userType === "superadmin") && (
                    <RoleOption
                      icon={UserMinus}
                      label="Retirer les droits"
                      hint="Le compte perd l'espace correspondant, son rôle ne change pas."
                      tone="gray"
                      busy={savingRole === "revoke"}
                      disabled={savingRole !== null}
                      onClick={() => handleRoleChange(roleTarget, "revoke")}
                    />
                  )}
                </div>
              )}

              <button
                onClick={() => setRoleTarget(null)}
                disabled={savingRole !== null}
                className="mt-5 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
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
