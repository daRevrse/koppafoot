"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Radio, CalendarDays, ChevronRight, Trophy, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listPublicCompetitions, onCompMatches } from "@/lib/competition-firestore";
import { onPosts } from "@/lib/firestore";
import type { Competition, CompMatch, Post } from "@/types";

// ============================================
// DirectHome — the live-score home, served publicly at "/".
// Receives server-fetched competitions for first paint (SEO/shares),
// then goes real-time client-side. Auth only unlocks privileges in the
// surrounding shell — the content itself is identical for guests.
// ============================================

type Tab = "all" | "live" | "finished" | "upcoming";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "live", label: "En direct" },
  { key: "finished", label: "Terminés" },
  { key: "upcoming", label: "À venir" },
];

// ---- date helpers -----------------------------------------------------------

function dayLabel(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return date;
  }
}

/** Live minute from the shared live_state clock (same math as LiveMatchConsole). */
function liveMinute(m: CompMatch): number {
  const ls = m.liveState;
  if (!ls) return 0;
  if (m.status === "live" && ls.isTimerRunning && ls.timerStartAt) {
    const elapsed = Date.now() - new Date(ls.timerStartAt).getTime() + (ls.timerOffset || 0);
    return Math.floor(elapsed / 60000) + 1;
  }
  return Math.floor((ls.timerOffset || 0) / 60000) + 1;
}

// ---- Team logo --------------------------------------------------------------

function TeamBadge({ name, logo, size = 28 }: { name: string; logo?: string | null; size?: number }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ---- Hero match card ----------------------------------------------------------

function HeroMatchCard({ match, competition }: { match: CompMatch; competition: Competition }) {
  const [, forceTick] = useState(0);
  const isLive = match.status === "live";

  // Re-render every 30s so the live minute ticks.
  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [isLive]);

  const href = `/c/${competition.slug}/matches/${match.id}`;
  const finished = match.status === "completed";

  return (
    <Link href={href} className="block">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-2xl bg-emerald-950 p-5 text-white transition-transform hover:scale-[1.01] sm:p-6"
      >
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          {isLive ? (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-2.5 py-0.5 text-white">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              EN DIRECT {liveMinute(match)}&apos;
            </span>
          ) : finished ? (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-emerald-200">Terminé</span>
          ) : (
            <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-emerald-200">
              {match.date ? `${dayLabel(match.date)}${match.time ? ` · ${match.time}` : ""}` : "À programmer"}
            </span>
          )}
          <span className="truncate text-emerald-300/70">
            {competition.name}
            {match.group ? ` · Poule ${match.group}` : ""}
          </span>
        </div>

        <div className="mt-5 flex items-center justify-center gap-4 sm:gap-8">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:justify-end">
            <span className="order-2 truncate text-sm font-bold text-emerald-50 sm:order-1 sm:text-base">
              {match.homeTeamName}
            </span>
            <span className="order-1 sm:order-2">
              <TeamBadge name={match.homeTeamName} logo={match.homeTeamLogo} size={40} />
            </span>
          </div>

          {isLive || finished ? (
            <div className="font-display text-3xl font-black tabular-nums sm:text-4xl">
              {match.scoreHome ?? 0}
              <span className="mx-2 text-white/30">–</span>
              {match.scoreAway ?? 0}
            </div>
          ) : (
            <div className="font-display text-2xl font-black text-emerald-300 sm:text-3xl">VS</div>
          )}

          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row">
            <TeamBadge name={match.awayTeamName} logo={match.awayTeamLogo} size={40} />
            <span className="truncate text-sm font-bold text-emerald-50 sm:text-base">
              {match.awayTeamName}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1 text-xs font-semibold text-emerald-300">
          {match.venueName && <span className="text-emerald-300/60">{match.venueName} ·</span>}
          Voir le match
          <ChevronRight size={14} />
        </div>
      </motion.div>
    </Link>
  );
}

// ---- Match row ----------------------------------------------------------------

function MatchRow({ match, competition }: { match: CompMatch; competition: Competition }) {
  const isLive = match.status === "live";
  const finished = match.status === "completed";

  return (
    <Link
      href={`/c/${competition.slug}/matches/${match.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
    >
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className="truncate text-sm font-semibold text-gray-900">{match.homeTeamName}</span>
        <TeamBadge name={match.homeTeamName} logo={match.homeTeamLogo} size={24} />
      </div>

      {isLive ? (
        <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1 text-sm font-black tabular-nums text-white">
          {match.scoreHome ?? 0}–{match.scoreAway ?? 0}
        </span>
      ) : finished ? (
        <span className="shrink-0 rounded-lg bg-gray-900 px-2.5 py-1 text-sm font-black tabular-nums text-white">
          {match.scoreHome ?? 0}–{match.scoreAway ?? 0}
        </span>
      ) : (
        <span className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-600">
          {match.time ?? "—"}
        </span>
      )}

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamBadge name={match.awayTeamName} logo={match.awayTeamLogo} size={24} />
        <span className="truncate text-sm font-semibold text-gray-900">{match.awayTeamName}</span>
      </div>

      {match.group && (
        <span className="hidden shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 sm:block">
          Poule {match.group}
        </span>
      )}
    </Link>
  );
}

// ---- Tribune rail ---------------------------------------------------------------

function TribuneRail({ uid }: { uid: string }) {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const unsub = onPosts(5, uid, setPosts);
    return () => unsub();
  }, [uid]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <MessageCircle size={15} className="text-emerald-600" />
          La Tribune
        </h3>
        <Link href="/feed" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
          Tout voir
        </Link>
      </div>

      <div className="mt-3 space-y-2.5">
        {posts.length === 0 && (
          <p className="py-4 text-center text-xs text-gray-400">Aucune publication pour le moment.</p>
        )}
        {posts.map((post) => (
          <div key={post.id} className="rounded-xl bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">
                {post.authorAvatar?.startsWith("http") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.authorAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  post.authorName.slice(0, 2).toUpperCase()
                )}
              </div>
              <span className="truncate text-xs font-bold text-gray-900">{post.authorName}</span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-gray-600">{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Page -----------------------------------------------------------------------

export default function DirectHome({ initialCompetitions }: { initialCompetitions: Competition[] }) {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>(initialCompetitions);
  const [compsLoading, setCompsLoading] = useState(initialCompetitions.length === 0);
  const [selectedCid, setSelectedCid] = useState<string | null>(initialCompetitions[0]?.id ?? null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  // Refresh the (ISR-cached) server list client-side; keep the selection.
  useEffect(() => {
    listPublicCompetitions()
      .then((comps) => {
        setCompetitions(comps);
        setSelectedCid((cur) => cur ?? comps[0]?.id ?? null);
      })
      .catch(() => {})
      .finally(() => setCompsLoading(false));
  }, []);

  // Real-time fixtures for the selected competition.
  useEffect(() => {
    if (!selectedCid) return;
    setMatches([]);
    const unsub = onCompMatches(selectedCid, setMatches);
    return () => unsub();
  }, [selectedCid]);

  const competition = competitions.find((c) => c.id === selectedCid) ?? null;

  // Featured match: live > next scheduled > latest completed.
  const hero = useMemo(() => {
    const live = matches.filter((m) => m.status === "live");
    if (live.length > 0) return live[0];
    const scheduled = matches
      .filter((m) => m.status === "scheduled" && m.date != null)
      .sort((a, b) => `${a.date}T${a.time ?? ""}`.localeCompare(`${b.date}T${b.time ?? ""}`));
    if (scheduled.length > 0) return scheduled[0];
    const completed = matches
      .filter((m) => m.status === "completed")
      .sort((a, b) => `${b.date ?? ""}T${b.time ?? ""}`.localeCompare(`${a.date ?? ""}T${a.time ?? ""}`));
    return completed[0] ?? null;
  }, [matches]);

  // Tab filter + group by day.
  const grouped = useMemo(() => {
    let list = matches;
    if (tab === "live") list = matches.filter((m) => m.status === "live");
    if (tab === "finished") list = matches.filter((m) => m.status === "completed");
    if (tab === "upcoming") list = matches.filter((m) => m.status === "scheduled");

    const asc = tab !== "finished";
    const sorted = [...list].sort((a, b) => {
      const ka = `${a.date ?? "9999"}T${a.time ?? ""}`;
      const kb = `${b.date ?? "9999"}T${b.time ?? ""}`;
      return asc ? ka.localeCompare(kb) : kb.localeCompare(ka);
    });

    const days = new Map<string, CompMatch[]>();
    for (const m of sorted) {
      const key = m.date ?? "";
      const bucket = days.get(key) ?? [];
      bucket.push(m);
      days.set(key, bucket);
    }
    return Array.from(days.entries());
  }, [matches, tab]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-gray-900">
          <Radio size={22} className="text-emerald-600" />
          Direct
        </h1>
        <p className="mt-1 text-sm text-gray-500">Les compétitions Koppafoot en temps réel.</p>
      </div>

      {/* Competition chips */}
      {competitions.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
          {competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCid(c.id)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                c.id === selectedCid
                  ? "bg-emerald-600 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-emerald-300"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Center column */}
        <div className="min-w-0 space-y-5">
          {compsLoading ? (
            <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
          ) : !competition ? (
            <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16">
              <Trophy size={32} className="text-gray-300" />
              <h3 className="mt-4 font-display text-lg font-bold text-gray-900">
                Aucune compétition en cours
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Les prochaines compétitions apparaîtront ici.
              </p>
            </div>
          ) : (
            <>
              {hero && <HeroMatchCard match={hero} competition={competition} />}

              {/* Tabs */}
              <div className="flex gap-1.5 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                      tab === t.key
                        ? "bg-gray-900 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
                <Link
                  href={`/c/${competition.slug}`}
                  className="ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Classements
                  <ChevronRight size={14} />
                </Link>
              </div>

              {/* Fixtures grouped by matchday */}
              {grouped.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center">
                  <CalendarDays size={24} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">Aucun match dans cette catégorie.</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                  {grouped.map(([date, dayMatches]) => (
                    <div key={date || "undated"}>
                      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                        {date ? dayLabel(date) : "Date à confirmer"}
                      </div>
                      <div className="divide-y divide-gray-50">
                        {dayMatches.map((m) => (
                          <MatchRow key={m.id} match={m} competition={competition} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right rail — desktop only (mobile has the Tribune tab) */}
        <div className="hidden xl:block">
          <div className="sticky top-6 space-y-4">
            <TribuneRail uid={user?.uid ?? ""} />
            {!user && (
              <div className="rounded-2xl bg-emerald-950 p-5 text-center">
                <p className="text-sm font-bold text-white">
                  Suis tes compétitions et reçois les buts en direct
                </p>
                <Link
                  href="/signup"
                  className="mt-3 inline-block rounded-full bg-emerald-500 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-400"
                >
                  Créer mon compte
                </Link>
              </div>
            )}
            <Link
              href="/competitions"
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-sm font-bold text-gray-900 transition-colors hover:border-emerald-300"
            >
              Toutes les compétitions
              <ChevronRight size={16} className="text-emerald-600" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
