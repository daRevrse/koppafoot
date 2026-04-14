"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { Camera, Save, Loader2, Shield, Mail, Phone, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePhoto } from "@/lib/storage";

// ============================================
// Schema
// ============================================

const schema = yup.object({
  firstName: yup.string().min(2, "Min. 2 caractères").required("Requis"),
  lastName: yup.string().min(2, "Min. 2 caractères").required("Requis"),
  phone: yup.string().optional(),
  locationCity: yup.string().optional(),
});

type FormData = yup.InferType<typeof schema>;

// ============================================
// Admin Profile
// ============================================

export default function AdminProfilePage() {
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
          locationCity: user.locationCity ?? "",
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
        location_city: data.locationCity || "",
      });
      toast.success("Profil mis à jour");
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const PERMISSIONS = [
    "Gestion des utilisateurs",
    "Gestion des équipes",
    "Gestion des matchs",
    "Gestion des terrains",
    "Gestion des arbitres",
    "Modération des signalements",
    "Bannissements",
    "Consultation des logs",
    "Statistiques système",
    "Paramètres globaux",
  ];

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-xl font-bold text-white">
              {user.profilePictureUrl ? (
                <img src={user.profilePictureUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700"
            >
              {uploadingAvatar ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          {/* Info */}
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{user.firstName} {user.lastName}</h1>
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              <Shield size={12} /> Super Administrateur
            </span>
            {memberSince && (
              <p className="mt-1 text-xs text-gray-500">Membre depuis le {memberSince}</p>
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
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Left column */}
        <div className="space-y-6">
          {/* Coordonnées or Edit form */}
          {!editing ? (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Coordonnées</h3>
              <div className="divide-y divide-gray-100">
                <div className="flex items-start gap-3 py-3">
                  <Mail size={18} className="mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm font-medium text-gray-900">{user.email || "Non renseigné"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-3">
                  <Phone size={18} className="mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Téléphone</p>
                    <p className="text-sm font-medium text-gray-900">{user.phone || "Non renseigné"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 py-3">
                  <MapPin size={18} className="mt-0.5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">Ville</p>
                    <p className="text-sm font-medium text-gray-900">{user.locationCity || "Non renseigné"}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-semibold text-gray-900">Modifier le profil</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Prénom</label>
                  <input {...register("firstName")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" />
                  {errors.firstName && <p className="mt-1 text-xs text-red-600">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                  <input {...register("lastName")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" />
                  {errors.lastName && <p className="mt-1 text-xs text-red-600">{errors.lastName.message}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Téléphone</label>
                  <input {...register("phone")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
                  <input {...register("locationCity")} className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600" />
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
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Enregistrer
                </button>
              </div>
            </form>
          )}

          {/* Sécurité */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Sécurité</h3>
            <div className="space-y-3">
              <button className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">
                Changer le mot de passe
              </button>
              <button className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50">
                Activer l&apos;authentification à deux facteurs
              </button>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Permissions */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Permissions</h3>
            <ul className="space-y-2">
              {PERMISSIONS.map((perm) => (
                <li key={perm} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600">✓</span>
                  {perm}
                </li>
              ))}
            </ul>
          </div>

          {/* Stats système */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Statistiques système</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-blue-600">—</p>
                <p className="mt-0.5 text-xs text-gray-500">Utilisateurs</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-green-600">—</p>
                <p className="mt-0.5 text-xs text-gray-500">Équipes</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-purple-600">—</p>
                <p className="mt-0.5 text-xs text-gray-500">Terrains</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-orange-600">—</p>
                <p className="mt-0.5 text-xs text-gray-500">Matchs</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
