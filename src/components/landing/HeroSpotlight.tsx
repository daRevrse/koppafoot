"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronDown, Trophy } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { Competition, CompMatch, CompetitionStatus } from "@/types";

// ============================================
// HeroSpotlight
// ============================================
// Competition-first hero. Receives PLAIN serializable props from the page
// Server Component (page.tsx fetches via @/lib/competition-admin). This file is
// a client component — it must NEVER import the server-only admin lib.
//
//  - featured == null  → brand-hero fallback (pre-launch / fetch-error). Copied
//    from HeroSection so the landing never crashes when Firestore is unreachable.
//  - featured != null  → competition spotlight: banner background, glassy card,
//    and a live/scheduled/none highlight-match branch driving the primary CTA.
//
// Competition logos/banners are organizer-entered arbitrary URLs → plain <img>
// (next/image would need every host whitelisted). Local /branding assets use
// next/image.

const EASE = [0.22, 1, 0.36, 1] as const;

// Public status → spotlight badge. Mirrors the directory card's language.
const STATUS_BADGE: Record<CompetitionStatus, { label: string; dot: string }> = {
  draft: { label: "Brouillon", dot: "bg-gray-400" },
  registration: { label: "À venir", dot: "bg-blue-400" },
  group_stage: { label: "En cours", dot: "bg-emerald-400" },
  knockout: { label: "Phase finale", dot: "bg-emerald-400" },
  completed: { label: "Terminée", dot: "bg-gray-400" },
};

// Human "lun. 22 juin · 18:00" from a (possibly null) ISO date + "HH:mm" time.
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

// ----- Brand-hero fallback (verbatim brand markup from HeroSection) -----------
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

// ----- Highlight-match block --------------------------------------------------
// Live → mini scoreboard + EN DIRECT pulse. Scheduled → "Prochain match" +
// kickoff. None → nothing (the card still shows the "Voir la compétition" CTA).
function HighlightBlock({ match }: { match: CompMatch }) {
  if (match.status === "live") {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">
            En direct
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="truncate text-right text-sm font-black uppercase tracking-tight text-white">
            {match.homeTeamName}
          </span>
          <span className="shrink-0 rounded-xl bg-black/30 px-3 py-1 font-display text-xl font-black tabular-nums text-white">
            {match.scoreHome ?? 0}
            <span className="mx-1 text-white/40">–</span>
            {match.scoreAway ?? 0}
          </span>
          <span className="truncate text-left text-sm font-black uppercase tracking-tight text-white">
            {match.awayTeamName}
          </span>
        </div>
      </div>
    );
  }

  // Scheduled (or any non-live with a record we still want to tease).
  const kickoff = formatKickoff(match.date, match.time);
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <p className="mb-2 text-center text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">
        Prochain match
      </p>
      <div className="flex items-center justify-center gap-2 text-sm font-black uppercase tracking-tight text-white">
        <span className="truncate">{match.homeTeamName}</span>
        <span className="text-white/40">vs</span>
        <span className="truncate">{match.awayTeamName}</span>
      </div>
      {kickoff && (
        <p className="mt-2 text-center text-xs font-bold text-white/60">{kickoff}</p>
      )}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function HeroSpotlight({
  featured,
}: {
  featured: { competition: Competition; highlightMatch: CompMatch | null } | null;
}) {
  // Pre-launch / fetch-error: no featured competition → brand hero, zero crash.
  if (!featured) return <BrandHero />;

  const { competition, highlightMatch } = featured;
  const badge = STATUS_BADGE[competition.status];
  const isLive = highlightMatch?.status === "live";

  // Primary CTA: live → follow the stream; otherwise → the competition home.
  const primaryHref = isLive
    ? `/c/${competition.slug}/matches/${highlightMatch.id}`
    : `/c/${competition.slug}`;
  const primaryLabel = isLive ? "Suivre le direct" : "Voir la compétition";

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gray-950">
      {/* Background: competition banner (arbitrary URL → plain <img>), falling
          back to the local stadium art. Dark gradient overlays keep the
          foreground card legible over any organizer image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={competition.bannerUrl ?? "/branding/hero_stadium.png"}
        alt={competition.name}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/80 to-gray-950/40" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/60 via-transparent to-transparent" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE }}
        className="relative z-10 mx-auto w-full max-w-lg px-6 py-32"
      >
        <div className="rounded-[2.5rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          {/* Competition identity */}
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {competition.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={competition.logoUrl}
                  alt={competition.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Trophy size={28} className="text-emerald-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/80">
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                {badge.label}
              </span>
              <h1 className="mt-1.5 truncate font-display text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                {competition.name}
              </h1>
            </div>
          </div>

          {/* Highlight match (live scoreboard / next match), if any. */}
          {highlightMatch && (
            <div className="mb-6">
              <HighlightBlock match={highlightMatch} />
            </div>
          )}

          {/* CTAs: primary (context-aware) + secondary (join). */}
          <div className="flex flex-col gap-3">
            <Link
              href={primaryHref}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]"
            >
              {primaryLabel}
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white/90 transition-all hover:bg-white/10"
            >
              Rejoindre Koppafoot
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
