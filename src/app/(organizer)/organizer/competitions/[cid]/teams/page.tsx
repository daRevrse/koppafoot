"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, ArrowLeft, Plus, Loader2, Pencil, Trash2, X, Save, Shield, Upload,
} from "lucide-react";
import {
  onCompTeams,
  createCompTeam,
  updateCompTeam,
  deleteCompTeam,
  syncTeamToMatches,
} from "@/lib/competition-firestore";
import { uploadTeamLogo } from "@/lib/storage";
import type { CompTeam } from "@/types";
import toast from "react-hot-toast";

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#22c55e", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#1f2937",
];

interface TeamFormState {
  name: string;
  shortName: string;
  color: string;
  logoUrl: string;
}

const EMPTY_FORM: TeamFormState = {
  name: "",
  shortName: "",
  color: COLOR_PRESETS[7],
  logoUrl: "",
};

export default function CompetitionTeamsPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state: null = closed, otherwise create (no editing.id) or edit.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompTeam | null>(null);
  const [form, setForm] = useState<TeamFormState>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state.
  const [deleting, setDeleting] = useState<CompTeam | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    const unsubscribe = onCompTeams(cid, (next) => {
      setTeams(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [cid]);

  const update = <K extends keyof TeamFormState>(key: K, value: TeamFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const clearLogoFile = () => {
    setLogoFile(null);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisis une image (PNG, JPG, WebP).");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo trop lourd (2 Mo maximum).");
      return;
    }
    setLogoFile(file);
    setLogoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    clearLogoFile();
    setModalOpen(true);
  };

  const openEdit = (team: CompTeam) => {
    setEditing(team);
    setForm({
      name: team.name,
      shortName: team.shortName,
      color: team.color,
      logoUrl: team.logoUrl ?? "",
    });
    clearLogoFile();
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    clearLogoFile();
    setModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const shortName = form.shortName.trim();
    if (!name) {
      toast.error("Le nom de l'équipe est requis");
      return;
    }
    if (!shortName) {
      toast.error("L'abréviation est requise");
      return;
    }
    const logoUrl = form.logoUrl.trim() || null;

    setSubmitting(true);
    try {
      // Save the team first so we have an id for the logo upload path.
      let teamId: string;
      if (editing) {
        teamId = editing.id;
        await updateCompTeam(cid, teamId, {
          name,
          short_name: shortName,
          color: form.color,
          logo_url: logoUrl,
        });
      } else {
        teamId = await createCompTeam(cid, { name, shortName, color: form.color, logoUrl });
      }

      // Uploaded logo wins over the URL field.
      let finalLogo = logoUrl;
      if (logoFile) {
        finalLogo = await uploadTeamLogo(teamId, logoFile);
        await updateCompTeam(cid, teamId, { logo_url: finalLogo });
      }

      // Keep the match-level denormalised name/logo in sync so logos show
      // on match cards created before this edit.
      await syncTeamToMatches(cid, teamId, { name, logoUrl: finalLogo });

      toast.success(editing ? "Équipe mise à jour" : "Équipe ajoutée");
      clearLogoFile();
      setModalOpen(false);
    } catch (err) {
      console.error("Error saving team:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await deleteCompTeam(cid, deleting.id);
      toast.success("Équipe supprimée");
      setDeleting(null);
    } catch (err) {
      console.error("Error deleting team:", err);
      toast.error("Impossible de supprimer l'équipe");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-2xl font-extrabold text-gray-900"
          >
            Équipes
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-0.5 text-sm text-gray-500"
          >
            {teams.length} équipe{teams.length !== 1 ? "s" : ""} inscrite{teams.length !== 1 ? "s" : ""}
          </motion.p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/organizer/competitions/${cid}/import`}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Upload size={16} />
            Importer
          </Link>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Plus size={16} />
            Ajouter une équipe
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : teams.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <Users size={26} className="text-primary-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucune équipe</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Ajoutez la première équipe pour commencer à composer les poules et le calendrier.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Plus size={16} />
            Ajouter une équipe
          </button>
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {teams.map((team, i) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
            >
              {/* Logo or color swatch */}
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                style={team.logoUrl ? undefined : { backgroundColor: team.color }}
              >
                {team.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Shield size={20} className="text-white/90" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{team.name}</p>
                  {team.group && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      Poule {team.group}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/5"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {team.shortName}
                  </span>
                </div>
                <Link
                  href={`/organizer/competitions/${cid}/teams/${team.id}`}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700"
                >
                  <Users size={13} />
                  Effectif ({team.players.length})
                </Link>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(team)}
                  aria-label={`Modifier ${team.name}`}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(team)}
                  aria-label={`Supprimer ${team.name}`}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">
                  {editing ? "Modifier l'équipe" : "Nouvelle équipe"}
                </h2>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Nom de l&apos;équipe
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: FC Étoile"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Abréviation <span className="font-normal text-gray-400">(ex: 3 lettres)</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={5}
                    placeholder="ex: ETO"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 uppercase focus:border-primary-500 focus:outline-none"
                    value={form.shortName}
                    onChange={(e) => update("shortName", e.target.value.toUpperCase())}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Couleur</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => update("color", preset)}
                        aria-label={`Couleur ${preset}`}
                        className={`h-8 w-8 rounded-full transition-transform hover:scale-110 ${
                          form.color.toLowerCase() === preset.toLowerCase()
                            ? "ring-2 ring-gray-900 ring-offset-2"
                            : "ring-1 ring-black/5"
                        }`}
                        style={{ backgroundColor: preset }}
                      />
                    ))}
                    <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full ring-1 ring-black/10">
                      <span
                        className="block h-full w-full"
                        style={{ backgroundColor: form.color }}
                      />
                      <input
                        type="color"
                        value={form.color}
                        onChange={(e) => update("color", e.target.value)}
                        className="absolute inset-0 cursor-pointer opacity-0"
                        aria-label="Couleur personnalisée"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Logo <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <div className="flex items-center gap-3">
                    {/* Preview */}
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200"
                      style={logoPreview || form.logoUrl ? undefined : { backgroundColor: form.color }}
                    >
                      {logoPreview || form.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview ?? form.logoUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Shield size={22} className="text-white/90" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
                        <Upload size={15} />
                        {logoFile ? "Changer le fichier" : "Choisir un fichier"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onLogoFile(e.target.files?.[0])}
                        />
                      </label>
                      {logoFile ? (
                        <button
                          type="button"
                          onClick={clearLogoFile}
                          className="ml-2 text-xs font-medium text-gray-400 hover:text-red-500"
                        >
                          Retirer
                        </button>
                      ) : (
                        <p className="mt-1 truncate text-xs text-gray-400">
                          PNG, JPG ou WebP · 2 Mo max
                        </p>
                      )}
                    </div>
                  </div>

                  {/* URL fallback */}
                  <input
                    type="url"
                    placeholder="…ou coller une URL d'image"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    value={form.logoUrl}
                    onChange={(e) => update("logoUrl", e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editing ? "Enregistrer" : "Ajouter"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {deleting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleteSubmitting && setDeleting(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 size={22} className="text-red-600" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-gray-900">
                Supprimer l&apos;équipe ?
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{deleting.name}</span> sera retirée de la
                compétition. Cette action est irréversible.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleting(null)}
                  disabled={deleteSubmitting}
                  className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
