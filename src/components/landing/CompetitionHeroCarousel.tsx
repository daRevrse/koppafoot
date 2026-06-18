"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { CompetitionHeroSlide } from "@/lib/competition-admin";
import type { FootballCompetition, FootballMatch, TodayFootball } from "@/lib/football-data";
import type { CompMatch, CompetitionStatus } from "@/types";

// ============================================
// CompetitionHeroCarousel
// ============================================
// Fused hero: one slide per Koppafoot competition (banner + VS card on the left,
// results/upcoming list + CTA on the right), plus a final "mosaic" slide of real
// football competitions (football-data.org). Brand-hero fallback when there is
// no data at all.
//
// Receives PLAIN serializable props from page.tsx (a Server Component). This is a
// CLIENT component — it must NEVER import the server-only libs at runtime; only
// their exported TYPES are imported (import type) above.
//
// Competition banners/logos, team crests and provider emblems are arbitrary URLs
// → plain <img>. Local /branding assets use next/image.

const EASE = [0.22, 1, 0.36, 1] as const;
const AUTOPLAY_MS = 7000;

const STATUS_BADGE: Record<CompetitionStatus, { label: string; dot: string }> = {
  draft: { label: "Brouillon", dot: "bg-gray-400" },
  registration: { label: "À venir", dot: "bg-blue-400" },
  group_stage: { label: "En cours", dot: "bg-emerald-400" },
  knockout: { label: "Phase finale", dot: "bg-emerald-400" },
  completed: { label: "Terminée", dot: "bg-gray-400" },
};

function formatKickoff(date: string | null, time: string | null): string | null {
  let label: string | null = null;
  if (date) {
    try {
      label = format(parseISO(date), "EEE d MMM", { locale: fr });
    } catch {
      label = date;
    }
  }
  if (label && time) return `${label} · ${time}`;
  return label ?? time ?? null;
}

function fdKickoff(utcDate: string): string {
  try {
    return format(parseISO(utcDate), "HH:mm", { locale: fr });
  } catch {
    return "";
  }
}

// ----- Brand-hero fallback (brand markup from HeroSpotlight) ------------------
function BrandHero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <Image
        src="/branding/hero_stadium.png"
        alt="Football stadium atmosphere"
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-emerald-600/85" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-transparent" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-40 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="text-5xl font-black leading-[0.95] tracking-tight text-[#1A1715] font-display sm:text-7xl md:text-8xl lg:text-9xl uppercase"
        >
          Le foot{" "}
          <br className="hidden sm:block" />
          amateur{" "}
          <br className="hidden sm:block" />
          <span className="text-white drop-shadow-lg">en mieux.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
          className="mx-auto mt-8 max-w-xl text-lg text-[#1A1715]/80 font-medium leading-relaxed sm:text-xl"
        >
          KOPPAFOOT connecte les acteurs du football amateur.
          <br className="hidden sm:block" />
          Crée ton équipe, trouve des matchs, élargit ton réseau.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
          className="mt-12"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#1A1715] px-10 py-4.5 text-base font-bold text-white transition-all hover:shadow-2xl hover:shadow-[#1A1715]/20 hover:scale-[1.03] active:scale-[0.97]"
          >
            Rejoindre KOPPAFOOT
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={28} className="text-white/70" />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ----- Crest / emblem helpers -------------------------------------------------
function TeamCrest({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-full w-full rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 font-display font-black text-white/80"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// ----- VS card (featured match) ----------------------------------------------
function VsCard({ slug, featured }: { slug: string; featured: CompMatch | null }) {
  if (!featured) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
        <p className="text-sm font-bold text-white/50">Aucun match programmé</p>
      </div>
    );
  }

  const isLive = featured.status === "live";
  const showScore = featured.status === "live" || featured.status === "completed";

  const card = (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md transition-colors hover:bg-white/10 sm:p-6">
      {isLive && (
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">
            En direct
          </span>
        </div>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamCrest src={featured.homeTeamLogo} name={featured.homeTeamName} />
          <span className="line-clamp-2 text-xs font-black uppercase tracking-tight text-white sm:text-sm">
            {featured.homeTeamName}
          </span>
        </div>
        <div className="flex flex-col items-center">
          {showScore ? (
            <span className="rounded-xl bg-black/40 px-3 py-1.5 font-display text-2xl font-black tabular-nums text-white sm:text-3xl">
              {featured.scoreHome ?? 0}
              <span className="mx-1.5 text-white/40">–</span>
              {featured.scoreAway ?? 0}
            </span>
          ) : (
            <span className="font-display text-2xl font-black text-white/70 sm:text-3xl">VS</span>
          )}
          {!showScore && formatKickoff(featured.date, featured.time) && (
            <span className="mt-2 text-center text-[11px] font-bold text-white/50">
              {formatKickoff(featured.date, featured.time)}
            </span>
          )}
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <TeamCrest src={featured.awayTeamLogo} name={featured.awayTeamName} />
          <span className="line-clamp-2 text-xs font-black uppercase tracking-tight text-white sm:text-sm">
            {featured.awayTeamName}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <Link href={`/c/${slug}/matches/${featured.id}`} className="block">
      {card}
    </Link>
  );
}

// ----- Results / upcoming compact list ---------------------------------------
function ResultRow({ slug, match }: { slug: string; match: CompMatch }) {
  return (
    <Link
      href={`/c/${slug}/matches/${match.id}`}
      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:bg-white/10"
    >
      <span className="truncate flex-1 text-right text-xs font-bold text-white">
        {match.homeTeamName}
      </span>
      <span className="shrink-0 rounded-md bg-black/30 px-2 py-0.5 font-display text-xs font-black tabular-nums text-white">
        {match.scoreHome ?? 0}
        <span className="mx-1 text-white/40">–</span>
        {match.scoreAway ?? 0}
      </span>
      <span className="truncate flex-1 text-left text-xs font-bold text-white">
        {match.awayTeamName}
      </span>
    </Link>
  );
}

function UpcomingRow({ match }: { match: CompMatch }) {
  const kickoff = formatKickoff(match.date, match.time);
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="truncate flex-1 text-right text-xs font-bold text-white/90">
        {match.homeTeamName}
      </span>
      <span className="shrink-0 text-[10px] font-bold text-white/40">vs</span>
      <span className="truncate flex-1 text-left text-xs font-bold text-white/90">
        {match.awayTeamName}
      </span>
      {kickoff && (
        <span className="shrink-0 text-[10px] font-bold text-emerald-300">{kickoff}</span>
      )}
    </div>
  );
}

// ----- Koppafoot competition slide -------------------------------------------
function CompetitionSlide({ slide }: { slide: CompetitionHeroSlide }) {
  const { competition, featured, results, upcoming } = slide;
  const badge = STATUS_BADGE[competition.status];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left ~2/3: banner + VS card */}
      <div className="flex flex-col gap-5 lg:col-span-2">
        <div className="relative overflow-hidden rounded-3xl border border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={competition.bannerUrl ?? "/branding/hero_stadium.png"}
            alt={competition.name}
            className="h-44 w-full object-cover sm:h-56"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-gray-950/20" />
          <div className="absolute inset-0 flex items-end p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
                {competition.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={competition.logoUrl}
                    alt={competition.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Trophy size={26} className="text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/80 backdrop-blur-md">
                  <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                  {badge.label}
                </span>
                <h2 className="mt-1.5 line-clamp-2 font-display text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                  {competition.name}
                </h2>
              </div>
            </div>
          </div>
        </div>

        <VsCard slug={competition.slug} featured={featured} />
      </div>

      {/* Right ~1/3: results + upcoming + CTA */}
      <div className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
        <div className="flex-1 space-y-5">
          {results.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Résultats
              </h3>
              <div className="space-y-2">
                {results.map((m) => (
                  <ResultRow key={m.id} slug={competition.slug} match={m} />
                ))}
              </div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-white/50">
                À venir
              </h3>
              <div className="space-y-2">
                {upcoming.map((m) => (
                  <UpcomingRow key={m.id} match={m} />
                ))}
              </div>
            </div>
          )}
          {results.length === 0 && upcoming.length === 0 && (
            <p className="text-sm font-bold text-white/40">
              Le calendrier arrive bientôt.
            </p>
          )}
        </div>

        <Link
          href={`/c/${competition.slug}`}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]"
        >
          Suivre la compétition
        </Link>
      </div>
    </div>
  );
}

// ----- Real-football mosaic slide --------------------------------------------
function FdMatchRow({ match, live }: { match: FootballMatch; live?: boolean }) {
  const hasScore = match.scoreHome != null && match.scoreAway != null;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <span className="truncate flex-1 text-right text-xs font-bold text-white">
        {match.home.name}
      </span>
      <span className="shrink-0 rounded-md bg-black/30 px-2 py-0.5 text-center font-display text-xs font-black tabular-nums text-white">
        {live || hasScore ? (
          <>
            {match.scoreHome ?? 0}
            <span className="mx-1 text-white/40">–</span>
            {match.scoreAway ?? 0}
          </>
        ) : (
          fdKickoff(match.utcDate) || "vs"
        )}
      </span>
      <span className="truncate flex-1 text-left text-xs font-bold text-white">
        {match.away.name}
      </span>
    </div>
  );
}

function MosaicSlide({
  realCompetitions,
  today,
}: {
  realCompetitions: FootballCompetition[];
  today: TodayFootball;
}) {
  const finishedOrUpcoming = [...today.finished, ...today.upcoming].slice(0, 5);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Left ~2/3: competitions mosaic */}
      <div className="lg:col-span-2">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Football mondial
        </span>
        <h2 className="mb-5 font-display text-2xl font-black tracking-tight text-white sm:text-3xl">
          Grandes compétitions
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {realCompetitions.map((c) => (
            <div
              key={c.id}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center">
                {c.emblem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.emblem} alt={c.name} className="h-full w-full object-contain" />
                ) : (
                  <Trophy size={28} className="text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{c.name}</p>
                {c.area && <p className="truncate text-xs font-bold text-white/40">{c.area}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right ~1/3: today's real matches + CTA */}
      <div className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-md">
        <div className="flex-1 space-y-5">
          {today.live.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                </span>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">
                  En direct
                </h3>
              </div>
              <div className="space-y-2">
                {today.live.slice(0, 5).map((m) => (
                  <FdMatchRow key={m.id} match={m} live />
                ))}
              </div>
            </div>
          )}
          {finishedOrUpcoming.length > 0 && (
            <div>
              <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
                Aujourd&apos;hui
              </h3>
              <div className="space-y-2">
                {finishedOrUpcoming.map((m) => (
                  <FdMatchRow key={m.id} match={m} />
                ))}
              </div>
            </div>
          )}
          {today.live.length === 0 && finishedOrUpcoming.length === 0 && (
            <p className="text-sm font-bold text-white/40">Pas de match aujourd&apos;hui.</p>
          )}
        </div>

        <Link
          href="/competitions"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]"
        >
          Tous les scores
        </Link>
      </div>
    </div>
  );
}

// ============================================
// Component
// ============================================
export default function CompetitionHeroCarousel({
  slides,
  realCompetitions,
  today,
}: {
  slides: CompetitionHeroSlide[];
  realCompetitions: FootballCompetition[];
  today: TodayFootball;
}) {
  const hasMosaic = realCompetitions.length > 0;
  const count = slides.length + (hasMosaic ? 1 : 0);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (dir: number) => {
      setIndex((i) => (count === 0 ? 0 : (i + dir + count) % count));
    },
    [count],
  );

  // Gentle autoplay, paused on hover/touch, cleaned up on unmount.
  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  // No data at all → brand slide, skip the carousel chrome.
  if (count === 0) return <BrandHero />;

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  const isMosaic = hasMosaic && index === slides.length;

  return (
    <section
      className="relative overflow-hidden bg-gray-950 px-5 py-20 sm:px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="relative"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              {isMosaic ? (
                <MosaicSlide realCompetitions={realCompetitions} today={today} />
              ) : (
                <CompetitionSlide slide={slides[index]} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel chrome: arrows + dots */}
        {count > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Compétition précédente"
              onClick={() => go(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: count }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Aller à la diapositive ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-6 bg-emerald-400" : "w-2 bg-white/25 hover:bg-white/40"
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Compétition suivante"
              onClick={() => go(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
