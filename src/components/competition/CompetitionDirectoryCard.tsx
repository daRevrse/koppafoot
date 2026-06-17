import Link from "next/link";
import { Trophy, CalendarDays, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { Competition, CompetitionStatus } from "@/types";

// ============================================
// Helpers
// ============================================

// Status → directory badge. Three public buckets only (draft never reaches the
// public directory). Mirrors the emerald/blue/gray accent language of the
// public competition pages.
const STATUS_BADGE: Record<
  CompetitionStatus,
  { label: string; dot: string; color: string; bg: string }
> = {
  draft: { label: "Brouillon", dot: "bg-gray-400", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { label: "À venir", dot: "bg-blue-500", color: "text-blue-700", bg: "bg-blue-50" },
  group_stage: { label: "En cours", dot: "bg-emerald-500", color: "text-emerald-700", bg: "bg-emerald-50" },
  knockout: { label: "En cours", dot: "bg-emerald-500", color: "text-emerald-700", bg: "bg-emerald-50" },
  completed: { label: "Terminée", dot: "bg-gray-400", color: "text-gray-500", bg: "bg-gray-100" },
};

// Human date range. Both / start-only / end-only / none, guarding invalid ISO.
function formatDateRange(start: string | null, end: string | null): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "d MMM yyyy", { locale: fr });
    } catch {
      return d;
    }
  };
  if (start && end) return `${fmt(start)} — ${fmt(end)}`;
  if (start) return `À partir du ${fmt(start)}`;
  if (end) return `Jusqu'au ${fmt(end)}`;
  return null;
}

// ============================================
// Component
// ============================================

// A single directory tile. Presentational + server-safe (no client hooks).
// Banners/logos are organizer-entered arbitrary URLs → plain <img>, not
// next/image. The whole tile links to the public competition home.
export default function CompetitionDirectoryCard({ competition }: { competition: Competition }) {
  const badge = STATUS_BADGE[competition.status];
  const dateRange = formatDateRange(competition.startDate, competition.endDate);
  const cover = competition.bannerUrl ?? competition.logoUrl;

  return (
    <Link
      href={`/c/${competition.slug}`}
      className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-lg"
    >
      {/* Cover: banner/logo when present, else a branded gradient with a trophy. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-900">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={competition.name}
            className="h-full w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
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
          {badge.label}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-base font-black leading-tight tracking-tight text-gray-900">
          {competition.name}
        </h3>
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
  );
}
