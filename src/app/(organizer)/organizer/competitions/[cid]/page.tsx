"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Trophy, ArrowLeft, Loader2, Users, LayoutGrid, Calendar, GitBranch, ChevronRight, ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onCompetition } from "@/lib/competition-firestore";
import type { Competition, CompetitionStatus } from "@/types";

const STATUS_CONFIG: Record<CompetitionStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { label: "Inscriptions", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { label: "Phase de groupes", color: "text-amber-700", bg: "bg-amber-50" },
  knockout: { label: "Phase finale", color: "text-purple-700", bg: "bg-purple-50" },
  completed: { label: "Terminée", color: "text-emerald-700", bg: "bg-emerald-50" },
};

interface NavCard {
  label: string;
  description: string;
  href: string;
  icon: typeof Users;
  iconColor: string;
  iconBg: string;
}

export default function CompetitionDashboardPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const { user } = useAuth();
  const router = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);

  useEffect(() => {
    if (!cid) return;
    const unsubscribe = onCompetition(cid, setCompetition);
    return unsubscribe;
  }, [cid]);

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

  const cards: NavCard[] = [
    {
      label: "Équipes",
      description: "Gérer les équipes participantes",
      href: `/organizer/competitions/${cid}/teams`,
      icon: Users,
      iconColor: "text-primary-600",
      iconBg: "bg-primary-50",
    },
    {
      label: "Poules",
      description: "Composer les groupes",
      href: `/organizer/competitions/${cid}/groups`,
      icon: LayoutGrid,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50",
    },
    {
      label: "Calendrier",
      description: "Planifier les rencontres",
      href: `/organizer/competitions/${cid}/schedule`,
      icon: Calendar,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-50",
    },
    {
      label: "Phase finale",
      description: "Tableau à élimination directe",
      href: `/organizer/competitions/${cid}/knockout`,
      icon: GitBranch,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-50",
    },
    {
      label: "Staff",
      description: "Inviter des modérateurs live",
      href: `/organizer/competitions/${cid}/staff`,
      icon: ShieldCheck,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-50",
    },
  ];

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
        className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50">
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
          <span
            className={`mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusConf.bg} ${statusConf.color}`}
          >
            {statusConf.label}
          </span>
        </div>
      </motion.div>

      {/* Navigation cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.href}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + i * 0.04 }}
            >
              <Link
                href={card.href}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon size={22} className={card.iconColor} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{card.label}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{card.description}</p>
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
    </div>
  );
}
