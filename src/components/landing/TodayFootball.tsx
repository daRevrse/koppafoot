"use client";

import { motion } from "motion/react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import type { FootballMatch, TodayFootball as TodayFootballData } from "@/lib/football-data";

// ============================================
// TodayFootball
// ============================================
// Real scores for the home. Receives a PLAIN TodayFootball object from the page
// Server Component (page.tsx fetches via @/lib/football-data) — this client
// component never imports the server-only lib.
//
// Football crests/emblems are arbitrary provider URLs → plain <img>.
// Renders nothing when there is no football today (graceful degradation).

const EASE = [0.22, 1, 0.36, 1] as const;
const LIMIT = 6;

function kickoff(utcDate: string): string {
  try {
    return format(parseISO(utcDate), "HH:mm", { locale: fr });
  } catch {
    return "";
  }
}

function Emblem({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="h-4 w-4 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-4 w-4 shrink-0 object-contain" />
  );
}

function Crest({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="h-5 w-5 shrink-0 rounded-full bg-white/10" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className="h-5 w-5 shrink-0 object-contain" />
  );
}

function MatchRow({ match, live }: { match: FootballMatch; live?: boolean }) {
  const hasScore = match.scoreHome != null && match.scoreAway != null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <Emblem src={match.competition.emblem} alt={match.competition.name} />
      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
        <div className="flex items-center justify-end gap-2 min-w-0">
          <span className="truncate text-right text-sm font-bold text-white">
            {match.home.name}
          </span>
          <Crest src={match.home.crest} alt={match.home.name} />
        </div>
        <span className="shrink-0 rounded-lg bg-black/30 px-2.5 py-1 text-center font-display text-sm font-black tabular-nums text-white">
          {live || hasScore ? (
            <>
              {match.scoreHome ?? 0}
              <span className="mx-1 text-white/40">–</span>
              {match.scoreAway ?? 0}
            </>
          ) : (
            kickoff(match.utcDate) || "vs"
          )}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          <Crest src={match.away.crest} alt={match.away.name} />
          <span className="truncate text-left text-sm font-bold text-white">
            {match.away.name}
          </span>
        </div>
      </div>
    </div>
  );
}

function Group({
  title,
  matches,
  live,
  pulse,
}: {
  title: string;
  matches: FootballMatch[];
  live?: boolean;
  pulse?: boolean;
}) {
  if (matches.length === 0) return null;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
        <h3
          className={`text-[11px] font-black uppercase tracking-[0.2em] ${
            pulse ? "text-red-400" : "text-emerald-300"
          }`}
        >
          {title}
        </h3>
      </div>
      <div className="space-y-2">
        {matches.slice(0, LIMIT).map((m) => (
          <MatchRow key={m.id} match={m} live={live} />
        ))}
      </div>
    </div>
  );
}

export default function TodayFootball({ today }: { today: TodayFootballData }) {
  if (
    today.live.length === 0 &&
    today.finished.length === 0 &&
    today.upcoming.length === 0
  ) {
    return null;
  }

  return (
    <section className="bg-gray-950 px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-8"
        >
          <h2 className="font-display text-3xl font-black tracking-tight text-white">
            Football aujourd&apos;hui
          </h2>
          <p className="mt-1 text-sm font-bold text-white/40">
            Les scores du jour, en direct.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
          className="space-y-8"
        >
          <Group title="En direct" matches={today.live} live pulse />
          <Group title="Derniers résultats" matches={today.finished} live />
          <Group title="À venir" matches={today.upcoming} />
        </motion.div>
      </div>
    </section>
  );
}
