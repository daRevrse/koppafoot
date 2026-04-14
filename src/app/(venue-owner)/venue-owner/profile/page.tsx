"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { Camera, Save, Loader2, Mail, Phone, Building2, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePhoto } from "@/lib/storage";

// ============================================
// Schema
// ============================================

const schema = yup.object({
  firstName: yup.string().min(2, "Min. 2 caractères").required("Requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Requis"),
  phone: yup.string().optional(),
  companyName: yup.string().optional(),
  locationCity: yup.string().optional(),
  bio: yup.string().max(500, "Max. 500 caractères").optional(),
});

type FormData = yup.InferType<typeof schema>;

// ============================================
// Info Row
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
// Venue Owner Profile
// ============================================

export default function VenueOwnerProfilePage() {
  const { user, updateProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);

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
          companyName: user.companyName ?? "",
          locationCity: user.locationCity ?? "",
          bio: user.bio ?? "",
        }
      : undefined,
  });

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();

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

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      await updateProfile({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        company_name: data.companyName || undefined,
        location_city: data.locationCity || "",
        bio: data.bio || undefined,
      });
      toast.success("Profil mis à jour");
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
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
          {/* Name */}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Propriétaire de terrain
            </span>
            {user.companyName && (
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-500">
                <Building2 size={14} /> {user.companyName}
              </p>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Modifier
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-6">
        {!editing ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Coordonnées */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Coordonnées</h3>
              <div className="divide-y divide-gray-100">
                <InfoRow icon={Mail} label="Email" value={user.email} />
                <InfoRow icon={Phone} label="Téléphone" value={user.phone} />
                <InfoRow icon={MapPin} label="Ville" value={user.locationCity} />
                <InfoRow icon={Building2} label="Entreprise" value={user.companyName} />
              </div>
            </div>
            {/* Statistiques */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Statistiques</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary-600">—</p>
                  <p className="mt-1 text-xs text-gray-500">Terrains</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary-600">—</p>
                  <p className="mt-1 text-xs text-gray-500">Réservations</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary-600">—</p>
                  <p className="mt-1 text-xs text-gray-500">Ce mois</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4 text-center">
                  <p className="text-2xl font-bold text-primary-600">—</p>
                  <p className="mt-1 text-xs text-gray-500">Revenus</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-gray-200 bg-white p-6">
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
                <label className="mb-1 block text-sm font-medium text-gray-700">Entreprise</label>
                <input {...register("companyName")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600" />
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
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { reset(); setEditing(false); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
