"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import {
  Camera, Edit3, Save, X, Loader2, MapPin, Calendar, Mail, Phone,
  Trophy, ImageIcon, FileText, CreditCard, Plus, Trash2,
  Ruler, Weight, Footprints, Cake, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePhoto, uploadGalleryPhoto } from "@/lib/storage";
import { getPostsByUser } from "@/lib/firestore";
import { ROLE_LABELS } from "@/types";
import { ROLE_BADGE_COLORS } from "@/config/navigation";
import KoppaFootCard from "@/components/ui/KoppaFootCard";
import type { Post } from "@/types";

// ============================================
// Schema
// ============================================

const schema = yup.object({
  firstName: yup.string().min(2, "Min. 2 caractères").required("Requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Requis"),
  phone: yup.string().optional(),
  locationCity: yup.string().optional(),
  bio: yup.string().max(500, "Max. 500 caractères").optional(),
  // Player
  position: yup.string().optional(),
  skillLevel: yup.string().optional(),
  // Physical
  strongFoot: yup.string().optional(),
  height: yup.number().min(100).max(250).optional().nullable().transform((v) => (isNaN(v) ? null : v)),
  weight: yup.number().min(30).max(200).optional().nullable().transform((v) => (isNaN(v) ? null : v)),
  dateOfBirth: yup.string().optional(),
  // Manager
  teamName: yup.string().optional(),
  // Referee
  licenseNumber: yup.string().optional(),
  licenseLevel: yup.string().optional(),
  experienceYears: yup.number().min(0).optional().nullable(),
});

type FormData = yup.InferType<typeof schema>;
type TabType = "info" | "palmares" | "posts" | "galerie" | "carte";

// ============================================
// Info Row Component
// ============================================

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <Icon size={18} className="mt-0.5 text-gray-400" />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || "Non renseigné"}</p>
      </div>
    </div>
  );
}

// ============================================
// Physical Info Labels
// ============================================

const FOOT_LABELS: Record<string, string> = {
  left: "Gauche",
  right: "Droit",
  both: "Les deux",
};

function calculateAge(dateOfBirth: string): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ============================================
// Time ago helper
// ============================================

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  return `Il y a ${days}j`;
}

// ============================================
// Profile Page
// ============================================

export default function ProfilePage() {
  const { user, firebaseUser, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<TabType>("info");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  // Gallery state
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Palmares state
  const [trophyTitle, setTrophyTitle] = useState("");
  const [trophyYear, setTrophyYear] = useState(new Date().getFullYear());
  const [trophyDesc, setTrophyDesc] = useState("");
  const [addingTrophy, setAddingTrophy] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormData>({
    resolver: yupResolver(schema) as any,
    values: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? "",
          locationCity: user.locationCity ?? "",
          bio: user.bio ?? "",
          strongFoot: user.strongFoot ?? "",
          height: user.height ?? null,
          weight: user.weight ?? null,
          dateOfBirth: user.dateOfBirth ?? "",
        }
      : undefined,
  });

  // Load posts when tab changes
  useEffect(() => {
    if (tab === "posts" && user) {
      setLoadingPosts(true);
      getPostsByUser(user.uid, user.uid).then((data) => {
        setPosts(data);
        setLoadingPosts(false);
      });
    }
  }, [tab, user]);

  if (!user) return null;

  const badgeColor = ROLE_BADGE_COLORS[user.userType];
  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : "";

  // Photo upload handlers
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadProfilePhoto(user.uid, file, "avatar");
      await updateProfile({ profile_picture_url: url });
      toast.success("Photo de profil mise à jour");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadProfilePhoto(user.uid, file, "cover");
      await updateProfile({ cover_photo_url: url });
      toast.success("Photo de couverture mise à jour");
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingCover(false);
    }
  };

  // Gallery upload
  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingGallery(true);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadGalleryPhoto(user.uid, file);
        newUrls.push(url);
      }
      const currentGallery = user.galleryPhotos ?? [];
      await updateProfile({ gallery_photos: [...currentGallery, ...newUrls] });
      toast.success(`${newUrls.length} photo(s) ajoutée(s)`);
    } catch {
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploadingGallery(false);
      if (galleryRef.current) galleryRef.current.value = "";
    }
  };

  const handleRemoveGalleryPhoto = async (urlToRemove: string) => {
    const updated = (user.galleryPhotos ?? []).filter((u) => u !== urlToRemove);
    await updateProfile({ gallery_photos: updated });
    toast.success("Photo supprimée");
  };

  // Trophy management
  const handleAddTrophy = async () => {
    if (!trophyTitle.trim()) return;
    setAddingTrophy(true);
    try {
      const currentTrophies = user.trophies ?? [];
      const newTrophy = {
        title: trophyTitle.trim(),
        year: trophyYear,
        ...(trophyDesc.trim() && { description: trophyDesc.trim() }),
      };
      await updateProfile({ trophies: [...currentTrophies, newTrophy] } as any);
      setTrophyTitle("");
      setTrophyDesc("");
      toast.success("Trophée ajouté");
    } catch {
      toast.error("Erreur");
    } finally {
      setAddingTrophy(false);
    }
  };

  const handleRemoveTrophy = async (index: number) => {
    const current = [...(user.trophies ?? [])];
    current.splice(index, 1);
    await updateProfile({ trophies: current } as any);
    toast.success("Trophée supprimé");
  };

  // Save profile
  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await updateProfile({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        location_city: data.locationCity || "",
        bio: data.bio || undefined,
        // Physical
        strong_foot: (data.strongFoot as "left" | "right" | "both") || undefined,
        height: data.height ?? undefined,
        weight: data.weight ?? undefined,
        date_of_birth: data.dateOfBirth || undefined,
        ...(user.userType === "player" && {
          position: data.position || undefined,
          skill_level: data.skillLevel || undefined,
        }),
        ...(user.userType === "referee" && {
          license_number: data.licenseNumber || undefined,
          license_level: data.licenseLevel || undefined,
          experience_years: data.experienceYears ?? undefined,
        }),
      });
      toast.success("Profil mis à jour");
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    reset();
    setEditing(false);
  };

  const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : null;

  // Tab definitions
  const tabs: { key: TabType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: "info", label: "Informations", icon: FileText },
    { key: "palmares", label: "Palmarès", icon: Trophy },
    { key: "posts", label: "Posts", icon: FileText },
    { key: "galerie", label: "Galerie", icon: ImageIcon },
    ...(user.userType === "player"
      ? [{ key: "carte" as TabType, label: "Carte FUT", icon: CreditCard }]
      : []),
  ];

  return (
    <div className="mx-auto max-w-4xl">
      {/* Cover photo */}
      <div className="relative h-48 overflow-hidden rounded-t-xl bg-gradient-to-r from-primary-600 to-primary-400 md:h-56">
        {user.coverPhotoUrl && (
          <img src={user.coverPhotoUrl} alt="" className="h-full w-full object-cover" />
        )}
        <button
          onClick={() => coverRef.current?.click()}
          disabled={uploadingCover}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-black/40 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-black/60"
        >
          {uploadingCover ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          Couverture
        </button>
        <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
      </div>

      {/* Avatar + name */}
      <div className="relative rounded-b-xl border border-t-0 border-gray-200 bg-white px-4 pb-6 lg:px-8">
        <div className="flex flex-col items-center lg:flex-row lg:items-end lg:gap-6">
          <div className="relative -mt-12 lg:-mt-16">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary-100 text-2xl font-bold text-primary-700 shadow-xl lg:h-32 lg:w-32 lg:text-4xl">
              {user.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg ring-4 ring-white hover:bg-primary-700 transition-transform active:scale-90 lg:h-10 lg:w-10"
            >
              {uploadingAvatar ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="mt-4 flex-1 text-center lg:mt-0 lg:pt-4 lg:text-left">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 lg:text-3xl">
              {user.firstName} {user.lastName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2 lg:justify-start lg:gap-3">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${badgeColor}`}>
                {ROLE_LABELS[user.userType]}
              </span>
              {user.locationCity && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <MapPin size={14} className="text-gray-400" /> {user.locationCity}
                </span>
              )}
              {memberSince && (
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar size={14} className="text-gray-400" /> {memberSince}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm text-gray-500">
                <Users size={14} className="text-gray-400" /> {user.followersCount ?? 0} {user.followersCount && user.followersCount > 1 ? "abonnés" : "abonné"}
              </span>
            </div>
          </div>

          <div className="mt-6 flex w-full flex-col items-center gap-4 lg:mt-0 lg:w-auto lg:flex-row lg:gap-5">
            <Link
              href={`/profile/${user.uid}`}
              className="text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-700 hover:underline lg:order-last"
            >
              Voir mon profil public →
            </Link>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md active:scale-[0.98] lg:w-auto lg:px-5 lg:py-2.5"
              >
                <Edit3 size={18} className="text-gray-400" />
                Modifier mon profil
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1 scrollbar-hide">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors whitespace-nowrap px-3 ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mt-6">
        {/* ═══════════════ TAB: INFO (read) ═══════════════ */}
        {tab === "info" && !editing && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Bio */}
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Bio</h3>
              <p className="text-sm text-gray-600">{user.bio || "Aucune bio renseignée."}</p>
            </div>
            {/* Coordonnées */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 md:col-span-2">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Coordonnées</h3>
              <div className="divide-y divide-gray-100">
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Téléphone" value={user.phone} />
                <InfoRow icon={MapPin} label="Ville" value={user.locationCity} />
              </div>
            </div>
            {/* Physical Info Card */}
            {(user.userType === "player" || user.userType === "referee") && (
              <div className="rounded-lg border border-gray-200 bg-white p-5 md:col-span-3">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Ruler size={16} className="text-emerald-600" />
                  Informations physiques
                </h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                    <Footprints size={20} className="mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs text-gray-500">Pied fort</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {user.strongFoot ? FOOT_LABELS[user.strongFoot] : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                    <Ruler size={20} className="mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs text-gray-500">Taille</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {user.height ? `${user.height} cm` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                    <Weight size={20} className="mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs text-gray-500">Poids</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {user.weight ? `${user.weight} kg` : "—"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                    <Cake size={20} className="mx-auto text-emerald-500 mb-1" />
                    <p className="text-xs text-gray-500">Âge</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {age !== null ? `${age} ans` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: INFO (edit) ═══════════════ */}
        {tab === "info" && editing && (
          <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
                <input {...register("firstName")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                <input {...register("lastName")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
                <input {...register("phone")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
                <input {...register("locationCity")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">Bio</label>
                <textarea {...register("bio")} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
                {errors.bio && <p className="mt-1 text-xs text-red-600">{errors.bio.message}</p>}
              </div>

              {/* Physical info */}
              {(user.userType === "player" || user.userType === "referee") && (
                <div className="md:col-span-2">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Ruler size={16} className="text-emerald-600" /> Informations physiques
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Pied fort</label>
                      <select {...register("strongFoot")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                        <option value="">Non spécifié</option>
                        <option value="right">Droit</option>
                        <option value="left">Gauche</option>
                        <option value="both">Les deux</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Taille (cm)</label>
                      <input type="number" min="100" max="250" {...register("height")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Poids (kg)</label>
                      <input type="number" min="30" max="200" {...register("weight")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Date de naissance</label>
                      <input type="date" {...register("dateOfBirth")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Player-specific */}
              {user.userType === "player" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Poste</label>
                    <select {...register("position")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                      <option value="">Non spécifié</option>
                      <option value="goalkeeper">Gardien</option>
                      <option value="defender">Défenseur</option>
                      <option value="midfielder">Milieu</option>
                      <option value="forward">Attaquant</option>
                      <option value="any">Polyvalent</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Niveau</label>
                    <select {...register("skillLevel")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                      <option value="">Non spécifié</option>
                      <option value="beginner">Débutant</option>
                      <option value="amateur">Amateur</option>
                      <option value="intermediate">Intermédiaire</option>
                      <option value="advanced">Avancé</option>
                    </select>
                  </div>
                </>
              )}

              {/* Referee-specific */}
              {user.userType === "referee" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">N° licence</label>
                    <input {...register("licenseNumber")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Niveau licence</label>
                    <select {...register("licenseLevel")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none">
                      <option value="">Non spécifié</option>
                      <option value="trainee">Stagiaire</option>
                      <option value="regional">Régional</option>
                      <option value="national">National</option>
                      <option value="international">International</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Années d&apos;expérience</label>
                    <input type="number" min="0" {...register("experienceYears")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none" />
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <X size={14} /> Annuler
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </form>
        )}

        {/* ═══════════════ TAB: PALMARÈS ═══════════════ */}
        {tab === "palmares" && (
          <div className="space-y-6">
            {/* Add trophy form */}
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Trophy size={16} className="text-amber-500" /> Ajouter un trophée
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={trophyTitle}
                  onChange={(e) => setTrophyTitle(e.target.value)}
                  placeholder="Titre (ex: Champion régional)"
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
                <input
                  type="number"
                  value={trophyYear}
                  onChange={(e) => setTrophyYear(parseInt(e.target.value))}
                  min={1990}
                  max={new Date().getFullYear()}
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                />
                <input
                  value={trophyDesc}
                  onChange={(e) => setTrophyDesc(e.target.value)}
                  placeholder="Description (optionnel)"
                  className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none"
                />
              </div>
              <button
                onClick={handleAddTrophy}
                disabled={!trophyTitle.trim() || addingTrophy}
                className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {addingTrophy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter
              </button>
            </div>

            {/* Trophies list */}
            {(user.trophies ?? []).length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white py-12 text-center">
                <Trophy size={32} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-500">Aucun trophée pour le moment</p>
                <p className="mt-1 text-xs text-gray-400">Ajoutez vos accomplissements sportifs ci-dessus</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(user.trophies ?? []).map((trophy, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                      <Trophy size={20} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{trophy.title}</p>
                      <p className="text-xs text-gray-500">{trophy.year}</p>
                      {trophy.description && (
                        <p className="mt-1 text-xs text-gray-400">{trophy.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveTrophy(i)}
                      className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: POSTS ═══════════════ */}
        {tab === "posts" && (
          <div className="space-y-4">
            {loadingPosts ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-emerald-500" />
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white py-12 text-center">
                <FileText size={32} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-500">Aucun post publié</p>
                <Link href="/feed" className="mt-2 inline-block text-sm text-emerald-600 hover:underline">
                  Aller sur La Tribune →
                </Link>
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{post.content}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>{timeAgo(post.createdAt)}</span>
                    <span>❤️ {post.likes.length}</span>
                    <span>💬 {post.commentCount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ═══════════════ TAB: GALERIE ═══════════════ */}
        {tab === "galerie" && (
          <div className="space-y-6">
            {/* Upload button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => galleryRef.current?.click()}
                disabled={uploadingGallery}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {uploadingGallery ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ajouter des photos
              </button>
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleGalleryUpload}
              />
              <span className="text-xs text-gray-400">{(user.galleryPhotos ?? []).length} photo(s)</span>
            </div>

            {/* Gallery grid */}
            {(user.galleryPhotos ?? []).length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-200 bg-white py-12 text-center">
                <ImageIcon size={32} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-500">Aucune photo dans la galerie</p>
                <p className="mt-1 text-xs text-gray-400">Ajoutez des photos pour enrichir votre profil public</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {(user.galleryPhotos ?? []).map((url, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => handleRemoveGalleryPhoto(url)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ TAB: CARTE FUT ═══════════════ */}
        {tab === "carte" && user.userType === "player" && (
          <div className="flex flex-col items-center rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-emerald-50 p-8">
            <h3 className="mb-2 text-lg font-bold text-gray-900 font-display">Ma Carte KoppaFoot</h3>
            <p className="mb-6 text-sm text-gray-500">Télécharge ta carte style FUT avec tes infos</p>
            <KoppaFootCard profile={user} width={320} />
          </div>
        )}
      </div>
    </div>
  );
}
