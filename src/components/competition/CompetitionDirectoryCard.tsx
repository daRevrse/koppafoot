"use client";

import Link from "next/link";
import { Trophy, CalendarDays, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { LOCALE_DATE_FNS } from "@/i18n/dates";
import FollowCompetitionButton from "./FollowCompetitionButton";
import type { Competition, CompetitionStatus } from "@/types";
import Image from "next/image";

// ============================================
// Helpers
// ============================================

// Status → directory badge. Three public buckets only (draft never reaches the
// public directory). Mirrors the emerald/blue/gray accent language of the
// public competition pages.
const STATUS_BADGE: Record<CompetitionStatus, { dot: string; color: string; bg: string }> = {
  draft: { dot: "bg-gray-400", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { dot: "bg-blue-500", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { dot: "bg-emerald-500", color: "text-emerald-700", bg: "bg-emerald-50" },
  knockout: { dot: "bg-emerald-500", color: "text-emerald-700", bg: "bg-emerald-50" },
  completed: { dot: "bg-gray-400", color: "text-gray-500", bg: "bg-gray-100" },
};

const T = textes(
  {
    statut: (s: CompetitionStatus) => ({
      draft: "Brouillon", registration: "À venir", group_stage: "En cours",
      knockout: "En cours", completed: "Terminée",
    })[s],
    aPartirDu: (d: string) => `À partir du ${d}`,
    jusquau: (d: string) => `Jusqu'au ${d}`,
    par: (nom: string) => `Par ${nom}`,
  },
  {
    statut: (s: CompetitionStatus) => ({
      draft: "Draft", registration: "Upcoming", group_stage: "Under way",
      knockout: "Under way", completed: "Finished",
    })[s],
    aPartirDu: (d: string) => `From ${d}`,
    jusquau: (d: string) => `Until ${d}`,
    par: (nom: string) => `By ${nom}`,
  },
);

// Human date range. Both / start-only / end-only / none, guarding invalid ISO.
function formatDateRange(
  start: string | null,
  end: string | null,
  locale: (typeof LOCALE_DATE_FNS)["fr"],
  t: (typeof T)["fr"],
): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "d MMM yyyy", { locale });
    } catch {
      return d;
    }
  };
  if (start && end) return `${fmt(start)}, ${fmt(end)}`;
  if (start) return t.aPartirDu(fmt(start));
  if (end) return t.jusquau(fmt(end));
  return null;
}

// ============================================
// Component
// ============================================

// A single directory tile. Presentational + server-safe (no client hooks),
// sauf le bouton Suivre, une île cliente posée par-dessus.
// LES VISUELS PASSENT PAR next/image DEPUIS QUE LE JOKER EST TOMBÉ. Ils
// étaient des URL libres saisies par l'organisateur, donc `next/image` aurait
// planté sur un hôte non déclaré : d'où un `<img>` brut, et une couverture de
// 349px servie à sa taille d'origine — 1254x1254 pour 494 Ko, mesuré. Le
// collage d'URL a disparu (voir ImageUploadField), tout vient de Firebase
// Storage, l'optimiseur peut faire son travail.
export default function CompetitionDirectoryCard({ competition }: { competition: Competition }) {
  const { langue } = useLangue();
  const t = useTextes(T);
  const badge = STATUS_BADGE[competition.status];
  const dateRange = formatDateRange(competition.startDate, competition.endDate, LOCALE_DATE_FNS[langue], t);
  const cover = competition.bannerUrl ?? competition.logoUrl;

  return (
    <div className="group relative flex flex-col overflow-hidden border border-gray-200/70 bg-white transition-all hover:border-emerald-200">
      {/* Hors du lien : un bouton imbriqué dans une ancre navigue au clic. */}
      <div className="absolute right-3 top-3 z-10">
        <FollowCompetitionButton cid={competition.id} variant="icon" />
      </div>

      <Link href={`/c/${competition.slug}`} className="flex flex-1 flex-col">
        {/* Cover: banner/logo when present, else a branded gradient with a trophy. */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900">
          {cover ? (
            <Image
              src={cover}
              alt={competition.name}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-700 via-gray-900 to-black">
              <Trophy size={36} className="text-emerald-400" />
            </div>
          )}
          <span
            className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${badge.bg} ${badge.color}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {t.statut(competition.status)}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-base font-black leading-tight tracking-tight text-gray-900">
            {competition.name}
          </h3>
          {competition.organizerName && (
            <p className="-mt-1 truncate text-[11px] font-bold text-gray-400">
              {t.par(competition.organizerName)}
            </p>
          )}
          <div className="mt-auto flex flex-col gap-1 text-[11px] font-bold text-gray-400">
            {dateRange && (
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} className="shrink-0 text-gray-300" />
                <span className="truncate">{dateRange}</span>
              </span>
            )}
            {competition.venueCity && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="shrink-0 text-gray-300" />
                <span className="truncate">{competition.venueCity}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
