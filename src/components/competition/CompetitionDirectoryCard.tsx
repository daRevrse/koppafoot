import Link from "next/link";
import { Trophy, CalendarDays, MapPin } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import FollowCompetitionButton from "./FollowCompetitionButton";
import type { Competition, CompetitionStatus } from "@/types";
import Image from "next/image";

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
  if (start && end) return `${fmt(start)}, ${fmt(end)}`;
  if (start) return `À partir du ${fmt(start)}`;
  if (end) return `Jusqu'au ${fmt(end)}`;
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
  const badge = STATUS_BADGE[competition.status];
  const dateRange = formatDateRange(competition.startDate, competition.endDate);
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
            {badge.label}
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-base font-black leading-tight tracking-tight text-gray-900">
            {competition.name}
          </h3>
          {competition.organizerName && (
            <p className="-mt-1 truncate text-[11px] font-bold text-gray-400">
              Par {competition.organizerName}
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
