"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Users, ArrowLeft, Plus, Loader2, Pencil, Trash2, X, Save, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  onCompetition,
  onCompTeams,
  addCompPlayer,
  updateCompPlayer,
  removeCompPlayer,
} from "@/lib/competition-firestore";
import type { Competition, CompTeam, CompPlayer } from "@/types";
import toast from "react-hot-toast";

const POSITIONS = ["Gardien", "Défenseur", "Milieu", "Attaquant"] as const;

interface PlayerFormState {
  name: string;
  number: string;
  position: string;
}

const EMPTY_FORM: PlayerFormState = {
  name: "",
  number: "",
  position: "",
};

/** Numeric-aware sort on dossard strings ("1", "9", "10"). */
function byNumber(a: CompPlayer, b: CompPlayer): number {
  const na = Number.parseInt(a.number, 10);
  const nb = Number.parseInt(b.number, 10);
  const va = Number.isNaN(na) ? Number.POSITIVE_INFINITY : na;
  const vb = Number.isNaN(nb) ? Number.POSITIVE_INFINITY : nb;
  if (va !== vb) return va - vb;
  return a.number.localeCompare(b.number);
}

export default function CompetitionRosterPage() {
  const params = useParams<{ cid: string; tid: string }>();
  const cid = params.cid;
  const tid = params.tid;
  const { user } = useAuth();
  const router = useRouter();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state: closed unless modalOpen; editing=null → create, otherwise edit.
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CompPlayer | null>(null);
  const [form, setForm] = useState<PlayerFormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state.
  const [deleting, setDeleting] = useState<CompPlayer | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  useEffect(() => {
    if (!cid) return;
    const unsubscribe = onCompetition(cid, setCompetition);
    return unsubscribe;
  }, [cid]);

  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    const unsubscribe = onCompTeams(cid, (next) => {
      setTeams(next);
      setLoading(false);
    });
    return unsubscribe;
  }, [cid]);

  // Guard: only organizers of this competition may view it.
  useEffect(() => {
    if (!user || !competition) return;
    if (!competition.organizerIds.includes(user.uid)) {
      router.replace("/organizer");
    }
  }, [user, competition, router]);

  const team = useMemo(() => teams.find((t) => t.id === tid), [teams, tid]);

  const players = useMemo(
    () => (team ? [...team.players].sort(byNumber) : []),
    [team],
  );

  const update = <K extends keyof PlayerFormState>(key: K, value: PlayerFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (player: CompPlayer) => {
    setEditing(player);
    setForm({
      name: player.name,
      number: player.number,
      position: player.position ?? "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const number = form.number.trim();
    const position = form.position.trim();
    if (!name) {
      toast.error("Le nom du joueur est requis");
      return;
    }
    if (!number) {
      toast.error("Le numéro de dossard est requis");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateCompPlayer(cid, tid, editing.id, { name, number, position });
        toast.success("Joueur mis à jour");
      } else {
        await addCompPlayer(cid, tid, { name, number, position: position || undefined });
        toast.success("Joueur ajouté");
      }
      setModalOpen(false);
    } catch (err) {
      console.error("Error saving player:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteSubmitting(true);
    try {
      await removeCompPlayer(cid, tid, deleting.id);
      toast.success("Joueur supprimé");
      setDeleting(null);
    } catch (err) {
      console.error("Error deleting player:", err);
      toast.error("Impossible de supprimer le joueur");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Loading until teams resolve.
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  // Team not found after load.
  if (!team) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href={`/organizer/competitions/${cid}/teams`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
        >
          <ArrowLeft size={16} />
          Équipes
        </Link>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
            <Shield size={26} className="text-gray-400" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Équipe introuvable</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Cette équipe n&apos;existe pas ou a été supprimée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}/teams`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Équipes
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
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
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-display text-2xl font-extrabold text-gray-900"
            >
              {team.name}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.05 }}
              className="mt-0.5 text-sm text-gray-500"
            >
              {players.length} joueur{players.length !== 1 ? "s" : ""} dans l&apos;effectif
            </motion.p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
        >
          <Plus size={16} />
          Ajouter un joueur
        </button>
      </div>

      {/* Body */}
      {players.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
            <Users size={26} className="text-primary-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucun joueur</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Ajoute le premier.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Plus size={16} />
            Ajouter un joueur
          </button>
        </motion.div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {players.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="group flex items-center gap-4 border-b border-gray-50 px-4 py-3 transition-colors last:border-b-0 hover:bg-gray-50/60"
            >
              {/* Dossard badge */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
                {player.number}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900">{player.name}</p>
                {player.position && (
                  <span className="mt-0.5 inline-block text-xs font-medium text-gray-500">
                    {player.position}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(player)}
                  aria-label={`Modifier ${player.name}`}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-primary-600"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleting(player)}
                  aria-label={`Supprimer ${player.name}`}
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
                  {editing ? "Modifier le joueur" : "Nouveau joueur"}
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Jean Dupont"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Dossard <span className="font-normal text-gray-400">(numéro)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={3}
                    placeholder="ex: 10"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:outline-none"
                    value={form.number}
                    onChange={(e) => update("number", e.target.value)}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Poste <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <select
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-primary-500 focus:outline-none"
                    value={form.position}
                    onChange={(e) => update("position", e.target.value)}
                  >
                    <option value="">—</option>
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
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
                Supprimer le joueur ?
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                <span className="font-semibold text-gray-700">{deleting.name}</span> sera retiré de
                l&apos;effectif. Cette action est irréversible.
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
