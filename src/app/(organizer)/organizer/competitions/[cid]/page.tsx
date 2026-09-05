"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, ArrowLeft, Loader2, Pencil, Save, X, Copy, Trash2, AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  onCompetition, updateCompetition, deleteCompetition, duplicateCompetition,
  onCompTeams, onCompMatches,
} from "@/lib/competition-firestore";
import { COMPETITION_TYPE_LABELS, statusFlow } from "@/lib/competition-format";
import { announce } from "@/lib/tribune-client";
import { uploadCompetitionLogo, uploadCompetitionBanner } from "@/lib/storage";
import ImageUploadField from "@/components/ui/ImageUploadField";
import CompetitionFormatFields from "@/components/competition/CompetitionFormatFields";
import CompetitionShareCard from "@/components/competition/CompetitionShareCard";
import OrganizerProgress from "@/components/competition/OrganizerProgress";
import toast from "react-hot-toast";
import type {
  Competition, CompetitionFormat, CompetitionStatus, CompTeam, CompMatch,
} from "@/types";

const STATUS_CONFIG: Record<CompetitionStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { label: "Inscriptions", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { label: "Phase de groupes", color: "text-amber-700", bg: "bg-amber-50" },
  knockout: { label: "Phase finale", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "Terminée", color: "text-emerald-700", bg: "bg-emerald-50" },
};

export default function CompetitionDashboardPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const { user } = useAuth();
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  // Teams and fixtures drive the progression below, every step reads its
  // state from the real documents rather than from a stored checklist.
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);

  // Settings modal
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fName, setFName] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fLogoUrl, setFLogoUrl] = useState("");
  const [fLogoFile, setFLogoFile] = useState<File | null>(null);
  const [fBannerUrl, setFBannerUrl] = useState("");
  const [fBannerFile, setFBannerFile] = useState<File | null>(null);
  const [fFormat, setFFormat] = useState<CompetitionFormat | null>(null);
  // Entry file, règlement and fee. Off unless the organizer fills them in.
  const [fRulesText, setFRulesText] = useState("");
  const [fRulesUrl, setFRulesUrl] = useState("");
  const [fRequireRules, setFRequireRules] = useState(false);
  const [fEntryFee, setFEntryFee] = useState("");
  const [fFeeCurrency, setFFeeCurrency] = useState("FCFA");

  // Danger zone
  const [statusSaving, setStatusSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!cid) return;
    const unsubscribe = onCompetition(cid, setCompetition);
    return unsubscribe;
  }, [cid]);

  // Live, like the rest of the console: a team added from another screen
  // ticks the step here without a reload.
  useEffect(() => {
    if (!cid) return;
    let seenTeams = false;
    let seenMatches = false;
    const settle = () => {
      if (seenTeams && seenMatches) setProgressLoading(false);
    };
    const stopTeams = onCompTeams(cid, (rows) => {
      setTeams(rows);
      seenTeams = true;
      settle();
    });
    const stopMatches = onCompMatches(cid, (rows) => {
      setMatches(rows);
      seenMatches = true;
      settle();
    });
    return () => { stopTeams(); stopMatches(); };
  }, [cid]);

  const openEdit = () => {
    if (!competition) return;
    setFName(competition.name);
    setFDesc(competition.description ?? "");
    setFLogoUrl(competition.logoUrl ?? "");
    setFLogoFile(null);
    setFBannerUrl(competition.bannerUrl ?? "");
    setFBannerFile(null);
    setFFormat({ ...competition.format, points: { ...competition.format.points } });
    setFRulesText(competition.rulesText ?? "");
    setFRulesUrl(competition.rulesUrl ?? "");
    setFRequireRules(competition.requireRulesAcceptance);
    setFEntryFee(competition.entryFee != null ? String(competition.entryFee) : "");
    setFFeeCurrency(competition.entryFeeCurrency || "FCFA");
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competition || !fName.trim()) {
      toast.error("Le nom est requis");
      return;
    }
    if (fEntryFee.trim() && !Number.isFinite(Number(fEntryFee))) {
      toast.error("Le montant des frais doit être un nombre");
      return;
    }
    setSaving(true);
    try {
      const patch: Record<string, unknown> = {
        name: fName.trim(),
        description: fDesc.trim() || null,
        logo_url: fLogoUrl.trim() || null,
        banner_url: fBannerUrl.trim() || null,
        ...(fFormat ? { format: fFormat } : {}),
        rules_text: fRulesText.trim() || null,
        rules_url: fRulesUrl.trim() || null,
        // Nothing to accept means nothing can be required.
        require_rules_acceptance:
          fRequireRules && Boolean(fRulesText.trim() || fRulesUrl.trim()),
        entry_fee: fEntryFee.trim() ? Number(fEntryFee) : null,
        entry_fee_currency: fFeeCurrency.trim() || "FCFA",
      };
      if (fLogoFile) patch.logo_url = await uploadCompetitionLogo(competition.id, fLogoFile);
      if (fBannerFile) patch.banner_url = await uploadCompetitionBanner(competition.id, fBannerFile);
      await updateCompetition(competition.id, patch);
      toast.success("Compétition mise à jour");
      setEditOpen(false);
    } catch (err) {
      console.error("Error updating competition:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: CompetitionStatus) => {
    if (!competition || status === competition.status) return;
    setStatusSaving(true);
    try {
      await updateCompetition(competition.id, { status });
      // Two milestones are worth the whole platform hearing about.
      if (status === "registration") {
        announce(competition.id, { kind: "registrations_open" });
      } else if (status === "completed") {
        announce(competition.id, { kind: "competition_completed" });
      }
      toast.success(
        status === "draft"
          ? "Compétition repassée en brouillon (invisible du public)"
          : "Statut mis à jour",
      );
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Une erreur est survenue");
    } finally {
      setStatusSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!competition || !user) return;
    setDuplicating(true);
    try {
      const newId = await duplicateCompetition(
        competition.id,
        `${competition.name} (copie)`,
        user.uid,
      );
      toast.success("Compétition dupliquée, équipes reprises, calendrier vierge");
      router.push(`/organizer/competitions/${newId}`);
    } catch (err) {
      console.error("Error duplicating competition:", err);
      toast.error("Une erreur est survenue lors de la duplication");
      setDuplicating(false);
    }
  };

  const handleDelete = async () => {
    if (!competition || deleteConfirm !== competition.name) return;
    setDeleting(true);
    try {
      await deleteCompetition(competition.id);
      toast.success("Compétition supprimée");
      router.push("/organizer");
    } catch (err) {
      console.error("Error deleting competition:", err);
      toast.error("Une erreur est survenue lors de la suppression");
      setDeleting(false);
    }
  };

  // Guard: only organizers of this competition may view it.
  useEffect(() => {
    if (!user || !competition) return;
    if (!competition.organizerIds.includes(user.uid)) {
      router.replace("/organizer");
    }
  }, [user, competition, router]);

  if (!competition) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[competition.status] ?? STATUS_CONFIG.draft;

  const type = competition.competitionType;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href="/organizer"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Mes compétitions
      </Link>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 border border-gray-200/70 bg-white p-6"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 to-orange-50">
          {competition.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={competition.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Trophy size={24} className="text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-gray-900">
            {competition.name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConf.bg} ${statusConf.color}`}
            >
              {statusConf.label}
            </span>
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
              {COMPETITION_TYPE_LABELS[type]}
            </span>
          </div>
        </div>
        <button
          onClick={openEdit}
          className="flex shrink-0 items-center gap-1.5 border border-gray-200/70 bg-white px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
        >
          <Pencil size={15} />
          <span className="hidden sm:inline">Modifier</span>
        </button>
      </motion.div>

      {/* The payoff first: a competition here produces a public page, and
          that page is what fills the competition. */}
      <CompetitionShareCard competition={competition} teamCount={teams.length} />

      {/* Then the sequence, what is done, what is next. */}
      <OrganizerProgress
        competition={competition}
        teams={teams}
        matches={matches}
        loading={progressLoading}
      />

      {/* Status control, a draft competition is invisible to the public, so
          publishing has to be an explicit act, not a side effect of
          generating fixtures. */}
      <div className=" border border-gray-200/70 bg-white p-5">
        <p className="text-sm font-bold text-gray-900">Statut</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {competition.status === "draft"
            ? "En brouillon : la compétition n'apparaît pas dans les compétitions publiques."
            : "Publiée : visible de tous dans les compétitions publiques."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {statusFlow(type).map((s) => {
            const conf = STATUS_CONFIG[s];
            const active = competition.status === s;
            return (
              <button
                key={s}
                type="button"
                disabled={statusSaving || active}
                onClick={() => changeStatus(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-default ${
                  active
                    ? `${conf.bg} ${conf.color} ring-2 ring-primary-200`
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                }`}
              >
                {conf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danger zone */}
      <div className=" border border-gray-200/70 bg-white p-5">
        <p className="text-sm font-bold text-gray-900">Actions</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicating}
            className="flex items-center gap-2 border border-gray-200/70 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            {duplicating ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
            Dupliquer
          </button>
          <button
            type="button"
            onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}
            className="flex items-center gap-2 border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 size={15} />
            Supprimer
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          La duplication reprend le type, le format et les équipes, sans le calendrier ni les résultats.
        </p>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {deleteOpen && (
          <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-md modal-sheet rounded-t-3xl bg-white p-6"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-red-50 text-red-500">
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-bold text-gray-900">
                    Supprimer la compétition
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Les équipes, le calendrier et tous les résultats seront définitivement
                    perdus. Cette action est irréversible.
                  </p>
                </div>
              </div>

              <label className="mt-4 block text-xs font-semibold text-gray-600">
                Tape <span className="font-mono text-gray-900">{competition.name}</span> pour confirmer
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="mt-1 w-full border border-gray-200/70 px-4 py-2 focus:border-red-400 focus:outline-none"
              />

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteOpen(false)}
                  className=" px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirm !== competition.name}
                  className="flex items-center gap-2 bg-red-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  Supprimer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings modal */}
      <AnimatePresence>
        {editOpen && (
          <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto modal-sheet rounded-t-3xl bg-white p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">
                  Modifier la compétition
                </h2>
                <button
                  onClick={() => !saving && setEditOpen(false)}
                  className=" p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={saveEdit} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Nom</label>
                  <input
                    type="text"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    className="w-full border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Description <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <textarea
                    rows={2}
                    value={fDesc}
                    onChange={(e) => setFDesc(e.target.value)}
                    className="w-full resize-none border border-gray-200/70 px-4 py-2 focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <ImageUploadField
                  label="Logo"
                  url={fLogoUrl}
                  onUrlChange={setFLogoUrl}
                  file={fLogoFile}
                  onFile={setFLogoFile}
                  aspect="square"
                  maxMb={10}
                  hint="Réduite et convertie en WebP automatiquement"
                />
                <ImageUploadField
                  label="Bannière"
                  url={fBannerUrl}
                  onUrlChange={setFBannerUrl}
                  file={fBannerFile}
                  onFile={setFBannerFile}
                  aspect="wide"
                  maxMb={10}
                  hint="Affichée en haut de la page compétition"
                />

                {fFormat && (
                  <div className="border-t border-gray-200/70 pt-4">
                    <p className="mb-1 text-sm font-semibold text-gray-900">
                      Format, {COMPETITION_TYPE_LABELS[type]}
                    </p>
                    <p className="mb-4 text-xs text-gray-400">
                      Le type ne peut pas changer après la création. Les modifications de
                      format ne réécrivent pas le calendrier déjà généré.
                    </p>
                    <CompetitionFormatFields
                      type={type}
                      format={fFormat}
                      onChange={(patch) => setFFormat((prev) => (prev ? { ...prev, ...patch } : prev))}
                    />
                  </div>
                )}

                <div className="border-t border-gray-200/70 pt-4">
                  <p className="mb-1 text-sm font-semibold text-gray-900">
                    Dossier d&apos;inscription
                  </p>
                  <p className="mb-4 text-xs text-gray-400">
                    Tout est facultatif. Laissé vide, l&apos;inscription reste en un clic,
                    chaque exigence ajoutée fait tomber des inscriptions.
                  </p>

                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Règlement <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <textarea
                    rows={4}
                    value={fRulesText}
                    onChange={(e) => setFRulesText(e.target.value)}
                    placeholder="Conditions de participation, catégories d'âge, sanctions…"
                    className="w-full resize-none border border-gray-200/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />

                  <label className="mb-1 mt-3 block text-sm font-medium text-gray-700">
                    Lien vers le document{" "}
                    <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    type="url"
                    value={fRulesUrl}
                    onChange={(e) => setFRulesUrl(e.target.value)}
                    placeholder="https://…"
                    className="w-full border border-gray-200/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />

                  <label
                    className={`mt-3 flex items-start gap-2.5 text-sm ${
                      fRulesText.trim() || fRulesUrl.trim()
                        ? "text-gray-700"
                        : "cursor-not-allowed text-gray-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={fRequireRules}
                      disabled={!fRulesText.trim() && !fRulesUrl.trim()}
                      onChange={(e) => setFRequireRules(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-200/70"
                    />
                    <span>
                      Acceptation obligatoire à l&apos;inscription
                      <span className="block text-xs text-gray-400">
                        Le manager ne peut pas envoyer sa demande sans cocher la case.
                      </span>
                    </span>
                  </label>

                  <label className="mb-1 mt-4 block text-sm font-medium text-gray-700">
                    Frais d&apos;inscription{" "}
                    <span className="font-normal text-gray-400">(optionnel)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={fEntryFee}
                      onChange={(e) => setFEntryFee(e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-200/70 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      value={fFeeCurrency}
                      onChange={(e) => setFFeeCurrency(e.target.value)}
                      className="w-28 border border-gray-200/70 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Suivi manuel : KoppaFoot n&apos;encaisse rien, tu coches qui a payé.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => !saving && setEditOpen(false)}
                    className=" px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
