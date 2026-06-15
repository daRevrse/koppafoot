"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy, ArrowLeft, Save, Loader2, Settings, Calendar, MapPin,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { createCompetition, slugify } from "@/lib/competition-firestore";
import toast from "react-hot-toast";

interface FormState {
  name: string;
  description: string;
  groupCount: number;
  teamsPerGroup: number;
  qualifiersPerGroup: number;
  hasThirdPlace: boolean;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  startDate: string;
  endDate: string;
  venueCity: string;
}

const INITIAL: FormState = {
  name: "",
  description: "",
  groupCount: 4,
  teamsPerGroup: 4,
  qualifiersPerGroup: 2,
  hasThirdPlace: true,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  startDate: "",
  endDate: "",
  venueCity: "",
};

export default function NewCompetitionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const slugPreview = slugify(form.name);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
        format: {
          group_count: form.groupCount,
          teams_per_group: form.teamsPerGroup,
          qualifiers_per_group: form.qualifiersPerGroup,
          has_third_place: form.hasThirdPlace,
          points: {
            win: form.pointsWin,
            draw: form.pointsDraw,
            loss: form.pointsLoss,
          },
        },
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        venueCity: venueCity || null,
        createdBy: user.uid,
      });
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
          className="rounded-full border border-gray-200 bg-white p-2 text-gray-500 shadow-sm transition-colors hover:text-primary-600"
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
        <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
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
              className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
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
              className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </div>
        </div>

        {/* Format */}
        <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Settings size={16} className="text-primary-500" />
            Format
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de groupes</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                value={form.groupCount}
                onChange={(e) => update("groupCount", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Équipes / groupe</label>
              <input
                type="number"
                min={2}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                value={form.teamsPerGroup}
                onChange={(e) => update("teamsPerGroup", parseInt(e.target.value, 10) || 0)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Qualifiés / groupe</label>
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                value={form.qualifiersPerGroup}
                onChange={(e) => update("qualifiersPerGroup", parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={form.hasThirdPlace}
              onChange={(e) => update("hasThirdPlace", e.target.checked)}
            />
            <span className="text-sm text-gray-700">Match pour la 3ᵉ place</span>
          </label>

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">Points</p>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Victoire</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                  value={form.pointsWin}
                  onChange={(e) => update("pointsWin", parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Nul</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                  value={form.pointsDraw}
                  onChange={(e) => update("pointsDraw", parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Défaite</label>
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                  value={form.pointsLoss}
                  onChange={(e) => update("pointsLoss", parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule & location */}
        <div className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Calendar size={16} className="text-primary-500" />
            Dates et lieu <span className="font-normal text-gray-400">(optionnel)</span>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date de début</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date de fin</label>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
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
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-4 focus:border-primary-500 focus:outline-none"
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
            className="rounded-lg px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Créer la compétition
          </button>
        </div>
      </form>
    </div>
  );
}
