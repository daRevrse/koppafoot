"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar, ArrowLeft, Loader2, Sparkles, Save, ChevronRight, ChevronLeft, MapPin, Upload,
  Image as ImageIcon, X, AlertTriangle, Plus, Trophy, CalendarClock, Check, Clock, Goal,
} from "lucide-react";
import {
  onCompetition,
  onCompMatches,
  onCompTeams,
  generateGroupFixtures,
  scheduleCompMatch,
  updateCompMatch,
  createCompMatch,
} from "@/lib/competition-firestore";
import { hasGroupStage } from "@/lib/competition-format";
import { uploadMatchBanner } from "@/lib/storage";
import ImageUploadField from "@/components/ui/ImageUploadField";
import MatchResultModal from "@/components/competition/MatchResultModal";
import type { Competition, CompMatch, CompTeam } from "@/types";
import toast from "react-hot-toast";

interface RowState {
  date: string;
  time: string;
  venueName: string;
  venueCity: string;
}

export default function CompetitionSchedulePage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // "Add match" modal.
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    homeTeamId: "",
    awayTeamId: "",
    group: "",
    date: "",
    time: "",
    venueName: "",
    venueCity: "",
  });
  const [addingMatch, setAddingMatch] = useState(false);

  // Per-row input state keyed by match id; never holds undefined (use "").
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // "Add score" modal for past matches (also reopened to fix a saved result).
  const [scoreMatch, setScoreMatch] = useState<CompMatch | null>(null);

  // "Postpone" modal for past matches.
  const [postponeMatch, setPostponeMatch] = useState<CompMatch | null>(null);
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeTime, setPostponeTime] = useState("");
  const [savingPostpone, setSavingPostpone] = useState(false);

  // Per-match banner modal.
  const [bannerMatch, setBannerMatch] = useState<CompMatch | null>(null);
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [savingBanner, setSavingBanner] = useState(false);

  const openBanner = (m: CompMatch) => {
    setBannerMatch(m);
    setBannerUrl(m.bannerUrl ?? "");
    setBannerFile(null);
  };

  const saveBanner = async () => {
    if (!bannerMatch) return;
    setSavingBanner(true);
    try {
      let url: string | null = bannerUrl.trim() || null;
      if (bannerFile) url = await uploadMatchBanner(cid, bannerMatch.id, bannerFile);
      await updateCompMatch(cid, bannerMatch.id, { banner_url: url });
      toast.success("Bannière du match enregistrée");
      setBannerMatch(null);
    } catch (err) {
      console.error("Error saving match banner:", err);
      toast.error("Impossible d'enregistrer la bannière");
    } finally {
      setSavingBanner(false);
    }
  };

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubMatches = onCompMatches(cid, (next) => {
      setMatches(next);
      setLoading(false);
    });
    const unsubTeams = onCompTeams(cid, setTeams);
    return () => {
      unsubCompetition();
      unsubMatches();
      unsubTeams();
    };
  }, [cid]);

  const groupMatches = useMemo(
    () => matches.filter((m) => m.stage === "group"),
    [matches],
  );

  // Seed row state from match values whenever matches change, without clobbering
  // edits the user has already started (only fill rows we haven't seeded yet).
  useEffect(() => {
    setRows((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const m of groupMatches) {
        if (next[m.id]) continue;
        next[m.id] = {
          date: m.date ?? "",
          time: m.time ?? "",
          venueName: m.venueName ?? "",
          venueCity: m.venueCity ?? "",
        };
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [groupMatches]);

  // Bucket group matches by their group letter, sorted by letter then name.
  const matchesByGroup = useMemo(() => {
    const map = new Map<string, CompMatch[]>();
    for (const m of groupMatches) {
      const key = m.group ?? "—";
      const bucket = map.get(key);
      if (bucket) bucket.push(m);
      else map.set(key, [m]);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
  }, [groupMatches]);

  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const groupKeys = useMemo(() => [...matchesByGroup.keys()], [matchesByGroup]);

  const handlePrevGroup = () => {
    const list = ["ALL", ...groupKeys];
    const currentIndex = list.indexOf(selectedGroup);
    if (currentIndex <= 0) {
      setSelectedGroup(list[list.length - 1]);
    } else {
      setSelectedGroup(list[currentIndex - 1]);
    }
  };

  const handleNextGroup = () => {
    const list = ["ALL", ...groupKeys];
    const currentIndex = list.indexOf(selectedGroup);
    if (currentIndex < 0 || currentIndex >= list.length - 1) {
      setSelectedGroup(list[0]);
    } else {
      setSelectedGroup(list[currentIndex + 1]);
    }
  };

  const visibleGroups = useMemo(() => {
    const entries = [...matchesByGroup.entries()];
    if (selectedGroup === "ALL") return entries;
    return entries.filter(([key]) => key === selectedGroup);
  }, [matchesByGroup, selectedGroup]);

  const updateRow = (id: string, key: keyof RowState, value: string) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { date: "", time: "", venueName: "", venueCity: "" }), [key]: value },
    }));
  };

  // Effective slot for a match = its edited row, falling back to saved values.
  const slotOf = (m: CompMatch) => {
    const r = rows[m.id];
    return {
      date: (r?.date ?? m.date ?? "").trim(),
      time: (r?.time ?? m.time ?? "").trim(),
      venue: (r?.venueName ?? m.venueName ?? "").trim().toLowerCase(),
    };
  };

  // Double-booking detection: two matches sharing the same venue + date + time.
  // Recomputed live as the organizer edits, so warnings appear immediately.
  const conflictIds = useMemo(() => {
    const seen = new Map<string, string>();
    const bad = new Set<string>();
    for (const m of groupMatches) {
      const r = rows[m.id];
      const date = (r?.date ?? m.date ?? "").trim();
      const time = (r?.time ?? m.time ?? "").trim();
      const venue = (r?.venueName ?? m.venueName ?? "").trim().toLowerCase();
      if (!date || !time || !venue) continue;
      const key = `${date}|${time}|${venue}`;
      const prev = seen.get(key);
      if (prev) {
        bad.add(prev);
        bad.add(m.id);
      } else {
        seen.set(key, m.id);
      }
    }
    return bad;
  }, [groupMatches, rows]);

  // Slots already taken at a given venue (for the "créneaux occupés" hint).
  const takenSlotsFor = (venue: string): { date: string; time: string }[] => {
    const v = venue.trim().toLowerCase();
    if (!v) return [];
    const out: { date: string; time: string }[] = [];
    for (const m of groupMatches) {
      const s = slotOf(m);
      if (s.venue === v && s.date && s.time) out.push({ date: s.date, time: s.time });
    }
    return out;
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateGroupFixtures(cid);
      toast.success("Matchs de poule générés");
    } catch (err) {
      console.error("Error generating fixtures:", err);
      // Surface the thrown message verbatim (e.g. "Une coupe n'a pas de
      // phase de groupes").
      toast.error(err instanceof Error ? err.message : "La génération a échoué");
    } finally {
      setGenerating(false);
    }
  };

  const openAdd = () => {
    setAddForm({ homeTeamId: "", awayTeamId: "", group: "", date: "", time: "", venueName: "", venueCity: "" });
    setAddOpen(true);
  };

  const setAdd = (key: keyof typeof addForm, value: string) => {
    setAddForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-fill the poule from the home team's group when not set manually.
      if (key === "homeTeamId" && !prev.group) {
        const g = teams.find((t) => t.id === value)?.group;
        if (g) next.group = g;
      }
      return next;
    });
  };

  const handleAddMatch = async () => {
    if (!addForm.homeTeamId || !addForm.awayTeamId) {
      toast.error("Choisis les deux équipes");
      return;
    }
    if (addForm.homeTeamId === addForm.awayTeamId) {
      toast.error("Une équipe ne peut pas jouer contre elle-même");
      return;
    }
    // Slot-conflict check against existing matches (same venue + date + time).
    const venue = addForm.venueName.trim().toLowerCase();
    const date = addForm.date.trim();
    const time = addForm.time.trim();
    if (venue && date && time) {
      const clash = matches.some(
        (m) =>
          (m.venueName ?? "").trim().toLowerCase() === venue &&
          (m.date ?? "").trim() === date &&
          (m.time ?? "").trim() === time,
      );
      if (clash && !window.confirm("Ce créneau (stade + date + heure) est déjà pris. Ajouter quand même ?")) {
        return;
      }
    }

    setAddingMatch(true);
    try {
      await createCompMatch(cid, {
        homeTeamId: addForm.homeTeamId,
        awayTeamId: addForm.awayTeamId,
        group: addForm.group.trim() || null,
        date: addForm.date || null,
        time: addForm.time || null,
        venueName: addForm.venueName || null,
        venueCity: addForm.venueCity || null,
      });
      toast.success("Match ajouté");
      setAddOpen(false);
    } catch (err) {
      console.error("Error adding match:", err);
      toast.error(err instanceof Error ? err.message : "Impossible d'ajouter le match");
    } finally {
      setAddingMatch(false);
    }
  };

  const handleSave = async (id: string) => {
    const row = rows[id] ?? { date: "", time: "", venueName: "", venueCity: "" };

    // Warn on double-booking before saving (same venue + date + time).
    if (conflictIds.has(id)) {
      const ok = window.confirm(
        "Ce créneau (stade + date + heure) est déjà pris par un autre match. Enregistrer quand même ?",
      );
      if (!ok) return;
    }

    setSavingId(id);
    try {
      await scheduleCompMatch(cid, id, {
        date: row.date,
        time: row.time,
        venueName: row.venueName,
        venueCity: row.venueCity,
      });
      toast.success("Match enregistré");
    } catch (err) {
      console.error("Error scheduling match:", err);
      toast.error("Impossible d'enregistrer le match");
    } finally {
      setSavingId(null);
    }
  };

  /** Returns true when the match date+time is strictly in the past. */
  const isMatchPast = (m: CompMatch): boolean => {
    const r = rows[m.id];
    const d = (r?.date ?? m.date ?? "").trim();
    if (!d) return false; // no date set → not past
    const t = (r?.time ?? m.time ?? "").trim();
    const iso = t ? `${d}T${t}` : `${d}T23:59`;
    return new Date(iso).getTime() < Date.now();
  };

  const openScore = (m: CompMatch) => setScoreMatch(m);

  const openPostpone = (m: CompMatch) => {
    setPostponeMatch(m);
    setPostponeDate("");
    setPostponeTime(m.time ?? "");
  };

  const handleSavePostpone = async () => {
    if (!postponeMatch) return;
    if (!postponeDate) {
      toast.error("Choisis une nouvelle date");
      return;
    }
    setSavingPostpone(true);
    try {
      await scheduleCompMatch(cid, postponeMatch.id, {
        date: postponeDate,
        time: postponeTime || (postponeMatch.time ?? ""),
        venueName: rows[postponeMatch.id]?.venueName ?? postponeMatch.venueName ?? "",
        venueCity: rows[postponeMatch.id]?.venueCity ?? postponeMatch.venueCity ?? "",
      });
      // Also reset row state so the UI picks up the new date.
      setRows((prev) => ({
        ...prev,
        [postponeMatch.id]: {
          ...(prev[postponeMatch.id] ?? { date: "", time: "", venueName: "", venueCity: "" }),
          date: postponeDate,
          time: postponeTime || (postponeMatch.time ?? ""),
        },
      }));
      toast.success("Match reporté à la nouvelle date");
      setPostponeMatch(null);
    } catch (err) {
      console.error("Error postponing match:", err);
      toast.error("Impossible de reporter le match");
    } finally {
      setSavingPostpone(false);
    }
  };

  const hasGroupMatches = groupMatches.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-2xl font-extrabold text-gray-900"
          >
            Calendrier
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-0.5 text-sm text-gray-500"
          >
            {competition?.name ?? "Compétition"} · {groupMatches.length} match
            {groupMatches.length !== 1 ? "s" : ""} de poule
          </motion.p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={openAdd}
            disabled={teams.length < 2}
            title={teams.length < 2 ? "Ajoute au moins deux équipes d'abord" : "Ajouter un match"}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} />
            Ajouter un match
          </button>
          <Link
            href={`/organizer/competitions/${cid}/import`}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
          >
            <Upload size={16} />
            Importer
          </Link>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : !hasGroupMatches ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
            <Calendar size={26} className="text-blue-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucun match</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Importez votre calendrier de matchs — ou générez automatiquement un round-robin de poule.
          </p>
          <Link
            href={`/organizer/competitions/${cid}/import`}
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Upload size={16} />
            Importer des matchs
          </Link>
          {/* A cup has no group stage — its matches come from the bracket. */}
          {competition && hasGroupStage(competition.competitionType) && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              ou générer un round-robin
            </button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Horizontal navigation bar for groups */}
          {groupKeys.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm">
              <button
                type="button"
                onClick={handlePrevGroup}
                aria-label="Poule précédente"
                title="Poule précédente"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronLeft size={18} />
              </button>

              <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedGroup("ALL")}
                  className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                    selectedGroup === "ALL"
                      ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Toutes les poules ({groupMatches.length})
                </button>
                {groupKeys.map((key) => {
                  const count = matchesByGroup.get(key)?.length ?? 0;
                  const isSelected = selectedGroup === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedGroup(key)}
                      className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        isSelected
                          ? "bg-amber-500 text-white shadow-md shadow-amber-200"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-black ${
                          isSelected ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {key}
                      </span>
                      Poule {key} ({count})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleNextGroup}
                aria-label="Poule suivante"
                title="Poule suivante"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {visibleGroups.map(([groupKey, groupMatchList], gi) => (
            <motion.section
              key={groupKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.04 }}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/70 px-5 py-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
                  {groupKey}
                </span>
                <h2 className="text-sm font-bold text-gray-900">Poule {groupKey}</h2>
                <span className="ml-auto text-xs font-medium text-gray-400">
                  {groupMatchList.length} match{groupMatchList.length !== 1 ? "s" : ""}
                </span>
              </div>

              <div className="divide-y divide-gray-100">
                {groupMatchList.map((match) => {
                  const row = rows[match.id] ?? {
                    date: "",
                    time: "",
                    venueName: "",
                    venueCity: "",
                  };
                  const saving = savingId === match.id;
                  const conflict = conflictIds.has(match.id);
                  const past = match.status !== "completed" && match.status !== "cancelled" && isMatchPast(match);
                  const completed = match.status === "completed";
                  return (
                    <div key={match.id} className={`p-4 ${conflict ? "bg-amber-50/40" : ""} ${past ? "bg-red-50/30" : ""} ${completed ? "bg-emerald-50/30" : ""}`}>
                      {/* Teams + live link */}
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
                          <span>
                            {match.homeTeamName}{" "}
                            <span className="font-normal text-gray-400">vs</span>{" "}
                            {match.awayTeamName}
                          </span>
                          {completed && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                              <Check size={11} />
                              {match.scoreHome ?? 0} - {match.scoreAway ?? 0}
                            </span>
                          )}
                          {past && (
                            <span
                              title="Date dépassée — ajoutez un score ou reportez le match"
                              className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700"
                            >
                              <Clock size={11} />
                              Date dépassée
                            </span>
                          )}
                          {conflict && (
                            <span
                              title="Créneau déjà pris (stade + date + heure)"
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700"
                            >
                              <AlertTriangle size={11} />
                              Conflit
                            </span>
                          )}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          {/* Saved results stay editable — a wrong score or a
                              forgotten scorer is corrected from the same modal. */}
                          {completed && (
                            <button
                              type="button"
                              onClick={() => openScore(match)}
                              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
                            >
                              <Goal size={14} />
                              Score &amp; buteurs
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openBanner(match)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                              match.bannerUrl
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            }`}
                          >
                            <ImageIcon size={14} />
                            {match.bannerUrl ? "Bannière" : "Bannière"}
                          </button>
                          <Link
                            href={`/organizer/competitions/${cid}/matches/${match.id}/live`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50"
                          >
                            {completed ? "Console" : "Console live"}
                            <ChevronRight size={14} />
                          </Link>
                        </div>
                      </div>

                      {/* Past-date action bar */}
                      {past && (
                        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
                          <div className="flex items-center gap-2 text-sm text-red-700">
                            <AlertTriangle size={16} />
                            <span className="font-semibold">Ce match devait se jouer le {row.date}{row.time ? ` à ${row.time}` : ""}.</span>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openScore(match)}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                            >
                              <Trophy size={15} />
                              Ajouter score
                            </button>
                            <button
                              type="button"
                              onClick={() => openPostpone(match)}
                              className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                            >
                              <CalendarClock size={15} />
                              Reporter
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline scheduling inputs */}
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-gray-500">Date</span>
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(match.id, "date", e.target.value)}
                            className={`rounded-lg border px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none ${
                              past ? "border-red-300 bg-red-50/50" : "border-gray-200"
                            }`}
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-gray-500">Heure</span>
                          <input
                            type="time"
                            value={row.time}
                            onChange={(e) => updateRow(match.id, "time", e.target.value)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
                          />
                        </label>
                        <label className="flex flex-1 flex-col gap-1">
                          <span className="text-[11px] font-medium text-gray-500">Stade</span>
                          <input
                            type="text"
                            placeholder="Nom du stade"
                            value={row.venueName}
                            onChange={(e) => updateRow(match.id, "venueName", e.target.value)}
                            className="min-w-[8rem] rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
                          />
                        </label>
                        <label className="flex flex-1 flex-col gap-1">
                          <span className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
                            <MapPin size={11} />
                            Ville
                          </span>
                          <input
                            type="text"
                            placeholder="Ville"
                            value={row.venueCity}
                            onChange={(e) => updateRow(match.id, "venueCity", e.target.value)}
                            className="min-w-[7rem] rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => handleSave(match.id)}
                          disabled={saving}
                          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Save size={15} />
                          )}
                          Enregistrer
                        </button>
                      </div>

                      {/* Occupied slots hint for the entered venue */}
                      {row.venueName.trim() && (() => {
                        const taken = takenSlotsFor(row.venueName)
                          .filter((s) => !(s.date === row.date.trim() && s.time === row.time.trim()))
                          .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
                        if (taken.length === 0) return null;
                        return (
                          <p className="mt-2 text-[11px] text-gray-400">
                            <span className="font-semibold text-gray-500">Créneaux déjà pris à {row.venueName.trim()} :</span>{" "}
                            {taken.slice(0, 6).map((s) => `${s.date} ${s.time}`).join(" · ")}
                            {taken.length > 6 ? " …" : ""}
                          </p>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      )}

      {/* Add-match modal */}
      <AnimatePresence>
        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">Ajouter un match</h2>
                <button
                  onClick={() => !addingMatch && setAddOpen(false)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Domicile</label>
                    <select
                      value={addForm.homeTeamId}
                      onChange={(e) => setAdd("homeTeamId", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">— Équipe —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === addForm.awayTeamId}>
                          {t.name}{t.group ? ` (${t.group})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Extérieur</label>
                    <select
                      value={addForm.awayTeamId}
                      onChange={(e) => setAdd("awayTeamId", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    >
                      <option value="">— Équipe —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} disabled={t.id === addForm.homeTeamId}>
                          {t.name}{t.group ? ` (${t.group})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="col-span-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Poule</label>
                    <input
                      type="text"
                      placeholder="A"
                      value={addForm.group}
                      onChange={(e) => setAdd("group", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={addForm.date}
                      onChange={(e) => setAdd("date", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Heure</label>
                    <input
                      type="time"
                      value={addForm.time}
                      onChange={(e) => setAdd("time", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div className="col-span-1">
                    <label className="mb-1 block text-sm font-medium text-gray-700">Ville</label>
                    <input
                      type="text"
                      placeholder="Lomé"
                      value={addForm.venueCity}
                      onChange={(e) => setAdd("venueCity", e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Stade</label>
                  <input
                    type="text"
                    placeholder="Nom du stade"
                    value={addForm.venueName}
                    onChange={(e) => setAdd("venueName", e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                  {/* Occupied slots hint for the chosen venue */}
                  {addForm.venueName.trim() && (() => {
                    const taken = takenSlotsFor(addForm.venueName).sort((a, b) =>
                      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
                    );
                    if (taken.length === 0) return null;
                    return (
                      <p className="mt-1.5 text-[11px] text-gray-400">
                        <span className="font-semibold text-gray-500">Créneaux déjà pris :</span>{" "}
                        {taken.slice(0, 6).map((s) => `${s.date} ${s.time}`).join(" · ")}
                        {taken.length > 6 ? " …" : ""}
                      </p>
                    );
                  })()}
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => !addingMatch && setAddOpen(false)}
                    className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMatch}
                    disabled={addingMatch}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {addingMatch ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Ajouter le match
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Per-match banner modal */}
      <AnimatePresence>
        {bannerMatch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">Bannière du match</h2>
                <button
                  onClick={() => !savingBanner && setBannerMatch(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mb-4 text-sm text-gray-500">
                {bannerMatch.homeTeamName} vs {bannerMatch.awayTeamName}. Si vide, la bannière
                de la compétition (puis une image par défaut) est utilisée.
              </p>

              <ImageUploadField
                label="Bannière du match"
                url={bannerUrl}
                onUrlChange={setBannerUrl}
                file={bannerFile}
                onFile={setBannerFile}
                aspect="wide"
                maxMb={5}
                hint="Affichée sur la carte du match et le centre de match"
              />

              <div className="mt-5 flex justify-between gap-3">
                {bannerMatch.bannerUrl && (
                  <button
                    type="button"
                    onClick={async () => {
                      setSavingBanner(true);
                      try {
                        await updateCompMatch(cid, bannerMatch.id, { banner_url: null });
                        toast.success("Bannière retirée");
                        setBannerMatch(null);
                      } finally {
                        setSavingBanner(false);
                      }
                    }}
                    disabled={savingBanner}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    Retirer
                  </button>
                )}
                <div className="ml-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => !savingBanner && setBannerMatch(null)}
                    className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={saveBanner}
                    disabled={savingBanner}
                    className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
                  >
                    {savingBanner ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Enregistrer
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Score + scorers modal — shared with the knockout bracket */}
      <MatchResultModal
        cid={cid}
        match={scoreMatch}
        teams={teams}
        onClose={() => setScoreMatch(null)}
      />

      {/* Postpone / reschedule modal */}
      <AnimatePresence>
        {postponeMatch && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">Reporter le match</h2>
                <button
                  onClick={() => !savingPostpone && setPostponeMatch(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mb-1 text-sm text-gray-500">
                Choisissez une nouvelle date et heure pour ce match.
              </p>
              <p className="mb-5 text-xs text-gray-400">
                {postponeMatch.homeTeamName} vs {postponeMatch.awayTeamName}
                {postponeMatch.date ? ` · ancien : ${postponeMatch.date}` : ""}
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Nouvelle date</label>
                    <input
                      type="date"
                      value={postponeDate}
                      onChange={(e) => setPostponeDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Heure</label>
                    <input
                      type="time"
                      value={postponeTime}
                      onChange={(e) => setPostponeTime(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => !savingPostpone && setPostponeMatch(null)}
                  className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSavePostpone}
                  disabled={savingPostpone}
                  className="flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-all hover:bg-primary-700 disabled:opacity-50"
                >
                  {savingPostpone ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />}
                  Reporter le match
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
