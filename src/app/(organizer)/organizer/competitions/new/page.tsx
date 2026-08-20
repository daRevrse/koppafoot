"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy, ArrowLeft, Save, Loader2, Settings, Calendar, MapPin,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createCompetition, updateCompetition, slugify } from "@/lib/competition-firestore";
import { defaultFormat } from "@/lib/competition-format";
import { uploadCompetitionLogo, uploadCompetitionBanner } from "@/lib/storage";
import ImageUploadField from "@/components/ui/ImageUploadField";
import CompetitionTypePicker from "@/components/competition/CompetitionTypePicker";
import CompetitionFormatFields from "@/components/competition/CompetitionFormatFields";
import toast from "react-hot-toast";
import type { CompetitionFormat, CompetitionType } from "@/types";

interface FormState {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  venueCity: string;
}

const INITIAL: FormState = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  venueCity: "",
};

export default function NewCompetitionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [type, setType] = useState<CompetitionType>("groups_knockout");
  const [format, setFormat] = useState<CompetitionFormat>(() => defaultFormat("groups_knockout"));
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slugPreview = slugify(form.name);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Switching type resets the format: the fields that matter are different
  // per shape, and carrying stale numbers over produces nonsense defaults.
  // Le NvN et la durée des matchs sont l'exception : ils décrivent le jeu et
  // pas la forme du tournoi, donc ils suivent le changement de type.
  const changeType = (next: CompetitionType) => {
    setType(next);
    setFormat((prev) => ({
      ...defaultFormat(next),
      team_size: prev.team_size,
      half_duration: prev.half_duration,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.name.trim()) {
      toast.error("Le nom de la compétition est requis");
      return;
    }

    setSubmitting(true);
    try {
      const description = form.description.trim();
      const venueCity = form.venueCity.trim();
      const id = await createCompetition({
        name: form.name.trim(),
        ...(description ? { description } : {}),
        logoUrl: logoUrl.trim() || null,
        bannerUrl: bannerUrl.trim() || null,
        competitionType: type,
        format,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        venueCity: venueCity || null,
        createdBy: user.uid,
        // Recopié ici, pas résolu à la lecture : les pages publiques n'ont
        // pas accès aux profils. Renommer sa structure plus tard ne touche
        // pas les compétitions déjà créées.
        organizerName: user.organizerName ?? null,
      });

      // Uploaded files win over the URL fields.
      const patch: Record<string, string> = {};
      if (logoFile) patch.logo_url = await uploadCompetitionLogo(id, logoFile);
      if (bannerFile) patch.banner_url = await uploadCompetitionBanner(id, bannerFile);
      if (Object.keys(patch).length > 0) await updateCompetition(id, patch);

      toast.success("Compétition créée !");
      router.push(`/organizer/competitions/${id}`);
    } catch (err) {
      console.error("Error creating competition:", err);
      toast.error("Une erreur est survenue lors de la création");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/organizer"
          className="rounded-full border border-gray-200/70 bg-white p-2 text-gray-500 transition-colors hover:text-primary-600"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Nouvelle compétition</h1>
          <p className="text-sm text-gray-500">
            Définissez le format de votre tournoi. Vous pourrez ajouter les équipes ensuite.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <div className="space-y-5 border border-gray-200/70 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Trophy size={16} className="text-amber-500" />
            Informations générales
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Nom de la compétition
            </label>
            <input
              type="text"
              required
              placeholder="ex: Coupe d'été 2026"
              className="w-full border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
            />
            {slugPreview && (
              <p className="mt-1.5 text-xs text-gray-400">
                URL : <span className="font-mono text-gray-500">/{slugPreview}</span>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description <span className="font-normal text-gray-400">(optionnel)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Présentez votre compétition en quelques mots…"
              className="w-full resize-none border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <ImageUploadField
              label="Logo (optionnel)"
              url={logoUrl}
              onUrlChange={setLogoUrl}
              file={logoFile}
              onFile={setLogoFile}
              aspect="square"
              maxMb={2}
              hint="PNG, JPG ou WebP · 2 Mo max"
            />
            <ImageUploadField
              label="Bannière (optionnel)"
              url={bannerUrl}
              onUrlChange={setBannerUrl}
              file={bannerFile}
              onFile={setBannerFile}
              aspect="wide"
              maxMb={5}
              hint="Affichée en haut de la page compétition"
            />
          </div>
        </div>

        {/* Type */}
        <div className="space-y-4 border border-gray-200/70 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Trophy size={16} className="text-amber-500" />
            Type de compétition
          </div>
          <CompetitionTypePicker value={type} onChange={changeType} />
        </div>

        {/* Format */}
        <div className="space-y-5 border border-gray-200/70 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Settings size={16} className="text-primary-500" />
            Format
          </div>
          <CompetitionFormatFields
            type={type}
            format={format}
            onChange={(patch) => setFormat((prev) => ({ ...prev, ...patch }))}
          />
        </div>

        {/* Schedule & location */}
        <div className="space-y-5 border border-gray-200/70 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Calendar size={16} className="text-primary-500" />
            Dates et lieu <span className="font-normal text-gray-400">(optionnel)</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date de début</label>
              <input
                type="date"
                className="w-full border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date de fin</label>
              <input
                type="date"
                className="w-full border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none"
                value={form.endDate}
                onChange={(e) => update("endDate", e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="ex: Paris"
                className="w-full border border-gray-200/70 py-2 pl-9 pr-4 focus:border-primary-500 focus:outline-none"
                value={form.venueCity}
                onChange={(e) => update("venueCity", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/organizer"
            className=" px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Créer la compétition
          </button>
        </div>
      </form>
    </div>
  );
}
