"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { Camera, Edit3, Save, X, Loader2, MapPin, Calendar, Mail, Phone } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePhoto } from "@/lib/storage";
import { ROLE_LABELS } from "@/types";
import { ROLE_BADGE_COLORS } from "@/config/navigation";

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
  // Manager
  teamName: yup.string().optional(),
  // Referee
  licenseNumber: yup.string().optional(),
  licenseLevel: yup.string().optional(),
  experienceYears: yup.number().min(0).optional().nullable(),
});

type FormData = yup.InferType<typeof schema>;

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
// Profile Page
// ============================================

export default function ProfilePage() {
  const { user, firebaseUser, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<"info" | "stats">("info");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

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
        }
      : undefined,
  });

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
      <div className="relative rounded-b-xl border border-t-0 border-gray-200 bg-white px-6 pb-6">
        <div className="flex items-end gap-4">
          <div className="relative -mt-12">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-primary-100 text-2xl font-bold text-primary-700 shadow-md">
              {user.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-primary-600 text-white shadow hover:bg-primary-700"
            >
              {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="flex-1 pt-3">
            <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
                {ROLE_LABELS[user.userType]}
              </span>
              {user.locationCity && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPin size={12} /> {user.locationCity}
                </span>
              )}
              {memberSince && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar size={12} /> Membre depuis {memberSince}
                </span>
              )}
            </div>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Edit3 size={14} /> Modifier
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab("info")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "info" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Informations
        </button>
        <button
          onClick={() => setTab("stats")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
            tab === "stats" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Statistiques
        </button>
      </div>

      {/* Content */}
      <div className="mt-6">
        {tab === "info" && !editing && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Bio */}
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Bio</h3>
              <p className="text-sm text-gray-600">{user.bio || "Aucune bio renseignée."}</p>
            </div>
            {/* Info */}
            <div className="rounded-lg border border-gray-200 bg-white p-5 md:col-span-2">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Coordonnées</h3>
              <div className="divide-y divide-gray-100">
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Téléphone" value={user.phone} />
                <InfoRow icon={MapPin} label="Ville" value={user.locationCity} />
              </div>
            </div>
          </div>
        )}

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

        {tab === "stats" && (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">Les statistiques seront disponibles prochainement.</p>
          </div>
        )}
      </div>
    </div>
  );
}
