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
    saison: (debut: string, fin: string) => `${debut} à ${fin}`,
    aPartirDe: (d: string) => `À partir de ${d}`,
    jusqua: (d: string) => `Jusqu'à ${d}`,
    coupe: "Coupe",
    championnat: "Championnat",
  },
  {
    saison: (debut: string, fin: string) => `${debut} to ${fin}`,
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

/** Season window, e.g. "août 2026 à mai 2027". Guards invalid/absent ISO. */
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
  if (start && end) return t.saison(fmt(start), fmt(end));
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

  // Même silhouette que les compétitions locales (une ligne sur téléphone,
  // une carte à partir de sm), avec un panneau sombre et l'emblème à la place
  // de l'affiche.
  return (
    <Link
      href={`/competitions/monde/${competition.code}`}
      className="group flex border border-gray-200/70 bg-white transition-colors hover:border-emerald-300 sm:flex-col"
    >
      {/* Emblem panel */}
      <div className="relative flex aspect-square w-24 shrink-0 items-center justify-center bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 sm:aspect-[2/1] sm:w-full">
        {competition.emblem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={competition.emblem}
            alt=""
            className="h-11 w-11 object-contain transition-transform duration-300 group-hover:scale-110 sm:h-16 sm:w-16"
          />
        ) : (
          <Trophy size={28} className="text-emerald-400" />
        )}
        <span className="absolute left-3 top-3 hidden items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-200 backdrop-blur-sm sm:inline-flex">
          <Globe2 size={11} />
          {isCup ? t.coupe : t.championnat}
        </span>
      </div>

      {/* Body */}
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 py-3 sm:gap-1.5 sm:p-4">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-gray-400 sm:hidden">
          <Globe2 size={11} />
          {isCup ? t.coupe : t.championnat}
        </span>
        <h3 className="line-clamp-2 font-display text-[15px] font-black leading-tight tracking-tight text-gray-900 transition-colors group-hover:text-emerald-700 sm:text-base">
          {competition.name}
        </h3>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px] font-bold text-gray-500 sm:flex-col">
          {pays && (
            <span className="flex min-w-0 items-center gap-1.5">
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
            <span className="flex min-w-0 items-center gap-1.5">
              <CalendarDays size={13} className="shrink-0 text-gray-300" />
              <span className="truncate">{season}</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
