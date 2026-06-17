"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Calendar, ArrowLeft, Loader2, Sparkles, Save, Check, ChevronRight, MapPin, Upload,
} from "lucide-react";
import {
  onCompetition,
  onCompMatches,
  generateGroupFixtures,
  scheduleCompMatch,
} from "@/lib/competition-firestore";
import type { Competition, CompMatch } from "@/types";
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Per-row input state keyed by match id; never holds undefined (use "").
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubMatches = onCompMatches(cid, (next) => {
      setMatches(next);
      setLoading(false);
    });
    return () => {
      unsubCompetition();
      unsubMatches();
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

  const updateRow = (id: string, key: keyof RowState, value: string) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { date: "", time: "", venueName: "", venueCity: "" }), [key]: value },
    }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateGroupFixtures(cid);
      toast.success("Matchs de poule générés");
    } catch (err) {
      console.error("Error generating fixtures:", err);
      toast.error("La génération a échoué");
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (id: string) => {
    const row = rows[id] ?? { date: "", time: "", venueName: "", venueCity: "" };
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
          <Link
            href={`/organizer/competitions/${cid}/import`}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Upload size={16} />
            Importer des matchs
          </Link>
          {hasGroupMatches && (
            <span
              title="Les matchs sont déjà générés"
              className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-400 shadow-sm sm:flex"
            >
              <Check size={16} />
              Matchs générés
            </span>
          )}
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
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            ou générer un round-robin
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {[...matchesByGroup.entries()].map(([groupKey, groupMatchList], gi) => (
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
                  return (
                    <div key={match.id} className="p-4">
                      {/* Teams + live link */}
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-gray-900">
                          {match.homeTeamName}{" "}
                          <span className="font-normal text-gray-400">vs</span>{" "}
                          {match.awayTeamName}
                        </p>
                        <Link
                          href={`/organizer/competitions/${cid}/matches/${match.id}/live`}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary-600 transition-colors hover:bg-primary-50"
                        >
                          Console live
                          <ChevronRight size={14} />
                        </Link>
                      </div>

                      {/* Inline scheduling inputs */}
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="flex flex-col gap-1">
                          <span className="text-[11px] font-medium text-gray-500">Date</span>
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(match.id, "date", e.target.value)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
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
                    </div>
                  );
                })}
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </div>
  );
}
