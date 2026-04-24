"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, MapPin, Users, Star, ChevronLeft, Settings,
  Trash2, UserMinus, UserPlus, Edit3, X, Check,
  Loader2, Trophy, Calendar, Image, Dumbbell, Medal,
  ToggleLeft, ToggleRight, AlertTriangle, ClipboardList,
  Heart, Plus, Camera, UserCheck, BarChart2,
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
} from "@/lib/firestore";
import { uploadTeamLogo, uploadTeamBanner, uploadTeamGalleryImage } from "@/lib/storage";
import { avatarColor } from "@/components/feed/PostCard";
import type { Team, UserProfile, Match, JoinRequest, Achievement, Training, GhostPlayer, TrainingScheduleSlot } from "@/types";

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

type ActiveTab = "roster" | "matches" | "settings" | "candidatures" | "palmares" | "gallery" | "trainings";

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
          {/* Media uploads */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Bannière</label>
            <div className="relative h-24 w-full cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100"
              onClick={() => document.getElementById("banner-input")?.click()}>
              {bannerPreview
                ? <img src={bannerPreview} className="h-full w-full object-cover" alt="" />
                : <div className="flex h-full items-center justify-center gap-2 text-xs text-gray-400"><Camera size={16} /> Choisir une bannière</div>}
              <input id="banner-input" type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </div>
            <label className="block text-sm font-medium text-gray-700">Logo</label>
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 flex-shrink-0"
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
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Slogan</label>
            <input type="text" maxLength={80} value={form.slogan}
              onChange={(e) => setForm({ ...form, slogan: e.target.value })}
              placeholder="Ex: Toujours debout !"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">Ajouter un trophée</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Champion régional 2024"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (optionnel)</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Icône</label>
            <div className="flex gap-2">
              {ACHIEVEMENT_ICONS.map(({ value, label, Icon }) => (
                <button key={value} type="button" onClick={() => setForm({ ...form, icon: value })}
                  title={label}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 transition-all ${form.icon === value ? "border-primary-600 bg-primary-50 text-primary-600" : "border-gray-200 text-gray-400 hover:border-gray-300"}`}>
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving || !form.title.trim() || !form.date}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="text-lg font-bold text-gray-900 font-display">Créer un entraînement</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Titre</label>
            <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ex: Entraînement tactique"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Heure</label>
              <input type="time" required value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Lieu</label>
            <input required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Ex: Stade municipal"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description (optionnel)</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
          </div>
          <button type="submit" disabled={saving || !form.title.trim() || !form.date || !form.time || !form.location.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="mb-4 text-lg font-bold text-gray-900">
          {ghost ? "Modifier le joueur" : "Ajouter un joueur"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Prénom</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jean"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500">Nom</label>
              <input
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
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
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
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
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary-400 focus:outline-none"
              value={form.squadNumber}
              onChange={(e) => setForm({ ...form, squadNumber: e.target.value })}
              placeholder="Ex: 10"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="mb-1 text-lg font-bold text-gray-900">
          {ghost.firstName} {ghost.lastName}
        </h3>
        <p className="mb-5 text-xs text-gray-400">{POSITION_LABELS[ghost.position] ?? ghost.position}</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Matchs", value: ghost.matchesPlayed },
            { label: "Buts", value: ghost.goals },
            { label: "Assists", value: ghost.assists },
            { label: "Jaunes", value: ghost.yellowCards },
            { label: "Rouges", value: ghost.redCards },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center rounded-xl bg-gray-50 py-3">
              <span className="text-2xl font-black text-gray-900">{s.value}</span>
              <span className="text-[10px] font-semibold text-gray-400 uppercase">{s.label}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose}
          className="mt-5 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
          Fermer
        </button>
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

  // Sync lineup and squad numbers from team data
  useEffect(() => {
    if (team) { 
      setLineup(team.lineupIds ?? []); 
      setLineupChanged(false); 
      setTeamSquadNumbers(team.squadNumbers ?? {});
      setSquadNumbersChanged(false);
    }
  }, [team]);

  // Real-time trainings listener
  useEffect(() => {
    if (!teamId) return;
    const unsub = onTrainingsByTeam(teamId, setTrainings);
    return unsub;
  }, [teamId]);

  // Real-time ghost players listener
  useEffect(() => {
    if (!teamId) return;
    const unsub = onGhostPlayersByTeam(teamId, setGhostPlayers);
    return unsub;
  }, [teamId]);

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
    setActionError(null);
    try {
      await respondToJoinRequest(request.id, true, team.id, request.playerId);
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
        className="group relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
      >
        {/* Banner with gradient overlay */}
        <div className="relative h-32 w-full overflow-hidden sm:h-56">
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
                  className={`flex items-center gap-1.5 rounded-full backdrop-blur-md px-4 py-2 text-xs font-bold transition-all shadow-lg ${
                    isFollowing 
                      ? "bg-primary-500/90 text-white" 
                      : "bg-white/90 text-gray-900 hover:bg-white"
                  }`}>
                  <Heart size={14} className={isFollowing ? "fill-current" : ""} />
                  {isFollowing ? "Suivi" : "Suivre"}
                </button>
              )}
              {isTeamManager && (
                <button onClick={() => setShowEditModal(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-lg backdrop-blur-md transition-all hover:bg-white">
                  <Edit3 size={16} />
                </button>
              )}
          </div>

          {/* Bottom Header Info (Glassmorphism Effect) */}
          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6">
            <div className="flex items-end gap-5">
              <div className="relative shrink-0">
                <div className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white shadow-xl sm:h-24 sm:w-24 ${colors.bg}`}>
                  {team.logoUrl
                    ? <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                    : <Shield size={40} className={colors.icon} />}
                </div>
                {team.isRecruiting && (
                  <div className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg ring-2 ring-white">
                    <UserPlus size={12} />
                  </div>
                )}
              </div>
              <div className="mb-1 flex-1 text-white">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-black tracking-tight sm:text-3xl font-display uppercase">{team.name}</h1>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                    team.level === "advanced" ? "bg-red-500/80" :
                    team.level === "intermediate" ? "bg-amber-500/80" :
                    "bg-blue-500/80"
                  }`}>
                    {LEVEL_LABELS[team.level] ?? team.level}
                  </span>
                </div>
                {team.slogan && <p className="mt-1 text-sm font-medium opacity-90 italic">«&nbsp;{team.slogan}&nbsp;»</p>}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold opacity-80">
                  <span className="flex items-center gap-1.5"><MapPin size={14} className="text-primary-400" /> {team.city}</span>
                  <span className="flex items-center gap-1.5"><Users size={14} className="text-blue-400" /> {team.memberIds.length}/{team.maxMembers} joueurs</span>
                  <span className="flex items-center gap-1.5"><Heart size={14} className="text-red-400" /> {team.followersCount ?? 0} abonnés</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {/* Description */}
          {team.description && (
            <div className="mb-8">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">À propos</h3>
              <p className="text-sm leading-relaxed text-gray-600 italic">&ldquo;{team.description}&rdquo;</p>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
             <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50 p-4 transition-all hover:shadow-md">
                <div className="absolute -right-2 -top-2 opacity-10"><Users size={64}/></div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Effectif</p>
                <p className="mt-1 text-2xl font-black text-gray-900 font-display">{team.memberIds.length}</p>
             </div>
             <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 transition-all hover:shadow-md">
                <div className="absolute -right-2 -top-2 opacity-10 text-emerald-600"><Trophy size={64}/></div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-600/60">Victoires</p>
                <p className="mt-1 text-2xl font-black text-emerald-600 font-display">{team.wins}</p>
             </div>
             <div className="relative overflow-hidden rounded-2xl border border-red-100 bg-red-50/50 p-4 transition-all hover:shadow-md">
                <div className="absolute -right-2 -top-2 opacity-10 text-red-600"><X size={64}/></div>
                <p className="text-xs font-bold uppercase tracking-wider text-red-600/60">Défaites</p>
                <p className="mt-1 text-2xl font-black text-red-600 font-display">{team.losses}</p>
             </div>
             <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-4 transition-all hover:shadow-md">
                <div className="absolute -right-2 -top-2 opacity-10 text-blue-600"><Star size={64}/></div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600/60">Win Rate</p>
                <p className="mt-1 text-2xl font-black text-blue-600 font-display">{winRate}%</p>
             </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="flex overflow-x-auto border-b border-gray-200 scrollbar-hide"
      >
        {[
          { id: "roster", label: "Effectif", icon: Users, count: members.length },
          { id: "matches", label: "Matchs", icon: Calendar, count: matches.length },
          { id: "trainings", label: "Entraînements", icon: Dumbbell, count: 0 },
          { id: "palmares", label: "Palmarès", icon: Trophy, count: (team.achievements ?? []).length },
          { id: "gallery", label: "Galerie", icon: Image, count: (team.galleryUrls ?? []).length },
          ...(isTeamManager ? [{ id: "candidatures", label: "Candidatures", icon: ClipboardList, count: pendingCount, isBadge: true }] : []),
          ...(isTeamManager ? [{ id: "settings", label: "Paramètres", icon: Settings, count: 0 }] : []),
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ActiveTab)}
            className={`relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-3 text-xs sm:text-sm sm:gap-2 sm:pr-6 sm:px-0 font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id ? "border-primary-600 text-primary-600" : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                "isBadge" in tab && tab.isBadge
                  ? "bg-red-100 text-red-600"
                  : activeTab === tab.id
                    ? "bg-primary-100 text-primary-700"
                    : "bg-gray-100 text-gray-500"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* ===================== TAB: ROSTER ===================== */}
      {activeTab === "roster" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
          {/* Manager block */}
          {(() => {
            const manager = members.find((m) => m.uid === team.managerId);
            if (!manager) return null;
            const initials = `${manager.firstName[0] ?? ""}${manager.lastName[0] ?? ""}`;
            return (
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${manager.firstName} ${manager.lastName}`)}`}>
                  {manager.profilePictureUrl ? <img src={manager.profilePictureUrl} alt="" className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{manager.firstName} {manager.lastName}</span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">Manager</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11} /> {manager.locationCity}</div>
                </div>
                {isTeamManager && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">N°</span>
                    <input 
                      type="text"
                      className="h-9 w-12 rounded-xl border border-gray-100 bg-white text-center text-sm font-black text-gray-900 shadow-sm focus:border-blue-300 focus:ring-0"
                      value={teamSquadNumbers[manager.uid] || ""}
                      onChange={(e) => handleSquadNumberChange(manager.uid, e.target.value)}
                      placeholder="—"
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Player list (excluding manager) */}
          {isTeamManager && (lineupChanged || squadNumbersChanged) && (
            <div className="flex items-center justify-between rounded-lg border border-primary-200 bg-primary-50 px-4 py-2.5">
              <span className="text-sm text-primary-700">Modification(s) en attente</span>
              <div className="flex gap-2">
                {lineupChanged && (
                  <button onClick={handleSaveLineup} disabled={savingLineup}
                    className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                    {savingLineup ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Composition
                  </button>
                )}
                {squadNumbersChanged && (
                  <button onClick={handleSaveSquadNumbers} disabled={savingSquadNumbers}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
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
                <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
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
                      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:shadow-sm transition-shadow sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="flex items-center gap-3">
                        {isTeamManager && (
                          <button onClick={() => handleLineupToggle(member.uid)}
                            title={isStarter ? "Retirer des titulaires" : "Ajouter aux titulaires"}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isStarter ? "border-primary-600 bg-primary-600 text-white" : "border-gray-300 text-transparent hover:border-primary-400"}`}>
                            <UserCheck size={12} />
                          </button>
                        )}
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${member.firstName} ${member.lastName}`)}`}>
                          {member.profilePictureUrl ? <img src={member.profilePictureUrl} alt="" className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900">{member.firstName} {member.lastName}</h4>
                            {isStarter && <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">Titulaire</span>}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <MapPin size={11} /> {member.locationCity}
                            {pos && <span className={`ml-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-600"}`}>{POSITION_LABELS[pos] ?? pos}</span>}
                          </div>
                        </div>
                      </div>
                      {isTeamManager && (
                        <div className="flex items-center gap-3 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
                          <div className="flex items-center gap-2 sm:border-r sm:border-gray-100 sm:pr-4">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">N°</span>
                            <input
                              type="text"
                              className="h-8 w-11 rounded-xl border border-gray-100 bg-gray-50/50 text-center text-sm font-black text-gray-900 shadow-sm focus:border-primary-300 focus:bg-white focus:ring-0 transition-all sm:h-9 sm:w-12"
                              value={teamSquadNumbers[member.uid] || ""}
                              onChange={(e) => handleSquadNumberChange(member.uid, e.target.value)}
                              placeholder="—"
                            />
                          </div>
                          <button onClick={() => handleRemoveMember(member.uid)} disabled={removingMember === member.uid}
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
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
                      className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:shadow-sm transition-shadow sm:flex-row sm:items-center sm:justify-between sm:p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${avatarColor(`${ghost.firstName} ${ghost.lastName}`)}`}>
                          {initials}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{ghost.firstName} {ghost.lastName}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {ghost.squadNumber && <span className="font-bold text-gray-700">N°{ghost.squadNumber}</span>}
                            <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[ghost.position] ?? "bg-gray-100 text-gray-600"}`}>
                              {POSITION_LABELS[ghost.position] ?? ghost.position}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isTeamManager && (
                        <div className="flex items-center gap-2 border-t border-gray-100 pt-2 sm:border-t-0 sm:pt-0 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => setGhostStatsTarget(ghost)}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <BarChart2 size={12} /> Stats
                          </button>
                          <button
                            onClick={() => { setEditingGhost(ghost); setShowGhostModal(true); }}
                            className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <Edit3 size={12} /> Modifier
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
                            className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50">
                            {deletingGhostId === ghost.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Supprimer
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            );
          })()}
          {isTeamManager && (
            <div className="flex gap-2">
              <button
                onClick={() => { setEditingGhost(null); setShowGhostModal(true); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 bg-white py-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Plus size={16} /> Ajouter un joueur
              </button>
              <Link href="/recruitment"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
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

      {/* ===================== TAB: PALMARES ===================== */}
      {activeTab === "palmares" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-3">
          {(team.achievements ?? []).length > 0 ? (
            (team.achievements ?? []).map((ach, i) => {
              const AchIcon = ACHIEVEMENT_ICONS.find((a) => a.value === ach.icon)?.Icon ?? Trophy;
              return (
                <motion.div key={ach.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}>
                    <AchIcon size={24} className={colors.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{ach.title}</p>
                    <p className="text-xs text-gray-400">{new Date(ach.date).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
                    {ach.description && <p className="mt-0.5 text-sm text-gray-500">{ach.description}</p>}
                  </div>
                  {isTeamManager && (
                    <button onClick={async () => { await removeAchievement(team.id, ach.id); await fetchTeam(); }}
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
              <Trophy size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun trophée pour le moment</p>
            </div>
          )}
          {isTeamManager && (
            <button onClick={() => setShowAchievementModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
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
                <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
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
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
              <Image size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucune photo pour le moment</p>
            </div>
          )}
          {isTeamManager && (
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
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
                className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{training.title}</h4>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Calendar size={11} /> {new Date(training.date).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} à {training.time}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} /> {training.location}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {confirmedCount}/{training.attendees.length} confirmés</span>
                    </div>
                    {training.description && <p className="mt-2 text-sm text-gray-500">{training.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {/* Player response */}
                    {myAttendee && myAttendee.status === "pending" && (
                      <>
                        <button onClick={() => respondToTraining(training.id, user!.uid, "confirmed").then(() => toast.success("Présence confirmée"))}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                          <Check size={12} /> Présent
                        </button>
                        <button onClick={() => respondToTraining(training.id, user!.uid, "declined").then(() => toast.success("Absence signalée"))}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
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
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          }) : (
            <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-12">
              <Dumbbell size={32} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-500">Aucun entraînement programmé</p>
            </div>
          )}
          {isTeamManager && (
            <button onClick={() => setShowTrainingModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary-200 bg-primary-50/50 py-4 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors">
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

          {/* Error feedback */}
          {actionError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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

          {/* Training schedule */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
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
                  <div key={i} className="flex items-center justify-between rounded-lg bg-violet-50 px-3 py-2">
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
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Ajouter un créneau</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-400">Jour</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
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
                    className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                    value={scheduleForm.time}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Lieu</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                  placeholder="Stade municipal"
                  value={scheduleForm.location}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-400">Label (optionnel)</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
                  placeholder="Tactique, Physique..."
                  value={scheduleForm.label}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, label: e.target.value })}
                />
              </div>
              <button
                onClick={handleAddSlot}
                disabled={addingSlot || !scheduleForm.location.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {addingSlot ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter
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
