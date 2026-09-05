"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, MapPin, Users, Star, ChevronLeft, Trash2, UserMinus, UserPlus, Edit3, X, Check,
  Loader2, Trophy, Calendar, Image, Dumbbell, Medal,
  ToggleLeft, ToggleRight, AlertTriangle, ClipboardList,
  Heart, Plus, Camera, UserCheck, BarChart2, ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTeamById, updateTeam, deleteTeam, removeTeamMember,
  getUsersByIds, getMatchesByTeamIds,
  onJoinRequestsByTeam, respondToJoinRequest, sendInvitation,
  updateTeamMedia, addAchievement, removeAchievement,
  addGalleryUrl, removeGalleryUrl, updateTeamLineup,
  updateTeamSquadNumbers,
  followTeam, unfollowTeam, isFollowingTeam,
  onTrainingsByTeam, createTraining, respondToTraining, deleteTraining,
  onGhostPlayersByTeam, createGhostPlayer, updateGhostPlayer, deleteGhostPlayer,
  setTeamStaff,
} from "@/lib/firestore";
import { TITRES_STAFF, estProprietaireEquipe, peutGererEquipe } from "@/lib/team-access";
import { uploadTeamLogo, uploadTeamBanner, uploadTeamGalleryImage } from "@/lib/storage";
import { avatarColor } from "@/components/feed/PostCard";
import TirsAuBut from "@/components/match/TirsAuBut";
import GhostMergeCorner from "@/components/team/GhostMergeCorner";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import type { Team, UserProfile, Match, JoinRequest, Achievement, Training, GhostPlayer, TrainingScheduleSlot, TeamStaffMember } from "@/types";

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
  beginner: "Débutant", amateur: "Amateur", intermediate: "Intermédiaire", advanced: "Avancé",
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

type ActiveTab = "apropos" | "roster" | "matches" | "stats" | "settings" | "candidatures" | "palmares" | "gallery" | "trainings";

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
    slogan: team.slogan ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(team.logoUrl ?? null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(team.bannerUrl ?? null);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Logo trop lourd (max 2 Mo)"); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Bannière trop lourde (max 5 Mo)"); return; }
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

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
        slogan: form.slogan.trim(),
      });
      const mediaUpdate: { logoUrl?: string; bannerUrl?: string } = {};
      if (logoFile) mediaUpdate.logoUrl = await uploadTeamLogo(team.id, logoFile);
      if (bannerFile) mediaUpdate.bannerUrl = await uploadTeamBanner(team.id, bannerFile);
      if (Object.keys(mediaUpdate).length > 0) await updateTeamMedia(team.id, mediaUpdate);
      onSaved();
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        /* UN MODAL QUI DÉBORDE DOIT DÉFILER. Le panneau n'avait aucune
           hauteur maximale : sur un écran court, le formulaire sortait de la
           fenêtre par les deux bouts — titre coupé en haut, « Enregistrer »
           hors d'atteinte en bas — et le fond fixe empêchait de faire défiler
           quoi que ce soit. On plafonne le panneau, l'en-tête reste en place,
           et seul le corps défile. */
        className="flex max-h-[90dvh] w-full max-w-md flex-col border border-gray-200/70 bg-white"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200/70 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">Modifier l&apos;equipe</h2>
          <button onClick={onClose} className=" p-1 text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Media uploads */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Bannière</label>
            <div className="relative h-24 w-full cursor-pointer overflow-hidden border border-gray-200/70 bg-gray-50 hover:bg-gray-100"
              onClick={() => document.getElementById("banner-input")?.click()}>
              {bannerPreview
                ? <img src={bannerPreview} className="h-full w-full object-cover" alt="" />
                : <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-400"><Camera size={16} /> Choisir une bannière</div>}
              <input id="banner-input" type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </div>
            <label className="block text-sm font-medium text-gray-700">Logo</label>
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 cursor-pointer overflow-hidden border border-gray-200/70 bg-gray-50 hover:bg-gray-100 flex-shrink-0"
                onClick={() => document.getElementById("logo-input")?.click()}>
                {logoPreview
                  ? <img src={logoPreview} className="h-full w-full object-cover" alt="" />
                  : <div className="flex h-full items-center justify-center"><Camera size={16} className="text-gray-400" /></div>}
                <input id="logo-input" type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              </div>
              <p className="text-xs text-gray-400">Carré, max 2 Mo</p>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
            <input type="text" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Slogan</label>
            <input type="text" maxLength={80} value={form.slogan}
              onChange={(e) => setForm({ ...form, slogan: e.target.value })}
              placeholder="Ex: Toujours debout !"
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
            <input type="text" required value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Niveau</label>
              <select value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value as Team["level"] })}
                className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none">
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
                className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Couleur</label>
            <div className="flex gap-2">
              {TEAM_COLORS.map((c) => (
                <button key={c.value} type="button"
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`h-8 w-8 rounded-full ${c.class} transition-all ${
                    form.color === c.value ? "ring-2 ring-offset-2 ring-gray-900 scale-110" : "opacity-60 hover:opacity-100"
                  }`} title={c.label} />
              ))}
            </div>
          </div>
          <button type="submit" disabled={submitting || !form.name.trim() || !form.city.trim()}
            className="flex w-full items-center justify-center gap-2 bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm border border-gray-200/70 bg-white p-6"
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
            className="flex flex-1 items-center justify-center gap-2 bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition-all disabled:opacity-50">
            {deleting ? <><Loader2 size={16} className="animate-spin" /> Suppression...</> : <><Trash2 size={16} /> Supprimer</>}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-gray-200/70 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Annuler
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// Add Achievement Modal
// ============================================

const ACHIEVEMENT_ICONS = [
  { value: "trophy" as const, label: "Trophée", Icon: Trophy },
  { value: "medal" as const, label: "Médaille", Icon: Medal },
  { value: "star" as const, label: "Étoile", Icon: Star },
  { value: "shield" as const, label: "Bouclier", Icon: Shield },
];

function AddAchievementModal({ teamId, onClose, onSaved }: {
  teamId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ title: "", date: "", description: "", icon: "trophy" as Achievement["icon"] });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    try {
      await addAchievement(teamId, { title: form.title.trim(), date: form.date, description: form.description.trim() || undefined, icon: form.icon });
      onSaved();
      onClose();
    } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="flex max-h-[90dvh] w-full max-w-sm flex-col border border-gray-200/70 bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200/70 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">Ajouter un trophée</h2>
          <button onClick={onClose} className=" p-1 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Champion régional 2024"
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (optionnel)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Icône</label>
            <div className="flex gap-2">
              {ACHIEVEMENT_ICONS.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => setForm({ ...form, icon: value })}
                  title={label}
                  className={`flex h-10 w-10 items-center justify-center border-2 transition-all ${form.icon === value ? "border-gray-900 bg-emerald-50 text-emerald-700" : "border-gray-200/70 text-gray-400 hover:border-gray-200/70"}`}>
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving || !form.title.trim() || !form.date}
            className="flex w-full items-center justify-center gap-2 bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Enregistrer
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Create Training Modal
// ============================================

/**
 * Le staff de l'équipe, vu et administré par le propriétaire.
 *
 * DÉLÉGUER N'EST PAS DÉCORER, et l'écran doit le dire : le titre est ce qu'on
 * montre sur la fiche, la délégation est un droit réel sur l'équipe. Deux
 * champs séparés, et une phrase sous la case, plutôt qu'un choix de « rôle »
 * dont personne ne devinerait ce qu'il ouvre.
 *
 * ON NE RECRUTE QUE DANS L'EFFECTIF, pour l'instant. Nommer quelqu'un qui
 * n'est pas dans l'équipe demande son accord — c'est un pouvoir qu'on lui
 * donne, pas une étiquette — donc une invitation, donc un aller-retour que
 * cette version n'a pas. Un coach qui ne joue pas rejoint l'effectif d'abord.
 */
function StaffBlock({ team, members, onSaved }: {
  team: Team;
  members: UserProfile[];
  onSaved: () => Promise<void> | void;
}) {
  const staff = team.staff ?? [];
  const [choix, setChoix] = useState("");
  const [titre, setTitre] = useState(TITRES_STAFF[0]);
  const [delegue, setDelegue] = useState(true);
  const [saving, setSaving] = useState(false);

  // Ni le manager (il a déjà tout), ni ceux qui y sont déjà.
  const candidats = members.filter(
    (m) => m.uid !== team.managerId && !staff.some((s) => s.uid === m.uid),
  );

  const enregistrer = async (liste: TeamStaffMember[]) => {
    setSaving(true);
    try {
      await setTeamStaff(team.id, liste);
      await onSaved();
    } catch {
      toast.error("Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const ajouter = async () => {
    const profil = candidats.find((m) => m.uid === choix);
    if (!profil || !titre.trim()) return;
    await enregistrer([
      ...staff,
      {
        uid: profil.uid,
        name: `${profil.firstName} ${profil.lastName}`.trim(),
        title: titre.trim(),
        delegated: delegue,
      },
    ]);
    setChoix("");
    toast.success(`${profil.firstName} rejoint le staff`);
  };

  const retirer = async (uid: string) => {
    await enregistrer(staff.filter((m) => m.uid !== uid));
  };

  const basculerDelegation = async (uid: string) => {
    await enregistrer(
      staff.map((m) => (m.uid === uid ? { ...m, delegated: !m.delegated } : m)),
    );
  };

  return (
    <div className="border border-gray-200/70 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-blue-500" />
        <h3 className="font-semibold text-gray-900">Staff de l&apos;équipe</h3>
      </div>
      <p className="text-sm text-gray-500">
        Un délégué gère l&apos;équipe comme toi : composition, dossards, effectif,
        candidatures, entraînements. Il ne peut ni nommer le staff, ni supprimer
        l&apos;équipe.
      </p>

      {staff.length === 0 ? (
        <p className="text-sm italic text-gray-400">Personne d&apos;autre que toi pour l&apos;instant.</p>
      ) : (
        <div className="space-y-2">
          {staff.map((m) => (
            <div key={m.uid} className="flex flex-wrap items-center gap-x-3 gap-y-2 border border-gray-200/70 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{m.name}</p>
                <p className="text-xs text-gray-500">{m.title}</p>
              </div>
              <button
                type="button"
                onClick={() => basculerDelegation(m.uid)}
                disabled={saving}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${
                  m.delegated
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {m.delegated ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                {m.delegated ? "Délégué" : "Titre seul"}
              </button>
              <button
                type="button"
                onClick={() => retirer(m.uid)}
                disabled={saving}
                className="text-red-400 transition-colors hover:text-red-600 disabled:opacity-50"
                aria-label={`Retirer ${m.name} du staff`}
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3 border-t border-gray-200/70 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Ajouter</p>
        {candidats.length === 0 ? (
          <p className="text-sm italic text-gray-400">
            Tout l&apos;effectif est déjà dans le staff, ou l&apos;équipe n&apos;a pas encore de joueurs.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="w-full border border-gray-200/70 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                value={choix}
                onChange={(e) => setChoix(e.target.value)}
              >
                <option value="">Choisir un joueur…</option>
                {candidats.map((m) => (
                  <option key={m.uid} value={m.uid}>
                    {m.firstName} {m.lastName}
                  </option>
                ))}
              </select>
              <input
                className="w-full border border-gray-200/70 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none"
                list="titres-staff"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Coach, dirigeant…"
              />
              <datalist id="titres-staff">
                {TITRES_STAFF.map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={delegue}
                onChange={(e) => setDelegue(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Lui donner les droits du manager
                <span className="block text-xs text-gray-400">
                  Sans cette case, le titre s&apos;affiche sur la fiche sans rien ouvrir.
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={ajouter}
              disabled={saving || !choix || !titre.trim()}
              className="flex items-center gap-2 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Ajouter au staff
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function CreateTrainingModal({ teamId, managerId, memberIds, onClose, onSaved }: {
  teamId: string; managerId: string; memberIds: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({ title: "", date: "", time: "", location: "", description: "" });
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time || !form.location.trim()) return;
    setSaving(true);
    try {
      await createTraining({ teamId, managerId, memberIds, title: form.title.trim(), date: form.date, time: form.time, location: form.location.trim(), description: form.description.trim() || undefined });
      onSaved();
      onClose();
    } catch { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="flex max-h-[90dvh] w-full max-w-sm flex-col border border-gray-200/70 bg-white">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200/70 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">Créer un entraînement</h2>
          <button onClick={onClose} className=" p-1 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Entraînement tactique"
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Heure</label>
              <input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Lieu</label>
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Stade municipal"
              className="w-full border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (optionnel)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full resize-none border border-gray-200/70 px-3 py-2.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900" />
          </div>
          <button type="submit" disabled={saving || !form.title.trim() || !form.date || !form.time || !form.location.trim()}
            className="flex w-full items-center justify-center gap-2 bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Créer
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Ghost Player Modal (create / edit)
// ============================================

function GhostPlayerModal({
  ghost,
  onClose,
  onSaved,
  teamId,
}: {
  ghost: GhostPlayer | null;
  onClose: () => void;
  onSaved: () => void;
  teamId: string;
}) {
  const [form, setForm] = useState({
    firstName: ghost?.firstName ?? "",
    lastName: ghost?.lastName ?? "",
    position: (ghost?.position ?? "midfielder") as GhostPlayer["position"],
    squadNumber: ghost?.squadNumber ?? "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) return;
    setSubmitting(true);
    try {
      if (ghost) {
        await updateGhostPlayer(teamId, ghost.id, form);
        toast.success("Joueur modifié");
      } else {
        await createGhostPlayer(teamId, form);
        toast.success("Joueur ajouté");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto bg-white p-6"
      >
        <h3 className="mb-4 text-lg font-bold text-gray-900">
          {ghost ? "Modifier le joueur" : "Ajouter un joueur"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Prénom</label>
              <input
                className="w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jean"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Nom</label>
              <input
                className="w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Dupont"
                required
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Poste</label>
            <select
              className="w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value as GhostPlayer["position"] })}
            >
              <option value="goalkeeper">Gardien</option>
              <option value="defender">Défenseur</option>
              <option value="midfielder">Milieu</option>
              <option value="forward">Attaquant</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Numéro de dossard (optionnel)</label>
            <input
              className="w-full border border-gray-200/70 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
              value={form.squadNumber}
              onChange={(e) => setForm({ ...form, squadNumber: e.target.value })}
              placeholder="Ex: 10"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200/70 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? "Enregistrement..." : ghost ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ============================================
// Ghost Stats Modal
// ============================================

function GhostStatsModal({
  ghost,
  onClose,
}: {
  ghost: GhostPlayer;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-sm bg-white p-6"
      >
        <h3 className="mb-1 text-lg font-bold text-gray-900">
          {ghost.firstName} {ghost.lastName}
        </h3>
        <p className="mb-5 text-xs text-gray-400">{POSITION_LABELS[ghost.position] ?? ghost.position}</p>
        {/* Un joueur sans compte de SA PROPRE équipe tient bien une carrière :
            il joue les mêmes matchs que les autres, il n'a qu'un smartphone de
            moins. Elle vit sur `ghost_players` faute de document `users`, et
            se crédite aux mêmes conditions (voir /api/matches/complete).
            L'équipe hors plateforme, elle, ne cumule toujours rien — mais sa
            fiche n'existe plus. */}
        <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
          {[
            { label: "Matchs", valeur: ghost.matchesPlayed },
            { label: "Buts", valeur: ghost.goals },
            { label: "Passes", valeur: ghost.assists },
          ].map((s) => (
            <div key={s.label} className="bg-white p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">{s.label}</p>
              <p className="mt-1 font-display text-2xl font-black tabular-nums text-gray-900">{s.valeur}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 bg-gray-50 p-3 text-xs font-semibold leading-relaxed text-gray-500">
          Ce joueur n&apos;a pas de compte KoppaFoot : sa carrière est tenue par le
          club. Le jour où il en crée un, le coin fusion de l&apos;onglet Effectif la
          lui transfère.
        </p>

        <button onClick={onClose}
          className="mt-5 w-full border border-gray-200/70 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Fermer
        </button>
      </motion.div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

/**
 * La fiche publique d'une equipe, telle que la sert /api/public/team/[id].
 * Ni `memberIds` ni `managerId` n'en font partie : ils restent vides ici, ce
 * qui fait tomber d'elles-memes les vues reservees au manager.
 */
async function fetchPublicTeam(id: string): Promise<Team | null> {
  try {
    const res = await fetch(`/api/public/team/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { team } = await res.json();
    if (!team) return null;
    return {
      id: team.id,
      name: team.name ?? "",
      city: team.city ?? null,
      description: team.description ?? null,
      slogan: team.slogan ?? null,
      logoUrl: team.logo_url ?? null,
      bannerUrl: team.banner_url ?? null,
      color: team.color ?? null,
      level: team.level ?? "amateur",
      isRecruiting: team.is_recruiting ?? false,
      maxMembers: team.max_members ?? 0,
      matchesPlayed: team.matches_played ?? 0,
      wins: team.wins ?? 0,
      draws: team.draws ?? 0,
      losses: team.losses ?? 0,
      achievements: team.achievements ?? [],
      galleryUrls: team.gallery_urls ?? [],
      isGhost: team.is_ghost ?? false,
      memberIds: [],
      managerId: "",
    } as unknown as Team;
  } catch {
    return null;
  }
}

export default function TeamDetailPage() {
  // Lu une fois au montage : ?from=mercato quand on arrive depuis le marche.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(new URLSearchParams(window.location.search).get("from"));
  }, []);

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const teamId = params.id;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("roster");

  // Lineup
  const [lineup, setLineup] = useState<string[]>([]);
  const [lineupChanged, setLineupChanged] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);

  // Squad Numbers
  const [teamSquadNumbers, setTeamSquadNumbers] = useState<Record<string, string>>({});
  const [squadNumbersChanged, setSquadNumbersChanged] = useState(false);
  const [savingSquadNumbers, setSavingSquadNumbers] = useState(false);

  // Gallery upload
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // Follow
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAchievementModal, setShowAchievementModal] = useState(false);
  const [showTrainingModal, setShowTrainingModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [leavingTeam, setLeavingTeam] = useState(false);

  // Ghost players
  const [ghostPlayers, setGhostPlayers] = useState<GhostPlayer[]>([]);
  const [showGhostModal, setShowGhostModal] = useState(false);
  const [editingGhost, setEditingGhost] = useState<GhostPlayer | null>(null);
  const [ghostStatsTarget, setGhostStatsTarget] = useState<GhostPlayer | null>(null);
  const [deletingGhostId, setDeletingGhostId] = useState<string | null>(null);

  // Training schedule
  const [scheduleForm, setScheduleForm] = useState({
    day: 1 as TrainingScheduleSlot["day"],
    time: "19:00",
    location: "",
    label: "",
  });
  const [addingSlot, setAddingSlot] = useState(false);

  // Join requests (real-time)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Photos des candidats. `player_photo` n'existe que sur les candidatures
  // récentes ; les anciennes sont relues ici pour qu'un manager voie toujours
  // le visage qu'il accepte ou refuse.
  const [candidatePhotos, setCandidatePhotos] = useState<Record<string, string | null>>({});

  // DEUX PRÉDICATS, ET LA DIFFÉRENCE COMPTE. `isTeamManager` répond « a les
  // droits du manager », propriétaire ou staff délégué, et c'est lui qui
  // ouvre toutes les surfaces de gestion. `isTeamOwner` répond « c'est son
  // équipe », et ne sert qu'aux deux gestes par lesquels on pourrait la lui
  // prendre : nommer le staff, et supprimer l'équipe. Voir lib/team-access.
  const isTeamManager = peutGererEquipe(team, user?.uid);
  const isTeamOwner = estProprietaireEquipe(team, user?.uid);
  const isTeamMember = team?.memberIds.includes(user?.uid ?? "") ?? false;

  const fetchTeam = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      // Connecte : lecture directe. Visiteur : `teams` lui est ferme par les
      // regles, donc on sert la projection publique, voir
      // /api/public/team/[id]. Elle ne porte ni effectif ni manager, donc la
      // page rend sa fiche sans les blocs qui en dependent.
      const data = user ? await getTeamById(teamId) : await fetchPublicTeam(teamId);
      setTeam(data);
      if (data && user) {
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
  }, [teamId, user]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // Une équipe hors plateforme n'a pas de fiche.
  //
  // Elle n'est pas un club qu'on gère : c'est le nom d'un adversaire, né avec
  // un amical et qui ne sert qu'à le raconter. Elle avait pourtant ici une
  // fiche complète — en-tête, onglets, effectif modifiable, suppression — soit
  // tout un espace de gestion pour quelque chose qui n'a personne derrière.
  // Elle vit désormais dans l'historique des matchs, et nulle part ailleurs.
  useEffect(() => {
    if (!team?.isGhost) return;
    router.replace("/matches");
  }, [team?.isGhost, router]);

  // Sync lineup and squad numbers from team data
  useEffect(() => {
    if (team) { 
      setLineup(team.lineupIds ?? []); 
      setLineupChanged(false); 
      setTeamSquadNumbers(team.squadNumbers ?? {});
      setSquadNumbersChanged(false);
    }
  }, [team]);

  // Entrainements : reserves aux comptes (regle Firestore `trainings`).
  // Sans cette garde, un visiteur non connecte ouvrait un listener que les
  // regles refusent, d'ou un permission-denied dans la console a chaque
  // affichage public de la page.
  useEffect(() => {
    if (!teamId || !user) return;
    const unsub = onTrainingsByTeam(teamId, setTrainings);
    return unsub;
  }, [teamId, user]);

  // Joueurs fantomes : meme chose (regle `teams/{id}/ghost_players`). Ce sont
  // des joueurs saisis a la main par le manager, pas une donnee de vitrine.
  useEffect(() => {
    if (!teamId || !user) return;
    const unsub = onGhostPlayersByTeam(teamId, setGhostPlayers);
    return unsub;
  }, [teamId, user]);

  // Check follow status
  useEffect(() => {
    if (!user || !teamId || isTeamManager) return;
    isFollowingTeam(user.uid, teamId).then(setIsFollowing);
  }, [user, teamId, isTeamManager]);

  // Real-time join requests listener (manager only)
  useEffect(() => {
    if (!teamId || !isTeamManager || !team?.managerId) return;
    const unsub = onJoinRequestsByTeam(teamId, team.managerId, (requests) => {
      // Sort: pending first, then rest
      const sorted = [...requests].sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });
      setJoinRequests(sorted);
    });
    return unsub;
  }, [teamId, isTeamManager, team?.managerId]);

  const handleFollowToggle = async () => {
    if (!user || !team) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowTeam(user.uid, team.id);
        setIsFollowing(false);
        setTeam((t) => t ? { ...t, followersCount: Math.max(0, (t.followersCount ?? 0) - 1) } : t);
      } else {
        await followTeam(user.uid, team.id);
        setIsFollowing(true);
        setTeam((t) => t ? { ...t, followersCount: (t.followersCount ?? 0) + 1 } : t);
      }
    } catch (err) {
      // The follow now round-trips to /api/follows, so it can fail on the
      // network as well as on permissions. Say so instead of leaving the
      // button silently unchanged.
      toast.error(err instanceof Error ? err.message : "Opération impossible");
    } finally { setFollowLoading(false); }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !team) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image trop lourde (max 5 Mo)"); return; }
    setUploadingGallery(true);
    try {
      const url = await uploadTeamGalleryImage(team.id, file);
      await addGalleryUrl(team.id, url);
      await fetchTeam();
      toast.success("Photo ajoutée");
    } catch { toast.error("Erreur lors de l'upload"); }
    finally { setUploadingGallery(false); e.target.value = ""; }
  };

  const handleRemoveGalleryImage = async (url: string) => {
    if (!team) return;
    try {
      await removeGalleryUrl(team.id, url);
      await fetchTeam();
    } catch { toast.error("Erreur lors de la suppression"); }
  };

  const handleLineupToggle = (uid: string) => {
    setLineup((prev) => {
      const next = prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid];
      setLineupChanged(true);
      return next;
    });
  };

  const handleSaveLineup = async () => {
    if (!team) return;
    setSavingLineup(true);
    try {
      await updateTeamLineup(team.id, lineup);
      setLineupChanged(false);
      toast.success("Composition enregistrée");
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSavingLineup(false); }
  };

  const handleSquadNumberChange = (uid: string, value: string) => {
    // Only allow numbers and max 3 chars
    const cleaned = value.replace(/\D/g, "").slice(0, 3);
    setTeamSquadNumbers(prev => ({ ...prev, [uid]: cleaned }));
    setSquadNumbersChanged(true);
  };

  const handleSaveSquadNumbers = async () => {
    if (!team) return;
    setSavingSquadNumbers(true);
    try {
      await updateTeamSquadNumbers(team.id, teamSquadNumbers);
      setSquadNumbersChanged(false);
      toast.success("Numéros de dossard enregistrés");
    } catch { toast.error("Erreur lors de la sauvegarde"); }
    finally { setSavingSquadNumbers(false); }
  };

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
      // Sortir de l'effectif, c'est sortir du staff. Sans ça, un joueur écarté
      // gardait les droits du manager sur l'équipe qui vient de le retirer —
      // le pire des oublis possibles sur cette page.
      const staff = team.staff ?? [];
      if (staff.some((m) => m.uid === memberId)) {
        await setTeamStaff(team.id, staff.filter((m) => m.uid !== memberId));
      }
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

  const candidateIdsKey = joinRequests
    .filter((r) => !r.playerPhoto)
    .map((r) => r.playerId)
    .sort()
    .join(",");

  useEffect(() => {
    const ids = candidateIdsKey ? candidateIdsKey.split(",").filter(Boolean) : [];
    if (ids.length === 0) return;
    let cancelled = false;
    getUsersByIds(ids)
      .then((users) => {
        if (cancelled) return;
        const found = new Map(users.map((u) => [u.uid, u.profilePictureUrl]));
        setCandidatePhotos(
          Object.fromEntries(ids.map((id) => [id, found.get(id) ?? null])),
        );
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [candidateIdsKey]);

  const handleAccept = async (request: JoinRequest) => {
    if (!team || !user) return;
    setRespondingId(request.id);
    setActionError(null);
    try {
      await respondToJoinRequest(request.id, true, team.id, request.playerId);
      await sendInvitation({
        senderId: user.uid,
        senderName: `${user.firstName} ${user.lastName}`,
        receiverId: request.playerId,
        receiverName: request.playerName,
        receiverPhoto: request.playerPhoto ?? candidatePhotos[request.playerId] ?? null,
        teamLogo: team.logoUrl ?? null,
        receiverCity: request.playerCity,
        receiverPosition: request.playerPosition,
        receiverLevel: request.playerLevel,
        teamId: team.id,
        teamName: team.name,
        message: `Votre candidature pour ${team.name} a été acceptée. Rejoignez-nous !`,
      });
    } catch {
      setActionError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setRespondingId(null);
    }
  };

  const handleRefuse = async (requestId: string) => {
    setRespondingId(requestId);
    setActionError(null);
    try {
      await respondToJoinRequest(requestId, false);
    } catch {
      setActionError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setRespondingId(null);
    }
  };

  const handleAddSlot = async () => {
    if (!team || !scheduleForm.location.trim()) return;
    setAddingSlot(true);
    try {
      const newSlot: TrainingScheduleSlot = {
        day: scheduleForm.day,
        time: scheduleForm.time,
        location: scheduleForm.location.trim(),
        ...(scheduleForm.label.trim() ? { label: scheduleForm.label.trim() } : {}),
      };
      const updated = [...(team.trainingSchedule ?? []), newSlot];
      await updateTeam(team.id, { training_schedule: updated });
      setScheduleForm({ day: 1, time: "19:00", location: "", label: "" });
      toast.success("Créneau ajouté");
      await fetchTeam();
    } catch {
      toast.error("Erreur lors de l'ajout");
    } finally {
      setAddingSlot(false);
    }
  };

  const handleRemoveSlot = async (index: number) => {
    if (!team) return;
    const updated = (team.trainingSchedule ?? []).filter((_, i) => i !== index);
    try {
      await updateTeam(team.id, { training_schedule: updated });
      toast.success("Créneau supprimé");
      await fetchTeam();
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  // Plus de garde sur le compte : la fiche d'une equipe est publique. Ce qui
  // demande un compte (parametres, candidatures, gestion d'effectif) est deja
  // conditionne a `isTeamManager`, qui est faux sans compte.


  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse bg-gray-200" />
          <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        </div>
        <div className=" border border-gray-200/70 bg-white">
          <div className="h-2 animate-pulse bg-gray-200" />
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 animate-pulse bg-gray-200" />
              <div className="space-y-2">
                <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse bg-gray-100" />
              ))}
            </div>
          </div>
        </div>
        <div className=" border border-gray-200/70 bg-white p-6">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse bg-gray-100" />
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
        <h2 className="mt-4 font-display text-2xl font-black tracking-tight text-gray-900">Équipe introuvable</h2>
        <p className="mt-2 text-sm text-gray-500">Cette equipe n&apos;existe pas ou a ete supprimee</p>
        <Link href="/teams"
          className="mt-6 inline-flex items-center gap-2 bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-all">
          <ChevronLeft size={15} /> Retour aux équipes
        </Link>
      </div>
    );
  }

  // Fil d'ariane plutot qu'un retour devine. « Mes equipes » etait code en
  // dur comme destination par defaut : un visiteur venu du Direct, d'une
  // competition ou de la recherche se voyait proposer une liste qui n'est pas
  // la sienne et ou cette equipe ne figure meme pas, puisqu'il n'en est pas
  // membre. Le fil dit ou l'on est ; on n'a plus a deviner d'ou l'on vient.
  //
  // Le seul cas ou une origine reste utile est le mercato, qui marque son
  // passage avec ?from=mercato, et un membre, pour qui « Mes equipes » est
  // reellement le rayon dont cette equipe fait partie.
  const trail: { href: string; label: string }[] =
    origin === "mercato" ? [{ href: "/mercato", label: "Mercato" }]
    : isTeamManager || isTeamMember ? [{ href: "/teams", label: "Mes équipes" }]
    : [{ href: "/", label: "Direct" }];

  const colors = COLOR_MAP[team.color] ?? COLOR_MAP.emerald;
  const winRate = team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0;
  // « live » et « delayed » comptent parmi les matchs à venir : un match en
  // cours disparaissait de la fiche de son équipe, qui est justement l'endroit
  // où on va le chercher ce jour-là.
  const upcomingMatches = matches.filter(
    (m) => m.status === "upcoming" || m.status === "live" || m.status === "delayed",
  );
  const completedMatches = matches.filter((m) => m.status === "completed");
  // Ce que la fiche montre, et rien de plus : un défi pas encore accepté, un
  // brouillon, un match en attente de quota ou annulé ne regardent que le
  // manager — ils vivent dans l'onglet Matchs, pas sur la vitrine publique de
  // l'équipe. Sert au badge de l'onglet et à l'état vide, qui comptaient tous
  // les statuts et pouvaient annoncer des matchs qu'on ne voyait ensuite
  // jamais.
  const visibleMatchCount = upcomingMatches.length + completedMatches.length;
  /**
   * LES DOSSARDS DES COMPTES L'EMPORTENT SUR CEUX DES JOUEURS SANS COMPTE.
   *
   * Les deux moitiés de l'effectif se numérotent séparément — les comptes dans
   * `team.squad_numbers`, les autres sur leur fiche — et rien ne les
   * confrontait : le même numéro pouvait s'afficher deux fois dans une même
   * liste, sans qu'on sache lequel des deux le porte vraiment. On tranche du
   * côté du compte, qui porte une carrière et des statistiques, comme le fait
   * déjà la feuille de match (voir updateMatchLineup).
   */
  const dossardsDesComptes = new Set(
    Object.values(teamSquadNumbers).map((n) => n?.trim()).filter(Boolean),
  );
  const pendingCount = joinRequests.filter((r) => r.status === "pending").length;
  // Squad size = accounts on the roster + ghost players. The manager is not
  // in member_ids (createTeam starts it empty), so this is the real count,
  // memberIds alone silently dropped every player without a smartphone.
  const squadCount = team.memberIds.length + ghostPlayers.length;

  // ------------------------------------------------------------------
  // Le bilan détaillé, calculé depuis les matchs plutôt que stocké.
  //
  // `teams` ne porte que victoires/nuls/défaites. Tout le reste — les buts, la
  // forme, les matchs sans encaisser — se lit sur les rencontres terminées, que
  // cette page charge déjà. Ajouter des compteurs en base aurait signifié les
  // tenir à jour à chaque clôture, à chaque correction de score et à chaque
  // suppression de match : trois occasions de dériver pour une addition.
  const matchsTermines = matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const bilan = matchsTermines.reduce(
    (acc, m) => {
      const nous = m.homeTeamId === teamId ? m.scoreHome : m.scoreAway;
      const eux = m.homeTeamId === teamId ? m.scoreAway : m.scoreHome;
      if (nous == null || eux == null) return acc;
      acc.pour += nous;
      acc.contre += eux;
      if (eux === 0) acc.sansEncaisser += 1;
      acc.comptes += 1;
      return acc;
    },
    { pour: 0, contre: 0, sansEncaisser: 0, comptes: 0 },
  );

  /** Les cinq derniers résultats, du plus récent au plus ancien. */
  const forme = matchsTermines.slice(0, 5).map((m) => {
    const nous = m.homeTeamId === teamId ? m.scoreHome : m.scoreAway;
    const eux = m.homeTeamId === teamId ? m.scoreAway : m.scoreHome;
    if (nous == null || eux == null) return "?" as const;
    return nous > eux ? ("V" as const) : nous < eux ? ("D" as const) : ("N" as const);
  });

  /**
   * Le classement interne, comptes ET joueurs sans compte confondus.
   *
   * Les seconds ne sont pas des sous-joueurs : ils tiennent la même carrière,
   * sur `ghost_players` faute de document `users`. Les séparer en deux
   * classements aurait fait deux moitiés d'équipe.
   */
  const classementInterne = [
    ...members.map((m) => ({
      id: m.uid,
      nom: `${m.firstName} ${m.lastName}`.trim(),
      buts: m.goals ?? 0,
      passes: m.assists ?? 0,
      sansCompte: false,
    })),
    ...ghostPlayers.map((g) => ({
      id: g.id,
      nom: `${g.firstName} ${g.lastName}`.trim(),
      buts: g.goals,
      passes: g.assists,
      sansCompte: true,
    })),
  ];
  const meilleurButeur = [...classementInterne].sort((a, b) => b.buts - a.buts)[0];
  const meilleurPasseur = [...classementInterne].sort((a, b) => b.passes - a.passes)[0];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Fil d'ariane : ou l'on est, sans supposer d'ou l'on vient. */}
      <nav
        aria-label="Fil d'ariane"
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        {trail.map((step) => (
          <span key={step.href} className="flex items-center gap-2">
            <Link href={step.href} className="transition-colors hover:text-emerald-700">
              {step.label}
            </Link>
            <span aria-hidden className="text-gray-300">›</span>
          </span>
        ))}
        <span className="truncate text-gray-600">{team.name}</span>
      </nav>

      {/* Team header card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="group relative overflow-hidden border border-gray-200/70 bg-white"
      >
        {/* Banner with gradient overlay */}
        <div className="relative h-40 w-full overflow-hidden sm:h-72">
          {team.bannerUrl ? (
            <img src={team.bannerUrl} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          ) : (
            <div className={`h-full w-full ${colors.bg} opacity-50`} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Top Actions overlay */}
          <div className="absolute right-4 top-4 flex gap-2">
             {!isTeamManager && (
                <button onClick={handleFollowToggle} disabled={followLoading}
                  className={`flex items-center gap-1.5 rounded-full backdrop-blur-md px-4 py-2 text-xs font-bold transition-all ${
                    isFollowing 
                      ? "bg-emerald-500/90 text-white" 
                      : "bg-white/90 text-gray-900 hover:bg-white"
                  }`}>
                  <Heart size={14} className={isFollowing ? "fill-current" : ""} />
                  {isFollowing ? "Suivi" : "Suivre"}
                </button>
              )}
              {isTeamManager && (
                <button onClick={() => setShowEditModal(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900 backdrop-blur-md transition-all hover:bg-white">
                  <Edit3 size={16} />
                </button>
              )}
          </div>

          {/* Bottom Header Info (Glassmorphism Effect) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <div className="flex items-end gap-5">
              <div className="relative shrink-0">
                {/* Pas de fond derrière un vrai écusson : beaucoup de logos sont des PNG transparents, et la plaque se voyait au travers. Le liseré blanc reste : il
                    détache l'écusson de la bannière, quelle qu'elle soit. */}
                <div className={`flex h-16 w-16 items-center justify-center overflow-hidden border-4 border-white sm:h-24 sm:w-24 ${team.logoUrl ? "bg-white" : colors.bg}`}>
                  {team.logoUrl
                    ? <img src={team.logoUrl} alt="" className="h-full w-full object-contain" />
                    : <Shield size={40} className={colors.icon} />}
                </div>
                {team.isRecruiting && (
                  <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                    <UserPlus size={12} />
                  </div>
                )}
              </div>
              <div className="mb-1 flex-1 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight sm:text-3xl font-display uppercase">{team.name}</h1>
                  {(
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                      team.level === "advanced" ? "bg-red-500/80" :
                      team.level === "intermediate" ? "bg-amber-500/80" :
                      "bg-blue-500/80"
                    }`}>
                      {LEVEL_LABELS[team.level] ?? team.level}
                    </span>
                  )}
                </div>
                {team.slogan && <p className="mt-1 text-sm font-medium opacity-90 italic">«&nbsp;{team.slogan}&nbsp;»</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold opacity-80 sm:gap-4">
                  {team.city && (
                    <span className="flex items-center gap-1.5"><MapPin size={14} className="text-gray-400" /> {team.city}</span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <Users size={14} className="text-blue-400" />
                    {`${squadCount}/${team.maxMembers} joueurs`}
                  </span>
                  <span className="flex items-center gap-1.5"><Heart size={14} className="text-red-400" /> {team.followersCount ?? 0} abonnés</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* LE « À PROPOS » A SUIVI LES CHIFFRES DANS UN ONGLET.
            Il occupait le bas de la carte d'identité pour une phrase qu'on lit
            une fois — celle du jour où l'on découvre le club — et qu'on
            traverse à chaque visite ensuite. La carte n'a plus de pied : la
            bannière reprend la hauteur ainsi libérée. */}
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex overflow-x-auto border-b border-gray-200/70 scrollbar-hide"
      >
        {/* DES TITRES, SANS ICÔNE. Une horloge à côté de « Entraînements » ou
            une coupe à côté de « Palmarès » ne disent rien que le mot ne dise
            déjà, et prennent la place qui manque à une rangée qui défile —
            huit onglets sur 375 pixels.

            « À propos » ouvre la liste : il porte l'identité du club, qui
            vivait jusqu'ici en haut de page. L'onglet ouvert par défaut reste
            l'effectif, qui est ce qu'on vient voir. */}
        {[
          { id: "apropos", label: "À propos", count: 0 },
          { id: "roster", label: "Effectif", count: members.length },
          { id: "matches", label: "Matchs", count: visibleMatchCount },
          { id: "stats", label: "Stats", count: 0 },
          { id: "trainings", label: "Entraînements", count: 0 },
          { id: "palmares", label: "Palmarès", count: (team.achievements ?? []).length },
          { id: "gallery", label: "Galerie", count: (team.galleryUrls ?? []).length },
          ...(isTeamManager ? [{ id: "candidatures", label: "Candidatures", count: pendingCount, isBadge: true }] : []),
          ...(isTeamManager ? [{ id: "settings", label: "Paramètres", count: 0 }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 text-xs sm:text-sm sm:gap-2 sm:pr-6 sm:px-0 font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? "border-gray-900 text-emerald-700" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                "isBadge" in tab && tab.isBadge
                  ? "bg-red-100 text-red-600"
                  : activeTab === tab.id
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-100 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ===================== ONGLET : À PROPOS ===================== */}
      {activeTab === "apropos" && (
        <div className="mt-5 border border-gray-200/70 bg-white p-5 sm:p-6">
          {team.description ? (
            <>
              <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">
                À propos
              </h3>
              <p className="mt-3 text-sm italic leading-relaxed text-gray-600">
                &ldquo;{team.description}&rdquo;
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              {isTeamManager
                ? "Cette équipe n'a pas encore de présentation. Ajoutez-en une dans les paramètres."
                : "Cette équipe n'a pas encore de présentation."}
            </p>
          )}
        </div>
      )}

      {/* ===================== TAB: ROSTER ===================== */}
      {activeTab === "roster" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
          {/* Manager block */}
          {(() => {
            const manager = members.find((m) => m.uid === team.managerId);
            if (!manager) return null;
            const initials = `${manager.firstName[0] ?? ""}${manager.lastName[0] ?? ""}`;
            return (
              <div className="flex items-center gap-3 border border-blue-100 bg-blue-50/60 p-3 sm:p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${manager.firstName} ${manager.lastName}`)}`}>
                  {manager.profilePictureUrl ? <img src={manager.profilePictureUrl} alt="" className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {/* Le dossard, lisible par TOUT LE MONDE. Il n'existait
                        que dans le champ de saisie du manager : un visiteur
                        lisait donc un effectif sans numéros, alors que c'est
                        par son numéro qu'on reconnaît un joueur sur le
                        terrain — et que les joueurs sans compte, eux,
                        affichaient déjà le leur. */}
                    {teamSquadNumbers[manager.uid]?.trim() && (
                      <span className="border border-blue-200 bg-white px-1.5 py-0.5 text-xs font-black tabular-nums text-blue-700">
                        N°{teamSquadNumbers[manager.uid].trim()}
                      </span>
                    )}
                    <span className="font-semibold text-gray-900 truncate">{manager.firstName} {manager.lastName}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Manager</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 truncate"><MapPin size={11} className="shrink-0" /> {manager.locationCity}</div>
                </div>
                {isTeamManager && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-gray-400">N°</span>
                    <input
                      type="text"
                      className="h-9 w-11 sm:w-12 border border-gray-200/70 bg-white text-center text-sm font-black text-gray-900 focus:border-blue-300 focus:ring-0"
                      value={teamSquadNumbers[manager.uid] || ""}
                      onChange={(e) => handleSquadNumberChange(manager.uid, e.target.value)}
                      placeholder="N°"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Le staff, sous le manager : la même information, qui tient
              l'équipe. Le nom vient du document (recopié à l'ajout), ce bloc
              ne coûte donc aucune lecture de profil.
              Visible des comptes connectés seulement : la projection publique
              ne porte ni effectif ni manager, exprès (voir
              /api/public/team/[id]), et un staff est une liste de personnes
              rattachées à des comptes comme une autre. */}
          {(team.staff ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2 border border-gray-200/70 bg-gray-50/60 p-3 sm:p-4">
              {(team.staff ?? []).map((m) => (
                <span
                  key={m.uid}
                  className="flex items-center gap-1.5 border border-gray-200/70 bg-white px-2.5 py-1.5"
                >
                  {m.delegated && <ShieldCheck size={13} className="shrink-0 text-blue-500" />}
                  <span className="text-sm font-semibold text-gray-900">{m.name}</span>
                  <span className="text-xs text-gray-500">{m.title}</span>
                </span>
              ))}
            </div>
          )}

          {/* Player list (excluding manager) */}
          {isTeamManager && (lineupChanged || squadNumbersChanged) && (
            <div className="flex items-center justify-between border border-emerald-200 bg-emerald-50 px-4 py-2.5">
              <span className="text-sm text-emerald-700">Modification(s) en attente</span>
              <div className="flex gap-2">
                {lineupChanged && (
                  <button onClick={handleSaveLineup} disabled={savingLineup}
                    className="flex items-center gap-1 bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                    {savingLineup ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Composition
                  </button>
                )}
                {squadNumbersChanged && (
                  <button onClick={handleSaveSquadNumbers} disabled={savingSquadNumbers}
                    className="flex items-center gap-1 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                    {savingSquadNumbers ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Dossards
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Unified list: real members (excl. manager) + ghost players */}
          {(() => {
            const realPlayers = members.filter((m) => m.uid !== team.managerId);
            const totalCount = realPlayers.length + ghostPlayers.length;

            if (totalCount === 0) {
              return (
                <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12">
                  <Users size={32} className="text-gray-300" />
                  <p className="mt-3 text-sm text-gray-500">Aucun joueur dans l&apos;équipe</p>
                </div>
              );
            }

            return (
              <AnimatePresence mode="popLayout">
                {/* Real players */}
                {realPlayers.map((member, i) => {
                  const pos = member.position ?? "";
                  const initials = `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`;
                  const isStarter = lineup.includes(member.uid);
                  return (
                    <motion.div key={member.uid} layout
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -60, height: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}
                      className="flex flex-col gap-3 border border-gray-200/70 bg-white p-3 transition-shadow sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="flex items-center gap-3">
                        {isTeamManager && (
                          <button onClick={() => handleLineupToggle(member.uid)}
                            title={isStarter ? "Retirer des titulaires" : "Ajouter aux titulaires"}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isStarter ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200/70 text-transparent hover:border-gray-900"}`}>
                            <UserCheck size={12} />
                          </button>
                        )}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${member.firstName} ${member.lastName}`)}`}>
                          {member.profilePictureUrl ? <img src={member.profilePictureUrl} alt="" className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Voir le bloc du manager : le numéro se lit sans
                                compte, il ne vivait que dans le champ de
                                saisie réservé au manager. */}
                            {teamSquadNumbers[member.uid]?.trim() && (
                              <span className="border border-gray-200/70 bg-gray-50 px-1.5 py-0.5 text-xs font-black tabular-nums text-gray-700">
                                N°{teamSquadNumbers[member.uid].trim()}
                              </span>
                            )}
                            <Link href={`/profile/${member.uid}`} className="font-semibold text-gray-900 hover:text-emerald-700 transition-colors">
                              {member.firstName} {member.lastName}
                            </Link>
                            {isStarter && <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Titulaire</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin size={11} /> {member.locationCity}
                            {pos && <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-600"}`}>{POSITION_LABELS[pos] ?? pos}</span>}
                          </div>
                        </div>
                      </div>
                      {isTeamManager && (
                        <div className="flex items-center gap-3 border-t border-gray-200/70 pt-2 sm:border-t-0 sm:pt-0 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2 sm:border-r sm:border-gray-200/70 sm:pr-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">N°</span>
                            <input
                              type="text"
                              className="h-8 w-11 border border-gray-200/70 bg-gray-50/50 text-center text-sm font-black text-gray-900 focus:border-gray-900 focus:bg-white focus:ring-0 transition-all sm:h-9 sm:w-12"
                              value={teamSquadNumbers[member.uid] || ""}
                              onChange={(e) => handleSquadNumberChange(member.uid, e.target.value)}
                              placeholder=","
                            />
                          </div>
                          <button onClick={() => handleRemoveMember(member.uid)} disabled={removingMember === member.uid}
                            className="flex items-center gap-1 border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                            {removingMember === member.uid ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />} Retirer
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* Ghost players */}
                {ghostPlayers.map((ghost, i) => {
                  const initials = `${ghost.firstName[0] ?? ""}${ghost.lastName[0] ?? ""}`;
                  return (
                    <motion.div key={`ghost-${ghost.id}`} layout
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -60, height: 0 }} transition={{ duration: 0.3, delay: (realPlayers.length + i) * 0.05 }}
                      className="flex flex-col gap-3 border border-gray-200/70 bg-white p-3 transition-shadow sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${ghost.firstName} ${ghost.lastName}`)}`}>
                          {initials}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{ghost.firstName} {ghost.lastName}</h4>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            {/* Le numéro d'un joueur sans compte s'efface
                                quand un compte le porte déjà : voir
                                dossardsDesComptes. Le manager, lui, lit
                                pourquoi, et peut en donner un autre. */}
                            {ghost.squadNumber?.trim() && (
                              dossardsDesComptes.has(ghost.squadNumber.trim()) ? (
                                isTeamManager && (
                                  <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-amber-700">
                                    N°{ghost.squadNumber.trim()} déjà pris
                                  </span>
                                )
                              ) : (
                                <span className="border border-gray-200/70 bg-gray-50 px-1.5 py-0.5 text-xs font-black tabular-nums text-gray-700">
                                  N°{ghost.squadNumber.trim()}
                                </span>
                              )
                            )}
                            <span className={` px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[ghost.position] ?? "bg-gray-100 text-gray-600"}`}>
                              {POSITION_LABELS[ghost.position] ?? ghost.position}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isTeamManager && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 border-t border-gray-200/70 pt-2 sm:border-t-0 sm:pt-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => setGhostStatsTarget(ghost)}
                            className="flex items-center gap-1 border border-gray-200/70 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <BarChart2 size={12} /> <span>Stats</span>
                          </button>
                          <button
                            onClick={() => { setEditingGhost(ghost); setShowGhostModal(true); }}
                            className="flex items-center gap-1 border border-gray-200/70 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <Edit3 size={12} /> <span>Modifier</span>
                          </button>
                          <button
                            onClick={async () => {
                              setDeletingGhostId(ghost.id);
                              try {
                                await deleteGhostPlayer(teamId, ghost.id);
                                toast.success("Joueur supprimé");
                              } catch {
                                toast.error("Erreur lors de la suppression");
                              } finally {
                                setDeletingGhostId(null);
                              }
                            }}
                            disabled={deletingGhostId === ghost.id}
                            className="flex items-center gap-1 border border-red-200 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                            {deletingGhostId === ghost.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} <span>Supprimer</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            );
          })()}
          {/* Le coin fusion : quand un joueur sans compte finit par en créer un,
              il repartait de zéro pendant que son double gardait tout son
              passé. Ne s'affiche que s'il y a des deux côtés de quoi
              rapprocher. */}
          {isTeamManager && (
            <GhostMergeCorner
              teamId={team.id}
              ghostPlayers={ghostPlayers}
              members={members}
              onMerged={fetchTeam}
            />
          )}

          {isTeamManager && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingGhost(null); setShowGhostModal(true); }}
                className="flex flex-1 items-center justify-center gap-2 border border-gray-200/70 bg-white py-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Plus size={16} /> Ajouter un joueur
              </button>
              {/* Recruter ouvre le mercato côté manager, sur l'onglet joueurs. */}
              <Link
                href="/mercato?tab=players"
                className="flex flex-1 items-center justify-center gap-2 bg-emerald-500 py-4 text-sm font-bold text-white transition-colors hover:bg-emerald-600"
              >
                <UserPlus size={16} /> Recruter
              </Link>
            </div>
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
                  className=" border border-gray-200/70 bg-white p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 font-display text-sm sm:text-base">
                        {match.homeTeamName} vs {match.awayTeamName}
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Calendar size={12} /> {match.date} à {match.time}</span>
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
                  className=" border border-gray-200/70 bg-white p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-gray-900 font-display text-sm sm:text-base">
                        {match.homeTeamName} {match.scoreHome ?? "?"} - {match.scoreAway ?? "?"} {match.awayTeamName}
                        <TirsAuBut home={match.penaltyHome} away={match.penaltyAway} className="ml-2 align-middle" />
                      </h4>
                      <div className="mt-1 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
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

          {visibleMatchCount === 0 && (
            <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12">
              <Trophy size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun match programme</p>
              {/* Ce bouton est resté « bientôt » et grisé alors que le parcours
                  de création existe : le manager arrivait sur l'onglet Matchs de
                  sa propre équipe et n'avait aucun moyen d'en programmer un. */}
              {isTeamManager && (
                <Link
                  href="/matches"
                  className="mt-4 inline-flex items-center gap-2 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  <Calendar size={14} /> Programmer un match
                </Link>
              )}
            </div>
          )}

          {/* CTA for manager */}
          {isTeamManager && visibleMatchCount > 0 && (
            <Link
              href="/matches"
              className="flex items-center justify-center gap-2 border border-gray-200/70 bg-white py-4 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              <Calendar size={16} /> Programmer un match
            </Link>
          )}
        </motion.div>
      )}

      {/* ===================== TAB: PALMARES ===================== */}
      {activeTab === "stats" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Le bilan, en toutes lettres. « Win Rate » est devenu « Ratio de
              victoires » : le tableau de bord d'un club de Lome n'a pas de
              raison de parler anglais. */}
          <div className="grid grid-cols-2 gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-4">
            {[
              { label: "Effectif", value: squadCount, tone: "text-gray-900" },
              { label: "Victoires", value: team.wins, tone: "text-emerald-700" },
              { label: "Nuls", value: team.draws, tone: "text-gray-900" },
              { label: "Défaites", value: team.losses, tone: "text-red-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white p-5">
                <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">{s.label}</p>
                <p className={`mt-2 font-display text-3xl font-black tabular-nums ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
            <div className="bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Matchs joués</p>
              <p className="mt-2 font-display text-3xl font-black tabular-nums text-gray-900">{team.matchesPlayed}</p>
            </div>
            <div className="bg-white p-5">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Ratio de victoires</p>
              <p className="mt-2 font-display text-3xl font-black tabular-nums text-gray-900">
                {team.matchesPlayed > 0 ? `${winRate}%` : ","}
              </p>
            </div>
          </div>

          {/* Buts, forme et clean sheets : tout se lit sur les matchs terminés
              dont on connaît le score. Un match clôturé sans score ne compte
              nulle part plutôt que de compter pour zéro. */}
          {bilan.comptes > 0 && (
            <>
              <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
                <div className="bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Buts marqués</p>
                  <p className="mt-2 font-display text-3xl font-black tabular-nums text-emerald-700">{bilan.pour}</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Encaissés</p>
                  <p className="mt-2 font-display text-3xl font-black tabular-nums text-red-600">{bilan.contre}</p>
                </div>
                <div className="bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Différence</p>
                  <p className={`mt-2 font-display text-3xl font-black tabular-nums ${
                    bilan.pour - bilan.contre > 0 ? "text-emerald-700"
                    : bilan.pour - bilan.contre < 0 ? "text-red-600" : "text-gray-900"
                  }`}>
                    {bilan.pour - bilan.contre > 0 ? "+" : ""}{bilan.pour - bilan.contre}
                  </p>
                </div>
              </div>

              <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
                <div className="bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Forme récente</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    {forme.map((r, i) => (
                      <span
                        key={i}
                        title={r === "V" ? "Victoire" : r === "D" ? "Défaite" : r === "N" ? "Nul" : "Score inconnu"}
                        className={`flex h-8 w-8 items-center justify-center font-display text-sm font-black ${
                          r === "V" ? "bg-emerald-100 text-emerald-700"
                          : r === "D" ? "bg-red-100 text-red-600"
                          : r === "N" ? "bg-gray-100 text-gray-600"
                          : "bg-gray-50 text-gray-300"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                    <span className="ml-1 text-[11px] font-bold text-gray-400">
                      du plus récent
                    </span>
                  </div>
                </div>
                <div className="bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">Matchs sans encaisser</p>
                  <p className="mt-2 font-display text-3xl font-black tabular-nums text-gray-900">
                    {bilan.sansEncaisser}
                    <span className="ml-2 text-base font-bold text-gray-400">
                      / {bilan.comptes} · {Math.round((bilan.sansEncaisser / bilan.comptes) * 100)}%
                    </span>
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Le classement interne. Les joueurs sans compte y figurent comme les
              autres : ils tiennent la même carrière, ailleurs. */}
          {(meilleurButeur?.buts > 0 || meilleurPasseur?.passes > 0) && (
            <div className="grid gap-px border border-gray-200/70 bg-gray-200/70 sm:grid-cols-2">
              {[
                { label: "Meilleur buteur", j: meilleurButeur, valeur: meilleurButeur?.buts ?? 0, unite: "but" },
                { label: "Meilleur passeur", j: meilleurPasseur, valeur: meilleurPasseur?.passes ?? 0, unite: "passe" },
              ].map((bloc) => (
                <div key={bloc.label} className="bg-white p-5">
                  <p className="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">{bloc.label}</p>
                  {bloc.valeur > 0 ? (
                    <>
                      <p className="mt-2 truncate font-display text-xl font-black text-gray-900">{bloc.j.nom}</p>
                      <p className="mt-0.5 text-sm font-bold text-gray-500">
                        {bloc.valeur} {bloc.unite}{bloc.valeur > 1 ? "s" : ""}
                        {bloc.j.sansCompte && (
                          <span className="ml-2 text-[10px] font-black uppercase tracking-wide text-gray-400">
                            sans compte
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm font-bold text-gray-300 italic">Personne encore</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Un ratio calcule sur zero match affiche 0% et se lit comme une
              equipe qui perd tout. Mieux vaut le dire. */}
          {team.matchesPlayed === 0 && (
            <p className="border border-gray-200/70 bg-white px-6 py-12 text-center text-base font-bold text-gray-400">
              Aucun match joué pour l&apos;instant, le bilan viendra avec.
            </p>
          )}
        </motion.div>
      )}

      {activeTab === "palmares" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
          {(team.achievements ?? []).length > 0 ? (
            (team.achievements ?? []).map((ach, i) => {
              const AchIcon = ACHIEVEMENT_ICONS.find((a) => a.value === ach.icon)?.Icon ?? Trophy;
              return (
                <motion.div key={ach.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 border border-gray-200/70 bg-white p-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center ${colors.bg}`}>
                    <AchIcon size={24} className={colors.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{ach.title}</p>
                    <p className="text-xs text-gray-400">{new Date(ach.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
                    {ach.description && <p className="mt-0.5 text-sm text-gray-500">{ach.description}</p>}
                  </div>
                  {isTeamManager && (
                    <button onClick={async () => { await removeAchievement(team.id, ach.id); await fetchTeam(); }}
                      className="shrink-0 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12">
              <Trophy size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun trophée pour le moment</p>
            </div>
          )}
          {isTeamManager && (
            <button onClick={() => setShowAchievementModal(true)}
              className="flex w-full items-center justify-center gap-2 border border-gray-200/70 border-emerald-200 bg-emerald-50/50 py-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
              <Plus size={16} /> Ajouter un trophée
            </button>
          )}
        </motion.div>
      )}

      {/* ===================== TAB: GALLERY ===================== */}
      {activeTab === "gallery" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
          {(team.galleryUrls ?? []).length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(team.galleryUrls ?? []).map((url, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden">
                  <img src={url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  {isTeamManager && (
                    <button onClick={() => handleRemoveGalleryImage(url)}
                      className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600">
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12">
              <Image size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucune photo pour le moment</p>
            </div>
          )}
          {isTeamManager && (
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 border border-gray-200/70 border-emerald-200 bg-emerald-50/50 py-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
              {uploadingGallery ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Ajouter une photo</>}
              <input type="file" accept="image/*" className="hidden" onChange={handleGalleryUpload} disabled={uploadingGallery} />
            </label>
          )}
        </motion.div>
      )}

      {/* ===================== TAB: TRAININGS ===================== */}
      {activeTab === "trainings" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
          {trainings.length > 0 ? trainings.map((training, i) => {
            const myAttendee = training.attendees.find((a) => a.player_id === user?.uid);
            const confirmedCount = training.attendees.filter((a) => a.status === "confirmed").length;
            return (
              <motion.div key={training.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className=" border border-gray-200/70 bg-white p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{training.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(training.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à {training.time}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} /> {training.location}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {confirmedCount}/{training.attendees.length} confirmés</span>
                    </div>
                    {training.description && <p className="mt-2 text-sm text-gray-500">{training.description}</p>}
                  </div>
                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    {/* Player response */}
                    {myAttendee && myAttendee.status === "pending" && (
                      <>
                        <button onClick={() => respondToTraining(training.id, user!.uid, "confirmed").then(() => toast.success("Présence confirmée"))}
                          className="flex items-center gap-1 bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                          <Check size={12} /> Présent
                        </button>
                        <button onClick={() => respondToTraining(training.id, user!.uid, "declined").then(() => toast.success("Absence signalée"))}
                          className="flex items-center gap-1 border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                          <X size={12} /> Absent
                        </button>
                      </>
                    )}
                    {myAttendee && myAttendee.status !== "pending" && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${myAttendee.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {myAttendee.status === "confirmed" ? "Présent" : "Absent"}
                      </span>
                    )}
                    {isTeamManager && (
                      <button onClick={() => deleteTraining(training.id).then(() => toast.success("Entraînement supprimé"))}
                        className=" p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          }) : (
            <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12">
              <Dumbbell size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun entraînement programmé</p>
            </div>
          )}
          {isTeamManager && (
            <button onClick={() => setShowTrainingModal(true)}
              className="flex w-full items-center justify-center gap-2 border border-gray-200/70 border-emerald-200 bg-emerald-50/50 py-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors">
              <Plus size={16} /> Créer un entraînement
            </button>
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
                className=" border border-gray-200/70 bg-white p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <PlayerAvatar
                      name={request.playerName}
                      photo={request.playerPhoto ?? candidatePhotos[request.playerId] ?? null}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-gray-900">{request.playerName}</span>
                      <span className="text-gray-400">,</span>
                      <span className="text-sm text-gray-600">{request.playerCity}</span>
                      {request.playerPosition && (
                        <>
                          <span className="text-gray-400">,</span>
                          <span className="text-sm text-gray-600">{request.playerPosition}</span>
                        </>
                      )}
                      {request.playerLevel && (
                        <>
                          <span className="text-gray-400">,</span>
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
                  </div>

                  {/* Status badge or action buttons */}
                  {request.status === "pending" ? (
                    <div className="flex flex-wrap shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleAccept(request)}
                        disabled={respondingId === request.id}
                        className="flex items-center gap-1 bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
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
                        className="flex items-center gap-1 border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
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
            <div className="flex flex-col items-center border border-gray-200/70 bg-white py-12">
              <ClipboardList size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucune candidature pour le moment</p>
            </div>
          )}

          {/* Error feedback */}
          {actionError && (
            <div className=" border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
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
          <div className=" border border-gray-200/70 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900">Statut de recrutement</h3>
                <p className="mt-0.5 text-sm text-gray-500">
                  {team.isRecruiting ? "L'equipe apparait dans les resultats de recherche" : "L'equipe n'est pas visible pour les joueurs"}
                </p>
              </div>
              <button onClick={handleToggleRecruiting}
                className={`flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                  team.isRecruiting
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {team.isRecruiting ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                {team.isRecruiting ? "Actif" : "Inactif"}
              </button>
            </div>
          </div>

          {/* Training schedule */}
          <div className=" border border-gray-200/70 bg-white p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Dumbbell size={16} className="text-violet-500" />
              <h3 className="font-semibold text-gray-900">Planning d&apos;entraînement</h3>
            </div>

            {/* Existing slots */}
            {(team.trainingSchedule ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 italic">Aucun créneau configuré</p>
            ) : (
              <div className="space-y-2">
                {(team.trainingSchedule ?? []).map((slot, i) => (
                  <div key={i} className="flex items-center justify-between bg-violet-50 px-3 py-2">
                    <div className="text-sm">
                      <span className="font-semibold text-violet-900">
                        {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][slot.day]} {slot.time}
                      </span>
                      <span className="ml-2 text-violet-700">{slot.location}</span>
                      {slot.label && <span className="ml-2 text-violet-500 text-xs">· {slot.label}</span>}
                    </div>
                    <button
                      onClick={() => handleRemoveSlot(i)}
                      className="ml-3 flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add slot form */}
            <div className="space-y-3 border-t border-gray-200/70 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajouter un créneau</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Jour</label>
                  <select
                    className="w-full border border-gray-200/70 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                    value={scheduleForm.day}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, day: Number(e.target.value) as TrainingScheduleSlot["day"] })}
                  >
                    <option value={1}>Lundi</option>
                    <option value={2}>Mardi</option>
                    <option value={3}>Mercredi</option>
                    <option value={4}>Jeudi</option>
                    <option value={5}>Vendredi</option>
                    <option value={6}>Samedi</option>
                    <option value={0}>Dimanche</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Heure</label>
                  <input
                    type="time"
                    className="w-full border border-gray-200/70 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Lieu</label>
                <input
                  className="w-full border border-gray-200/70 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                  placeholder="Stade municipal"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Label (optionnel)</label>
                <input
                  className="w-full border border-gray-200/70 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                  placeholder="Tactique, Physique..."
                  value={scheduleForm.label}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, label: e.target.value })}
                />
              </div>
              <button
                onClick={handleAddSlot}
                disabled={addingSlot || !scheduleForm.location.trim()}
                className="flex w-full items-center justify-center gap-2 bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {addingSlot ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter
              </button>
            </div>
          </div>

          {/* Team info summary */}
          <div className=" border border-gray-200/70 bg-white p-4 sm:p-5">
            <h3 className="font-semibold text-gray-900">Informations</h3>
            <dl className="mt-3 space-y-3">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                <dt className="text-gray-500">Capacite</dt>
                <dd className="font-medium text-gray-900 text-right">
                  {`${squadCount} / ${team.maxMembers} joueurs`}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                <dt className="text-gray-500">Matchs joues</dt>
                <dd className="font-medium text-gray-900 text-right">{team.matchesPlayed}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                <dt className="text-gray-500">Bilan</dt>
                <dd className="font-medium text-gray-900 text-right">{team.wins}V / {team.draws}N / {team.losses}D</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
                <dt className="text-gray-500">Taux de victoire</dt>
                <dd className="font-medium text-gray-900 text-right">{winRate}%</dd>
              </div>
            </dl>
          </div>

          {/* Le staff : nommé par le propriétaire, et par lui seul. */}
          {isTeamOwner && (
            <StaffBlock team={team} members={members} onSaved={fetchTeam} />
          )}

          {/* Danger zone. Réservée au propriétaire : un délégué gère l'équipe,
              il ne la supprime pas. */}
          {isTeamOwner && (
          <div className=" border border-red-200 bg-red-50/50 p-4 sm:p-5">
            <h3 className="font-semibold text-red-700">Zone dangereuse</h3>
            <p className="mt-1 text-sm text-red-600/80">
              Supprimer l&apos;equipe supprimera toutes les donnees associees de maniere irreversible.
            </p>
            <button onClick={() => setShowDeleteModal(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-all sm:w-auto sm:justify-start">
              <Trash2 size={14} /> Supprimer l&apos;equipe
            </button>
          </div>
          )}
        </motion.div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showEditModal && <EditTeamModal team={team} onClose={() => setShowEditModal(false)} onSaved={fetchTeam} />}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteModal && <DeleteConfirmModal teamName={team.name} onClose={() => setShowDeleteModal(false)} onConfirm={handleDeleteTeam} deleting={deleting} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAchievementModal && <AddAchievementModal teamId={team.id} onClose={() => setShowAchievementModal(false)} onSaved={fetchTeam} />}
      </AnimatePresence>
      <AnimatePresence>
        {showTrainingModal && <CreateTrainingModal teamId={team.id} managerId={team.managerId} memberIds={team.memberIds} onClose={() => setShowTrainingModal(false)} onSaved={() => {}} />}
      </AnimatePresence>
      <AnimatePresence>
        {showGhostModal && (
          <GhostPlayerModal
            ghost={editingGhost}
            teamId={teamId}
            onClose={() => { setShowGhostModal(false); setEditingGhost(null); }}
            onSaved={() => {}}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {ghostStatsTarget && (
          <GhostStatsModal
            ghost={ghostStatsTarget}
            onClose={() => setGhostStatsTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
