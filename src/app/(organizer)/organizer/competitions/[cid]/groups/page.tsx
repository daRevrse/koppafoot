"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  LayoutGrid, ArrowLeft, Loader2, Shuffle, CheckCircle2, Shield, Inbox,
} from "lucide-react";
import {
  onCompetition,
  onCompTeams,
  updateCompTeam,
  updateCompetition,
} from "@/lib/competition-firestore";
import type { Competition, CompTeam } from "@/types";
import toast from "react-hot-toast";

const UNASSIGNED = "unassigned";

export default function CompetitionGroupsPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubTeams = onCompTeams(cid, (next) => {
      setTeams(next);
      setLoading(false);
    });
    return () => {
      unsubCompetition();
      unsubTeams();
    };
  }, [cid]);

  // Derive group letters from format.group_count (0→"A", 1→"B", …).
  const groupLetters = useMemo(() => {
    const count = competition?.format.group_count ?? 0;
    return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
  }, [competition]);

  const targetSize = competition?.format.teams_per_group ?? 0;

  // Bucket teams by group letter; null → unassigned.
  const unassigned = teams.filter((t) => t.group == null);
  const teamsByGroup = useMemo(() => {
    const map = new Map<string, CompTeam[]>();
    for (const letter of groupLetters) map.set(letter, []);
    for (const team of teams) {
      if (team.group == null) continue;
      const bucket = map.get(team.group);
      if (bucket) bucket.push(team);
    }
    return map;
  }, [teams, groupLetters]);

  // "Valider les poules" gate: every group letter must hold exactly targetSize teams.
  const allGroupsFull =
    groupLetters.length > 0 &&
    targetSize > 0 &&
    groupLetters.every((letter) => (teamsByGroup.get(letter)?.length ?? 0) === targetSize);

  const handleAssign = async (team: CompTeam, value: string) => {
    const nextGroup = value === UNASSIGNED ? null : value;
    if (nextGroup === team.group) return;
    try {
      await updateCompTeam(cid, team.id, { group: nextGroup });
    } catch (err) {
      console.error("Error assigning team to group:", err);
      toast.error("Impossible de modifier la poule");
    }
  };

  // Fisher–Yates shuffle of the currently-unassigned teams, then fill free slots.
  const handleRandomDraw = async () => {
    if (unassigned.length === 0) {
      toast.error("Aucune équipe à répartir");
      return;
    }
    setDrawing(true);
    try {
      const shuffled = [...unassigned];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Track remaining free slots per group based on current occupancy.
      const freeSlots = new Map<string, number>();
      for (const letter of groupLetters) {
        const occupied = teamsByGroup.get(letter)?.length ?? 0;
        freeSlots.set(letter, Math.max(0, targetSize - occupied));
      }

      const assignments: { team: CompTeam; group: string }[] = [];
      for (const team of shuffled) {
        // Find the next group letter that still has a free slot.
        const target = groupLetters.find((letter) => (freeSlots.get(letter) ?? 0) > 0);
        if (!target) break; // no free slots left anywhere
        freeSlots.set(target, (freeSlots.get(target) ?? 0) - 1);
        assignments.push({ team, group: target });
      }

      if (assignments.length === 0) {
        toast.error("Toutes les poules sont déjà complètes");
        return;
      }

      await Promise.all(
        assignments.map(({ team, group }) => updateCompTeam(cid, team.id, { group })),
      );

      const leftover = unassigned.length - assignments.length;
      toast.success(
        leftover > 0
          ? `${assignments.length} équipe(s) réparties · ${leftover} sans place`
          : `${assignments.length} équipe(s) réparties`,
      );
    } catch (err) {
      console.error("Error during random draw:", err);
      toast.error("Le tirage a échoué");
    } finally {
      setDrawing(false);
    }
  };

  const handleValidate = async () => {
    if (!allGroupsFull) return;
    setValidating(true);
    try {
      await updateCompetition(cid, { status: "group_stage" });
      toast.success("Poules validées — phase de groupes lancée");
    } catch (err) {
      console.error("Error validating groups:", err);
      toast.error("Impossible de valider les poules");
    } finally {
      setValidating(false);
    }
  };

  const selectOptions = [
    { value: UNASSIGNED, label: "Non assignée" },
    ...groupLetters.map((letter) => ({ value: letter, label: `Poule ${letter}` })),
  ];

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
            Poules
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-0.5 text-sm text-gray-500"
          >
            {groupLetters.length} poule{groupLetters.length !== 1 ? "s" : ""} de {targetSize} équipes
          </motion.p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRandomDraw}
            disabled={drawing || unassigned.length === 0}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {drawing ? <Loader2 size={16} className="animate-spin" /> : <Shuffle size={16} />}
            Tirage aléatoire
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={!allGroupsFull || validating}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {validating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Valider les poules
          </button>
        </div>
      </div>

      {!allGroupsFull && !loading && (
        <p className="-mt-2 text-xs text-gray-400">
          Chaque poule doit compter exactement {targetSize} équipe{targetSize !== 1 ? "s" : ""} pour
          pouvoir valider.
        </p>
      )}

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : groupLetters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <LayoutGrid size={26} className="text-amber-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucune poule configurée</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Le format de cette compétition ne définit pas de poules.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Unassigned column */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Inbox size={18} className="text-gray-400" />
                <h2 className="text-sm font-bold text-gray-900">Non assignées</h2>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
                {unassigned.length}
              </span>
            </div>
            {unassigned.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">
                Toutes les équipes sont assignées.
              </p>
            ) : (
              <div className="space-y-2">
                {unassigned.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    value={UNASSIGNED}
                    options={selectOptions}
                    onAssign={handleAssign}
                  />
                ))}
              </div>
            )}
          </motion.section>

          {/* One section per group letter */}
          {groupLetters.map((letter, i) => {
            const groupTeams = teamsByGroup.get(letter) ?? [];
            const full = groupTeams.length === targetSize;
            const over = groupTeams.length > targetSize;
            return (
              <motion.section
                key={letter}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.04 }}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-sm font-bold text-amber-700">
                      {letter}
                    </span>
                    <h2 className="text-sm font-bold text-gray-900">Poule {letter}</h2>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      over
                        ? "bg-red-50 text-red-600"
                        : full
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {groupTeams.length}/{targetSize}
                  </span>
                </div>
                {groupTeams.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-400">Poule vide</p>
                ) : (
                  <div className="space-y-2">
                    {groupTeams.map((team) => (
                      <TeamRow
                        key={team.id}
                        team={team}
                        value={letter}
                        options={selectOptions}
                        onAssign={handleAssign}
                      />
                    ))}
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface TeamRowProps {
  team: CompTeam;
  value: string;
  options: { value: string; label: string }[];
  onAssign: (team: CompTeam, value: string) => void;
}

function TeamRow({ team, value, options, onAssign }: TeamRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-2.5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={team.logoUrl ? undefined : { backgroundColor: team.color }}
      >
        {team.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Shield size={16} className="text-white/90" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">{team.name}</p>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
          {team.shortName}
        </p>
      </div>
      <select
        value={value}
        onChange={(e) => onAssign(team, e.target.value)}
        aria-label={`Poule de ${team.name}`}
        className="shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors focus:border-primary-500 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
