"use client";

import Link from "next/link";
import { CalendarDays, Globe2, Trophy } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { FootballCompetition } from "@/lib/football-data";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { LOCALE_DATE_FNS } from "@/i18n/dates";

const T = textes(
  {
    aPartirDe: (d: string) => `À partir de ${d}`,
    jusqua: (d: string) => `Jusqu'à ${d}`,
    coupe: "Coupe",
    championnat: "Championnat",
  },
  {
    aPartirDe: (d: string) => `From ${d}`,
    jusqua: (d: string) => `Until ${d}`,
    coupe: "Cup",
    championnat: "League",
  },
);

// ============================================
// WorldCompetitionCard
//
// Directory tile for a football-data.org competition, sitting in the same grid
// as the Koppafoot ones. Deliberately a different silhouette, emblem on a dark
// panel rather than a banner photo, so the two families never read as the same
// thing: one you can join, one you only follow.
//
// Emblems and flags are provider URLs → plain <img>, matching the other
// football-data components.
// ============================================

/** Season window, e.g. "août 2026, mai 2027". Guards invalid/absent ISO. */
function seasonLabel(
  start: string | null,
  end: string | null,
  locale: (typeof LOCALE_DATE_FNS)["fr"],
  t: (typeof T)["fr"],
): string | null {
  const fmt = (d: string) => {
    try {
      return format(parseISO(d), "MMM yyyy", { locale });
    } catch {
      return d;
    }
  };
  if (start && end) return `${fmt(start)}, ${fmt(end)}`;
  if (start) return t.aPartirDe(fmt(start));
  if (end) return t.jusqua(fmt(end));
  return null;
}

export default function WorldCompetitionCard({
  competition,
}: {
  competition: FootballCompetition;
}) {
  const { langue } = useLangue();
  const t = useTextes(T);
  const season = seasonLabel(competition.seasonStart, competition.seasonEnd, LOCALE_DATE_FNS[langue], t);
  const pays = langue === "en" ? (competition.areaEn ?? competition.area) : competition.area;
  const isCup = competition.type === "CUP";

  return (
    <Link
      href={`/competitions/monde/${competition.code}`}
      className="group flex flex-col overflow-hidden transition-all hover:border-emerald-200"
    >
      {/* Emblem panel */}
      <div className="relative flex aspect-[16/9] w-full items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950">
        {competition.emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={competition.emblem}
            alt=""
            className="h-16 w-16 object-contain transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <Trophy size={32} className="text-emerald-400" />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200 backdrop-blur-sm">
          <Globe2 size={11} />
          {isCup ? t.coupe : t.championnat}
        </span>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-display text-base font-black leading-tight tracking-tight text-gray-900">
          {competition.name}
        </h3>
        <div className="mt-auto flex flex-col gap-1 text-[11px] font-bold text-gray-400">
          {pays && (
            <span className="flex items-center gap-1.5">
              {competition.areaFlag ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={competition.areaFlag} alt="" className="h-3 w-4 shrink-0 object-cover" />
              ) : (
                <Globe2 size={13} className="shrink-0 text-gray-300" />
              )}
              <span className="truncate">{pays}</span>
            </span>
          )}
          {season && (
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} className="shrink-0 text-gray-300" />
              <span className="truncate">{season}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
