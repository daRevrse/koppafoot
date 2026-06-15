"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Trophy, Plus, Loader2, Calendar, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listCompetitionsByOrganizer } from "@/lib/competition-firestore";
import type { Competition, CompetitionStatus } from "@/types";
import toast from "react-hot-toast";

const STATUS_CONFIG: Record<CompetitionStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { label: "Inscriptions", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { label: "Phase de groupes", color: "text-amber-700", bg: "bg-amber-50" },
  knockout: { label: "Phase finale", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "Terminée", color: "text-emerald-700", bg: "bg-emerald-50" },
};

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  return fmt((start ?? end) as string);
}

export default function OrganizerHomePage() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listCompetitionsByOrganizer(user.uid)
      .then((comps) => {
        if (!cancelled) setCompetitions(comps);
      })
      .catch((err) => {
        console.error("Error loading competitions:", err);
        toast.error("Impossible de charger vos compétitions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-2xl font-extrabold text-gray-900 font-display"
          >
            Mes compétitions
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="text-sm text-gray-500 mt-0.5"
          >
            {competitions.length} compétition{competitions.length !== 1 ? "s" : ""} au total
          </motion.p>
        </div>
        <Link
          href="/organizer/competitions/new"
          className="flex shrink-0 items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
        >
          <Plus size={16} />
          Nouvelle compétition
        </Link>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : competitions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50">
            <Trophy size={26} className="text-amber-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucune compétition</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Créez votre première compétition pour organiser un tournoi, gérer les équipes et le calendrier.
          </p>
          <Link
            href="/organizer/competitions/new"
            className="mt-6 flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700"
          >
            <Plus size={16} />
            Nouvelle compétition
          </Link>
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {competitions.map((comp, i) => {
            const statusConf = STATUS_CONFIG[comp.status] ?? STATUS_CONFIG.draft;
            const dateRange = formatDateRange(comp.startDate, comp.endDate);
            return (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/organizer/competitions/${comp.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-50 to-orange-50">
                    {comp.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comp.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Trophy size={20} className="text-amber-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-gray-900">{comp.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusConf.bg} ${statusConf.color}`}
                      >
                        {statusConf.label}
                      </span>
                    </div>
                    {dateRange && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                        <Calendar size={12} />
                        {dateRange}
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    size={18}
                    className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"
                  />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
