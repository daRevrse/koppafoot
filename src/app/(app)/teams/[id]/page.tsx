"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield, MapPin, Users, Star, ChevronLeft, Trash2, UserMinus, UserPlus, Edit3, X, Check,
  Loader2, Trophy, Calendar, Image, Dumbbell, Medal,
  ToggleLeft, ToggleRight, AlertTriangle, ClipboardList,
  Plus, Camera, UserCheck, BarChart2, ShieldCheck, HeartPulse, Share2,
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
  declarerConditionFantome,
  setTeamStaff,
} from "@/lib/firestore";
import { useFormes } from "@/hooks/useFormes";
import { cleFormeCompte, cleFormeLigne, conditionEnVigueur } from "@/lib/etat-de-forme";
import { PastillesEtatDeForme } from "@/components/forme/badges";
import EditeurCondition from "@/components/forme/EditeurCondition";
import { TITRES_STAFF, estProprietaireEquipe, peutGererEquipe } from "@/lib/team-access";
import { uploadTeamLogo, uploadTeamBanner, uploadTeamGalleryImage } from "@/lib/storage";
import { avatarColor } from "@/components/feed/PostCard";
import GhostMergeCorner from "@/components/team/GhostMergeCorner";
import BandeauEquipe, { BOUTON_BANDEAU, FormeEnLettres } from "@/components/team/BandeauEquipe";
import CarteDuClub from "@/components/team/CarteDuClub";
import EffectifParPoste, { type LigneDEffectif } from "@/components/team/EffectifParPoste";
import MatchsDuClub from "@/components/team/MatchsDuClub";
import { BadgeForme } from "@/components/forme/badges";
import { useAuthModal } from "@/components/auth/AuthModal";
import { lienAbsolu, partagerLien } from "@/lib/partage";
import { versHex } from "@/lib/couleurs-equipe";
import {
  rangerLesMatchs, type CompetitionDuClub, type JoueurDuClub, type MatchDuClub,
  type MembreDuStaff, type Meneur,
} from "@/lib/fiche-club";
import type { BilanClub } from "@/lib/bilan-club";

/** Le bilan de la route publique, forme comprise (voir lib/bilan-club-serveur). */
type BilanPublic = BilanClub & { forme: ("V" | "N" | "D")[] };

/**
 * La fiche publique du club, telle que la calcule la route (voir
 * lib/fiche-club-serveur) : la même pour tous les lecteurs, visiteur compris.
 */
interface FichePublique {
  bilan: BilanPublic;
  effectif: JoueurDuClub[];
  manager: { uid: string; nom: string; photo: string | null } | null;
  staff: MembreDuStaff[];
  matchs: MatchDuClub[];
  competitions: CompetitionDuClub[];
  meneurs: { buteurs: Meneur[]; passeurs: Meneur[] } | null;
}
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { POSTES, libellePoste, normaliserPoste } from "@/lib/postes";
import { genreDuJoueur } from "@/lib/genre";
import { dateAvecJour } from "@/lib/dates";
import type { Team, UserProfile, Match, JoinRequest, Achievement, Training, GhostPlayer, TrainingScheduleSlot, TeamStaffMember } from "@/types";
import CompositionsTypes from "@/components/team/CompositionsTypes";
import ChoixDeCategorie from "@/components/genre/ChoixDeCategorie";
import { useLangue, useTextes } from "@/i18n";
import { LOCALE } from "@/i18n/config";
import { textes } from "@/i18n/textes";

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

// CE QUE LIT UN VISITEUR, OU UN MEMBRE, EST TRADUIT : la fiche publique du
// club. Les outils du manager (effectif à gérer, paramètres, candidatures,
// fenêtres de saisie) restent en français pour l'instant.
const T = textes(
  {
    niveau: (n: string) => LEVEL_LABELS[n] ?? null,
    creeUnCompte: "Crée ton compte pour suivre ce club.",
    operationImpossible: "Opération impossible",
    introuvable: "Équipe introuvable",
    introuvableTexte: "Cette équipe n'existe pas ou a été supprimée.",
    retourEquipes: "Retour aux équipes",
    mesEquipes: "Mes équipes",
    direct: "Direct",
    toi: "Toi",
    presents: (n: number, total: number) => `${n}/${total} présents`,
    partageTexte: (nom: string, ville: string | null) => `${nom}${ville ? ` (${ville})` : ""} sur KoppaFoot`,
    lienCopie: "Lien du club copié !",
    partageEchoue: "Le partage a échoué.",
    onglet: (id: string) => ({
      roster: "Effectif", matches: "Matchs", compositions: "Compositions", trainings: "Entraînements",
      palmares: "Palmarès", gallery: "Galerie", candidatures: "Candidatures", settings: "Paramètres",
    } as Record<string, string>)[id] ?? id,
    /** Une équipe féminine compte ses joueuses. */
    joueurs: (n: number, feminin?: boolean) => `${n} ${feminin ? "joueuse" : "joueur"}${n > 1 ? "s" : ""}`,
    recrute: "Recrute",
    partager: "Partager ce club",
    suivi: "Suivi",
    suivre: "Suivre",
    modifier: "Modifier l'équipe",
    sections: "Sections du club",
    effectifVide: "L'effectif n'est pas encore renseigné.",
    aucunTrophee: "Aucun trophée pour le moment",
    aucunePhoto: "Aucune photo pour le moment",
    quandEntrainement: (jour: string, heure: string) => `${jour} à ${heure}`,
    confirmes: (n: number, total: number) => `${n}/${total} confirmés`,
    presenceConfirmee: "Présence confirmée",
    absenceSignalee: "Absence signalée",
    present: "Présent",
    absent: "Absent",
    entrainementSupprime: "Entraînement supprimé",
    aucunEntrainement: "Aucun entraînement programmé",
  },
  {
    niveau: (n: string) => ({ beginner: "Beginner", amateur: "Amateur", intermediate: "Intermediate", advanced: "Advanced" } as Record<string, string>)[n] ?? null,
    creeUnCompte: "Create your account to follow this club.",
    operationImpossible: "Couldn't do that",
    introuvable: "Team not found",
    introuvableTexte: "This team doesn't exist or has been deleted.",
    retourEquipes: "Back to teams",
    mesEquipes: "My teams",
    direct: "Live",
    toi: "You",
    presents: (n: number, total: number) => `${n}/${total} in`,
    partageTexte: (nom: string, ville: string | null) => `${nom}${ville ? ` (${ville})` : ""} on KoppaFoot`,
    lienCopie: "Club link copied!",
    partageEchoue: "Sharing failed.",
    onglet: (id: string) => ({
      roster: "Squad", matches: "Matches", compositions: "Line-ups", trainings: "Training",
      palmares: "Honours", gallery: "Gallery", candidatures: "Applications", settings: "Settings",
    } as Record<string, string>)[id] ?? id,
    joueurs: (n: number) => `${n} player${n === 1 ? "" : "s"}`,
    recrute: "Recruiting",
    partager: "Share this club",
    suivi: "Following",
    suivre: "Follow",
    modifier: "Edit the team",
    sections: "Club sections",
    effectifVide: "The squad hasn't been filled in yet.",
    aucunTrophee: "No trophies yet",
    aucunePhoto: "No photos yet",
    quandEntrainement: (jour: string, heure: string) => `${jour} at ${heure}`,
    confirmes: (n: number, total: number) => `${n}/${total} confirmed`,
    presenceConfirmee: "Attendance confirmed",
    absenceSignalee: "Absence reported",
    present: "In",
    absent: "Out",
    entrainementSupprime: "Training session deleted",
    aucunEntrainement: "No training sessions scheduled",
  },
);

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

type ActiveTab = "roster" | "compositions" | "matches" | "settings" | "candidatures" | "palmares" | "gallery" | "trainings";

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
    category: team.category ?? null,
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
        ...(form.category ? { category: form.category } : {}),
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
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Catégorie</label>
            <ChoixDeCategorie valeur={form.category} onChange={(c) => setForm({ ...form, category: c })} />
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

/**
 * La condition d'un joueur sans compte, déclarée par son manager.
 *
 * Il ne peut pas le faire lui-même — c'est précisément ce qui fait de lui un
 * joueur sans compte. Sans cette fenêtre, sa blessure n'existait que dans la
 * tête de son manager, et la feuille de match ne pouvait pas la rappeler.
 */
function ConditionFantomeModal({
  ghost,
  teamId,
  onClose,
}: {
  ghost: GhostPlayer;
  teamId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto bg-white p-6"
      >
        <h3 className="mb-1 text-lg font-bold text-gray-900">
          Condition de {ghost.firstName} {ghost.lastName}
        </h3>
        <p className="mb-5 text-xs text-gray-400">
          Il n&apos;a pas de compte : c&apos;est au club de la déclarer pour lui.
        </p>
        <EditeurCondition
          initiale={conditionEnVigueur(ghost.condition)}
          pourUnAutre
          onAnnuler={onClose}
          onEnregistrer={async (c) => {
            await declarerConditionFantome(teamId, ghost.id, c);
            toast.success("Condition enregistrée");
            onClose();
          }}
        />
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
async function fetchPublicTeam(id: string): Promise<{ team: Team; fiche: FichePublique } | null> {
  try {
    const res = await fetch(`/api/public/team/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const { team } = await res.json();
    if (!team) return null;
    // Le bilan calculé par la route : amicaux ET compétitions (voir
    // lib/bilan-club-serveur). La page ne charge que les amicaux, elle ne
    // pourrait pas le refaire seule.
    const bilan: BilanPublic = {
      joues: team.matches_played ?? 0,
      gagnes: team.wins ?? 0,
      nuls: team.draws ?? 0,
      perdus: team.losses ?? 0,
      butsPour: team.goals_for ?? 0,
      butsContre: team.goals_against ?? 0,
      sansEncaisser: team.clean_sheets ?? 0,
      forme: Array.isArray(team.form) ? team.form : [],
    };
    const fiche: FichePublique = {
      bilan,
      effectif: Array.isArray(team.effectif) ? team.effectif : [],
      manager: team.manager ?? null,
      staff: Array.isArray(team.staff) ? team.staff : [],
      matchs: Array.isArray(team.matchs) ? team.matchs : [],
      competitions: Array.isArray(team.competitions) ? team.competitions : [],
      meneurs: team.meneurs ?? null,
    };
    return { fiche, team: {
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
      followersCount: team.followers_count ?? 0,
      squadCount: team.squad_count ?? team.member_count ?? 0,
      memberIds: [],
      managerId: "",
    } as unknown as Team };
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
  const { langue } = useLangue();
  const t = useTextes(T);
  const teamId = params.id;

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  /** La fiche de la route publique, la même pour tous les lecteurs. */
  const [fiche, setFiche] = useState<FichePublique | null>(null);
  const bilanServeur = fiche?.bilan ?? null;
  const { open: ouvrirConnexion } = useAuthModal();
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
      //
      // LE BILAN VIENT DE LA ROUTE PUBLIQUE, POUR TOUT LE MONDE. Connecté, il
      // se lisait sur les compteurs du document, qui dérivent, et ignorait les
      // compétitions : le manager et le visiteur ne voyaient pas la même fiche.
      const [lu, pub] = await Promise.all([
        user ? getTeamById(teamId) : Promise.resolve(null),
        fetchPublicTeam(teamId),
      ]);
      const base = user ? lu : pub?.team ?? null;
      const data = base && pub
        ? {
            ...base,
            matchesPlayed: pub.fiche.bilan.joues,
            wins: pub.fiche.bilan.gagnes,
            draws: pub.fiche.bilan.nuls,
            losses: pub.fiche.bilan.perdus,
          }
        : base;
      setTeam(data);
      setFiche(pub?.fiche ?? null);
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

  // LA FORME DE TOUT L'EFFECTIF, EN UNE LECTURE (voir lib/formes-admin). Les
  // comptes par leur identifiant, les joueurs sans compte par leur ligne dans
  // CE club : c'est là que leurs matchs les ont rangés.
  const { formes } = useFormes([
    ...members.map((m) => cleFormeCompte(m.uid)),
    ...ghostPlayers.map((g) => cleFormeLigne(teamId, g.id)),
    // L'effectif de la fiche publique : celui que lit tout le monde.
    ...(fiche?.effectif ?? []).map((j) => (j.uid ? cleFormeCompte(j.uid) : cleFormeLigne(teamId, j.id))),
  ]);
  const [conditionCible, setConditionCible] = useState<GhostPlayer | null>(null);

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
    // Un visiteur touchait « Suivre » sans que rien ne se passe : on lui dit
    // ce qu'il faut pour suivre un club.
    if (!user) {
      ouvrirConnexion(t.creeUnCompte);
      return;
    }
    if (!team) return;
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
      toast.error(err instanceof Error ? err.message : t.operationImpossible);
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
        message: `Ta candidature pour ${team.name} a été acceptée. Rejoins-nous !`,
      });
    } catch {
      setActionError("Une erreur est survenue. Réessaie.");
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
      setActionError("Une erreur est survenue. Réessaie.");
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
        <h2 className="mt-4 font-display text-2xl font-black tracking-tight text-gray-900">{t.introuvable}</h2>
        <p className="mt-2 text-sm text-gray-500">{t.introuvableTexte}</p>
        <Link href="/teams"
          className="mt-6 inline-flex items-center gap-2 bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-all">
          <ChevronLeft size={15} /> {t.retourEquipes}
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
    : isTeamManager || isTeamMember ? [{ href: "/teams", label: t.mesEquipes }]
    : [{ href: "/", label: t.direct }];

  const colors = COLOR_MAP[team.color] ?? COLOR_MAP.emerald;
  // Le résumé des paramètres du manager, seul endroit où il se lit encore.
  const winRate = team.matchesPlayed > 0 ? Math.round((team.wins / team.matchesPlayed) * 100) : 0;
  // Les amicaux à venir que la page a lus elle-même (comptes connectés) : ils
  // ne servent plus qu'aux présences, que seuls les membres voient. La liste
  // des matchs vient de la fiche publique, voir plus bas.
  const upcomingMatches = matches.filter(
    (m) => m.status === "upcoming" || m.status === "live" || m.status === "delayed",
  );
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
  //
  // Un visiteur ne charge ni les comptes ni les fantômes : il lit le nombre
  // que la route publique a compté (`squadCount`, posé par fetchPublicTeam).
  const squadCount = user
    ? team.memberIds.length + ghostPlayers.length
    : (team as Team & { squadCount?: number }).squadCount ?? 0;
  // Combien de formats sont deja prepares : le compteur de l onglet.
  const nombreDeCompositions = Object.values(team.compositionsTypes ?? {}).filter(
    (c) => c.lineup.length > 0,
  ).length;

  // ------------------------------------------------------------------
  // CE QUE TOUT LE MONDE LIT, depuis la fiche publique (voir
  // lib/fiche-club-serveur) : le bilan, la forme, les meilleurs joueurs,
  // l'effectif et les matchs — amicaux et compétitions. Ils se calculaient ici
  // sur les seuls amicaux, et seulement pour un compte connecté : un visiteur
  // lisait « Effectif 14 » au-dessus de « Aucun joueur », et le meilleur
  // buteur sortait de compteurs de profil qu'un match ne crédite qu'une fois
  // validé.
  const estMembre = isTeamManager || isTeamMember;
  const matchsPublics = fiche?.matchs ?? [];
  const prochainMatch = rangerLesMatchs(matchsPublics).aVenir[0] ?? null;
  // Du plus ancien au plus récent, comme partout ailleurs (la route les rend
  // dans l'autre sens).
  const formeChrono = [...(bilanServeur?.forme ?? [])].reverse();

  /**
   * L'EFFECTIF PUBLIC : celui de la fiche, rangé par poste. Faute de fiche
   * (route injoignable), un compte connecté retombe sur ce que la page a lu
   * elle-même.
   */
  const effectifLu: JoueurDuClub[] = fiche?.effectif ?? [
    ...members.filter((m) => m.uid !== team.managerId).map((m) => ({
      id: m.uid,
      nom: `${m.firstName} ${m.lastName}`.trim(),
      numero: teamSquadNumbers[m.uid]?.trim() || null,
      poste: normaliserPoste(m.position),
      photo: m.profilePictureUrl ?? null,
      uid: m.uid,
    })),
    ...ghostPlayers.map((g) => ({
      id: g.id,
      nom: `${g.firstName} ${g.lastName}`.trim(),
      numero: g.squadNumber?.trim() && !dossardsDesComptes.has(g.squadNumber.trim()) ? g.squadNumber.trim() : null,
      poste: normaliserPoste(g.position),
      photo: null,
      uid: null,
    })),
  ];
  const lignesEffectif: LigneDEffectif[] = effectifLu.map((j) => ({
    cle: j.id,
    nom: j.nom,
    numero: j.numero,
    poste: j.poste,
    photo: j.photo,
    lien: j.uid ? `/profile/${j.uid}` : null,
    apres: (
      <>
        {j.uid && j.uid === user?.uid && (
          <span className="bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-700">{t.toi}</span>
        )}
        <BadgeForme forme={formes[j.uid ? cleFormeCompte(j.uid) : cleFormeLigne(teamId, j.id)]} court />
      </>
    ),
  }));
  const tailleEffectif = isTeamManager ? squadCount : effectifLu.length || squadCount;

  /**
   * Qui a confirmé sa présence, sur un amical à venir : une information de
   * vestiaire, pour les membres seulement. N'importe quel compte la lisait.
   */
  const presences: Record<string, React.ReactNode> = estMembre
    ? Object.fromEntries(
        upcomingMatches
          .filter((m) => m.playersTotal > 0)
          .map((m) => [
            m.id,
            <span key={m.id} className="shrink-0 border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700">
              {t.presents(m.playersConfirmed ?? 0, m.playersTotal)}
            </span>,
          ]),
      )
    : {};

  const partagerLeClub = async () => {
    const resultat = await partagerLien({
      title: team.name,
      text: t.partageTexte(team.name, team.city || null),
      url: lienAbsolu(`/teams/${team.id}`),
    });
    if (resultat === "copie") toast.success(t.lienCopie);
    else if (resultat === "echec") toast.error(t.partageEchoue);
  };

  /**
   * LES ONGLETS : ceux qui ont quelque chose à montrer à CE lecteur.
   *
   * « À propos » et « Stats » sont devenus la carte du club (voir
   * CarteDuClub). Les entraînements sont l'affaire des membres : un visiteur
   * ouvrait un onglet toujours vide, un compte étranger lisait le programme et
   * les présences du club. Palmarès et galerie ne s'ouvrent que s'ils ont
   * quelque chose, sauf pour le manager, qui doit pouvoir les remplir.
   */
  const onglets: { id: ActiveTab; label: string; count: number; isBadge?: boolean }[] = [
    { id: "roster", label: t.onglet("roster"), count: tailleEffectif },
    { id: "matches", label: t.onglet("matches"), count: matchsPublics.length },
    ...(isTeamManager ? [{ id: "compositions" as const, label: t.onglet("compositions"), count: nombreDeCompositions }] : []),
    ...(estMembre ? [{ id: "trainings" as const, label: t.onglet("trainings"), count: trainings.length }] : []),
    ...((team.achievements ?? []).length > 0 || isTeamManager
      ? [{ id: "palmares" as const, label: t.onglet("palmares"), count: (team.achievements ?? []).length }] : []),
    ...((team.galleryUrls ?? []).length > 0 || isTeamManager
      ? [{ id: "gallery" as const, label: t.onglet("gallery"), count: (team.galleryUrls ?? []).length }] : []),
    ...(isTeamManager ? [{ id: "candidatures" as const, label: t.onglet("candidatures"), count: pendingCount, isBadge: true }] : []),
    ...(isTeamManager ? [{ id: "settings" as const, label: t.onglet("settings"), count: 0 }] : []),
  ];
  // Un onglet qui disparaît (le dernier trophée retiré) ne laisse pas la page sur un panneau vide.
  const ongletOuvert: ActiveTab = onglets.some((o) => o.id === activeTab) ? activeTab : "roster";

  return (
    <div className="pb-16">
      {/* LE BANDEAU, le même que celui d'une équipe en compétition (voir
          BandeauEquipe). La ville, le niveau et la devise y reviennent :
          ils disent d'où vient le club, en une ligne. */}
      <BandeauEquipe
        fil={[...trail, { label: team.name }]}
        nom={team.name}
        categorie={team.category}
        logo={team.logoUrl ?? null}
        couleur={versHex(team.color)}
        surtitre={[team.city, t.niveau(team.level)].filter(Boolean).join(" · ") || null}
        devise={team.slogan || null}
        banniere={team.bannerUrl ?? null}
        puces={
          <>
            <FormeEnLettres forme={formeChrono} />
            <span>{t.joueurs(tailleEffectif, team.category === "women")}</span>
            {team.isRecruiting && <span className="text-emerald-300">{t.recrute}</span>}
          </>
        }
        actions={
          <>
            <button type="button" onClick={partagerLeClub} aria-label={t.partager} className={BOUTON_BANDEAU}>
              <Share2 size={14} />
            </button>
            {!isTeamManager && (
              <button
                type="button"
                onClick={handleFollowToggle}
                disabled={followLoading}
                aria-pressed={isFollowing}
                className={`${BOUTON_BANDEAU} ${isFollowing ? "border-white bg-white text-black hover:text-black" : ""}`}
              >
                {followLoading
                  ? <Loader2 size={14} className="animate-spin" />
                  : isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                {isFollowing ? t.suivi : t.suivre}
              </button>
            )}
            {isTeamManager && (
              <button type="button" onClick={() => setShowEditModal(true)} aria-label={t.modifier} className={BOUTON_BANDEAU}>
                <Edit3 size={14} />
              </button>
            )}
          </>
        }
      />

      {/* DEUX COLONNES SUR GRAND ÉCRAN : l'onglet ouvert à gauche, la carte du
          club à droite, qui reste en vue. Sur téléphone, la carte passe entre
          le bandeau et les onglets. */}
      <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6">
        <div className="lg:sticky lg:top-[calc(var(--header-h,72px)+1rem)] lg:col-start-2 lg:row-start-1">
          <CarteDuClub
            ville={team.city || null}
            niveau={t.niveau(team.level)}
            recrute={!!team.isRecruiting}
            abonnes={team.followersCount ?? 0}
            bilan={bilanServeur}
            forme={formeChrono}
            meneurs={fiche?.meneurs ?? null}
            prochain={prochainMatch}
            competitions={fiche?.competitions ?? []}
            presentation={team.description || null}
          />
        </div>

        <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-1">
      {/* Les onglets : des mots, sans icône, dans le vocabulaire des autres
          fiches (capitales serrées, soulignage du courant). */}
      <div role="tablist" aria-label={t.sections} className="flex gap-6 overflow-x-auto border-b border-gray-200/70 scrollbar-hide">
        {onglets.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={ongletOuvert === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-3 pt-1 text-[11px] font-black uppercase tracking-[0.12em] transition-colors ${
              ongletOuvert === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`tabular-nums ${tab.isBadge ? "bg-red-100 px-1.5 text-red-600" : "text-gray-400"}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===================== TAB: ROSTER ===================== */}
      {/* L'EFFECTIF PUBLIC, pour tous ceux qui ne le gèrent pas : par poste,
          une ligne par joueur, le manager et le staff en tête. Voir
          EffectifParPoste. Le manager garde sa liste à lui, plus bas, avec
          ses dossards à saisir et ses boutons. */}
      {ongletOuvert === "roster" && !isTeamManager && (
        <EffectifParPoste
          joueurs={lignesEffectif}
          feminin={team.category === "women"}
          manager={fiche?.manager
            ? { nom: fiche.manager.nom, photo: fiche.manager.photo, lien: `/profile/${fiche.manager.uid}` }
            : null}
          staff={fiche?.staff ?? (team.staff ?? []).map((m) => ({ nom: m.name, titre: m.title }))}
          vide={t.effectifVide}
        />
      )}
      {ongletOuvert === "roster" && isTeamManager && (
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
            /**
             * L'EFFECTIF SE LIT COMME UNE FEUILLE DE MATCH : du but vers
             * l'attaque. Il sortait dans l'ordre où Firestore rend les
             * documents, c'est-à-dire dans aucun — un gardien entre deux
             * attaquants, et rien pour s'y retrouver.
             *
             * L'ordre canonique est celui de `POSTES`, le même que la
             * composition et le terrain. `normaliserPoste` lit ce qui traîne
             * en base — l'anglais typé, le français accentué ou non, les
             * initiales — et un poste non renseigné n'est pas une erreur :
             * ces joueurs ferment la liste, par nom, plutôt que de se ranger
             * arbitrairement chez les gardiens.
             */
            const rangDuPoste = (brut: string | null | undefined): number => {
              const poste = normaliserPoste(brut);
              return poste ? POSTES.indexOf(poste) : POSTES.length;
            };
            const parPoste = <T,>(liste: T[], poste: (x: T) => string | null | undefined, nom: (x: T) => string) =>
              [...liste].sort((a, b) => rangDuPoste(poste(a)) - rangDuPoste(poste(b)) || nom(a).localeCompare(nom(b)));

            const realPlayers = parPoste(
              members.filter((m) => m.uid !== team.managerId),
              (m) => m.position,
              (m) => `${m.firstName} ${m.lastName}`,
            );
            const fantomesTries = parPoste(
              ghostPlayers,
              (g) => g.position,
              (g) => `${g.firstName} ${g.lastName}`,
            );
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
                            {pos && <span className={`ml-1 px-1.5 py-0.5 text-xs font-medium ${POSITION_COLORS[pos] ?? "bg-gray-100 text-gray-600"}`}>{libellePoste(pos, "fr", genreDuJoueur(member.gender, team.category)) ?? POSITION_LABELS[pos] ?? pos}</span>}
                          </div>
                          {/* Condition déclarée, forme calculée : ce que le
                              manager regarde avant de cocher « titulaire ». */}
                          <PastillesEtatDeForme
                            className="mt-1.5"
                            condition={member.condition}
                            forme={formes[cleFormeCompte(member.uid)]}
                          />
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
                              placeholder="–"
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
                {fantomesTries.map((ghost, i) => {
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
                              {libellePoste(ghost.position, "fr", genreDuJoueur(null, team.category)) ?? POSITION_LABELS[ghost.position] ?? ghost.position}
                            </span>
                          </div>
                          <PastillesEtatDeForme
                            className="mt-1.5"
                            condition={ghost.condition}
                            forme={formes[cleFormeLigne(teamId, ghost.id)]}
                          />
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
                            onClick={() => setConditionCible(ghost)}
                            className="flex items-center gap-1 border border-gray-200/70 px-2 sm:px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                            <HeartPulse size={12} /> <span>Condition</span>
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
                <Plus size={16} /> {team.category === "women" ? "Ajouter une joueuse" : "Ajouter un joueur"}
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
      {/* Les matchs du club, amicaux ET compétitions, vus du club : voir
          MatchsDuClub. Les membres y lisent en plus qui a confirmé. */}
      {ongletOuvert === "matches" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <MatchsDuClub matchs={matchsPublics} presence={presences} />
          {/* Ce bouton est resté « bientôt » et grisé alors que le parcours
              de création existe : le manager arrivait sur l'onglet Matchs de
              sa propre équipe et n'avait aucun moyen d'en programmer un. */}
          {isTeamManager && (
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
      {ongletOuvert === "palmares" && (
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
                    <p className="text-xs text-gray-400">{new Date(ach.date).toLocaleDateString(LOCALE[langue], { month: "long", year: "numeric" })}</p>
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
              <p className="mt-3 text-sm text-gray-500">{t.aucunTrophee}</p>
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
      {ongletOuvert === "gallery" && (
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
              <p className="mt-3 text-sm text-gray-500">{t.aucunePhoto}</p>
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
      {ongletOuvert === "trainings" && (
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
                      <span className="flex items-center gap-1"><Calendar size={11} /> {t.quandEntrainement(dateAvecJour(new Date(training.date), langue), training.time)}</span>
                      <span className="flex items-center gap-1"><MapPin size={11} /> {training.location}</span>
                      <span className="flex items-center gap-1"><Users size={11} /> {t.confirmes(confirmedCount, training.attendees.length)}</span>
                    </div>
                    {training.description && <p className="mt-2 text-sm text-gray-500">{training.description}</p>}
                  </div>
                  <div className="flex flex-wrap shrink-0 items-center gap-2">
                    {/* Player response */}
                    {myAttendee && myAttendee.status === "pending" && (
                      <>
                        <button onClick={() => respondToTraining(training.id, user!.uid, "confirmed").then(() => toast.success(t.presenceConfirmee))}
                          className="flex items-center gap-1 bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700">
                          <Check size={12} /> {t.present}
                        </button>
                        <button onClick={() => respondToTraining(training.id, user!.uid, "declined").then(() => toast.success(t.absenceSignalee))}
                          className="flex items-center gap-1 border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                          <X size={12} /> {t.absent}
                        </button>
                      </>
                    )}
                    {myAttendee && myAttendee.status !== "pending" && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${myAttendee.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {myAttendee.status === "confirmed" ? t.present : t.absent}
                      </span>
                    )}
                    {isTeamManager && (
                      <button onClick={() => deleteTraining(training.id).then(() => toast.success(t.entrainementSupprime))}
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
              <p className="mt-3 text-sm text-gray-500">{t.aucunEntrainement}</p>
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
      {ongletOuvert === "candidatures" && isTeamManager && (
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
                      <span className="text-gray-400">·</span>
                      <span className="text-sm text-gray-600">{request.playerCity}</span>
                      {request.playerPosition && (
                        <>
                          <span className="text-gray-400">·</span>
                          <span className="text-sm text-gray-600">{request.playerPosition}</span>
                        </>
                      )}
                      {request.playerLevel && (
                        <>
                          <span className="text-gray-400">·</span>
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

      {/* ============ ONGLET : COMPOSITIONS TYPES (manager seul) ============

          À côté de l'effectif, parce qu'il en découle : on choisit ici, parmi
          les joueurs de la liste d'à côté, ceux qui composent le onze de
          chaque format. Voir components/team/CompositionsTypes. */}
      {ongletOuvert === "compositions" && isTeamManager && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <CompositionsTypes
            teamId={team.id}
            members={members}
            ghostPlayers={ghostPlayers}
            squadNumbers={teamSquadNumbers}
            compositions={team.compositionsTypes ?? {}}
            onSaved={fetchTeam}
          />
        </motion.div>
      )}

      {/* ===================== TAB: SETTINGS (Manager only) ===================== */}
      {ongletOuvert === "settings" && isTeamManager && (
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
              <Trash2 size={14} />{" "}Supprimer l&apos;equipe
            </button>
          </div>
          )}
        </motion.div>
      )}

        </div>
      </div>

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
      <AnimatePresence>
        {conditionCible && (
          <ConditionFantomeModal
            ghost={conditionCible}
            teamId={teamId}
            onClose={() => setConditionCible(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
