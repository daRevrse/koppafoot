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
import BadgeCategorie from "@/components/genre/BadgeCategorie";

// ============================================
// Helpers
// ============================================

// Status → directory badge. Draft never reaches the public directory. Open
// registration is blue because it is the one a visitor can act on; closed
// registration is amber: known teams, no match yet.
const STATUS_BADGE: Record<CompetitionStatus, { dot: string; color: string; bg: string }> = {
  draft: { dot: "bg-gray-400", color: "text-gray-600", bg: "bg-gray-100" },
  registration: { dot: "bg-blue-500", color: "text-blue-700", bg: "bg-blue-50" },
  registration_closed: { dot: "bg-amber-500", color: "text-amber-700", bg: "bg-amber-50" },
  group_stage: { dot: "bg-emerald-500", color: "text-emerald-700", bg: "bg-emerald-50" },
  knockout: { dot: "bg-emerald-500", color: "text-emerald-700", bg: "bg-emerald-50" },
  completed: { dot: "bg-gray-400", color: "text-gray-500", bg: "bg-gray-100" },
};

const T = textes(
  {
    statut: (s: CompetitionStatus) => ({
      draft: "Brouillon", registration: "Inscriptions ouvertes", registration_closed: "À venir",
      group_stage: "En cours", knockout: "En cours", completed: "Terminée",
    })[s],
    duAu: (debut: string, fin: string) => `Du ${debut} au ${fin}`,
    aPartirDu: (d: string) => `À partir du ${d}`,
    jusquau: (d: string) => `Jusqu'au ${d}`,
    par: (nom: string) => `Par ${nom}`,
  },
  {
    statut: (s: CompetitionStatus) => ({
      draft: "Draft", registration: "Registration open", registration_closed: "Upcoming",
      group_stage: "Under way", knockout: "Under way", completed: "Finished",
    })[s],
    duAu: (debut: string, fin: string) => `${debut} to ${fin}`,
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
  const fmt = (d: string, motif = "d MMM yyyy") => {
    try {
      return format(parseISO(d), motif, { locale });
    } catch {
      return d;
    }
  };
  // L'année une seule fois quand les deux dates la partagent.
  if (start && end) return t.duAu(fmt(start, start.slice(0, 4) === end.slice(0, 4) ? "d MMM" : "d MMM yyyy"), fmt(end));
  if (start) return t.aPartirDu(fmt(start));
  if (end) return t.jusquau(fmt(end));
  return null;
}

// ============================================
// Component
// ============================================

// A single directory tile, sauf le bouton Suivre, une île cliente posée
// par-dessus.
//
// DEUX SILHOUETTES. Sur téléphone, une ligne : la vignette à gauche, le nom et
// l'essentiel à droite — une compétition par écran, comme avant, c'était un
// répertoire qu'on ne parcourait pas. À partir de sm, la carte avec son
// affiche, en grille.
//
// LA VIGNETTE PRÉFÈRE LE LOGO, L'AFFICHE PRÉFÈRE LA BANNIÈRE : une bannière
// recadrée au carré perd ce qu'elle dit. Les deux sont rendues quand elles
// diffèrent, chacune à sa taille ; en chargement différé, celle qui est
// masquée (display: none) n'est pas téléchargée.
//
// LES VISUELS PASSENT PAR next/image : tout vient de Firebase Storage depuis
// que le collage d'URL a disparu (voir ImageUploadField).
export default function CompetitionDirectoryCard({ competition }: { competition: Competition }) {
  const { langue } = useLangue();
  const t = useTextes(T);
  const badge = STATUS_BADGE[competition.status];
  const dateRange = formatDateRange(competition.startDate, competition.endDate, LOCALE_DATE_FNS[langue], t);
  const affiche = competition.bannerUrl ?? competition.logoUrl;
  const vignette = competition.logoUrl ?? competition.bannerUrl;

  return (
    <div className="group relative flex border border-gray-200/70 bg-white transition-colors hover:border-emerald-300">
      {/* Hors du lien : un bouton imbriqué dans une ancre navigue au clic. */}
      <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full ring-1 ring-gray-200/70 sm:top-3 sm:translate-y-0 sm:ring-0">
        <FollowCompetitionButton cid={competition.id} variant="icon" />
      </div>

      <Link href={`/c/${competition.slug}`} className="flex min-w-0 flex-1 sm:flex-col">
        <div className="relative aspect-square w-24 shrink-0 overflow-hidden bg-gray-900 sm:aspect-[2/1] sm:w-full">
          {vignette && vignette !== affiche && (
            <Image
              src={vignette}
              alt=""
              fill
              sizes="96px"
              className="object-cover sm:hidden"
            />
          )}
          {affiche ? (
            <Image
              src={affiche}
              alt=""
              fill
              sizes="(max-width: 639px) 96px, (max-width: 1023px) 50vw, 360px"
              className={`object-cover transition-transform duration-300 group-hover:scale-105 ${
                vignette !== affiche ? "hidden sm:block" : ""
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-700 via-gray-900 to-black">
              <Trophy size={28} strokeWidth={1.4} className="text-emerald-400 sm:size-9" />
            </div>
          )}
          <span
            className={`absolute left-3 top-3 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider sm:inline-flex ${badge.bg} ${badge.color}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {t.statut(competition.status)}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1 py-3 pl-4 pr-14 sm:gap-1.5 sm:p-4">
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider sm:hidden ${badge.color}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
            {t.statut(competition.status)}
          </span>
          <h3 className="line-clamp-2 font-display text-[15px] font-black leading-tight tracking-tight text-gray-900 transition-colors group-hover:text-emerald-700 sm:text-base">
            {competition.name}
            <BadgeCategorie categorie={competition.category} className="ml-2 align-middle" />
          </h3>
          {competition.organizerName && (
            <p className="truncate text-[11px] font-bold text-gray-400">
              {t.par(competition.organizerName)}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px] font-bold text-gray-500 sm:flex-col">
            {dateRange && (
              <span className="flex min-w-0 items-center gap-1.5">
                <CalendarDays size={13} className="shrink-0 text-gray-300" />
                <span className="truncate">{dateRange}</span>
              </span>
            )}
            {competition.venueCity && (
              <span className="flex min-w-0 items-center gap-1.5">
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
