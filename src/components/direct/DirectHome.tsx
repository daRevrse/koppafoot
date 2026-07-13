"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays, ChevronRight, ChevronLeft, Trophy, MapPin,
} from "lucide-react";
import {
  listPublicCompetitions, onCompMatches, listCompTeams,
  computeStandings, computeTopScorers,
} from "@/lib/competition-firestore";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// DirectHome — the live-score home, served publicly at "/".
// ValueBet-style dashboard: hero image match card, underlined tabs,
// fixtures grouped by poule, right rail (standings / scorers / Tribune).
// Competition selection is URL-driven (?c=slug) so the sidebar and the
// header quick logos can drive it.
// ============================================

type Tab = "all" | "live" | "finished" | "upcoming";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "live", label: "En direct" },
  { key: "finished", label: "Terminés" },
  { key: "upcoming", label: "À venir" },
];

// ---- helpers ------------------------------------------------------------------

function shortDay(date: string): string {
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit",
    });
  } catch {
    return date;
  }
}

function heroDate(date: string): string {
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

function TeamBadge({ name, logo, size = 26 }: { name: string; logo?: string | null; size?: number }) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.36) }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

// ---- Hero match card (image, ValueBet-style) -------------------------------------

// Prefer the live team-doc logo (always current) over the match's
// denormalised snapshot (stale if the logo was uploaded after the fixture).
function logoFor(
  teamsById: Map<string, CompTeam>,
  teamId: string | null,
  fallback: string | null,
): string | null {
  return (teamId ? teamsById.get(teamId)?.logoUrl : null) ?? fallback;
}

function HeroMatchCard({
  match, competition, teamsById,
}: {
  match: CompMatch; competition: Competition; teamsById: Map<string, CompTeam>;
}) {
  const [, forceTick] = useState(0);
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const homeLogo = logoFor(teamsById, match.homeTeamId, match.homeTeamLogo);
  const awayLogo = logoFor(teamsById, match.awayTeamId, match.awayTeamLogo);

  useEffect(() => {
    if (!isLive) return;
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [isLive]);

  const bg = competition.bannerUrl ?? "/branding/hero_stadium.png";

  return (
    <Link href={`/c/${competition.slug}/matches/${match.id}`} className="block">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl shadow-sm transition-transform hover:scale-[1.005]"
      >
        {/* Background image + overlay */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/95 via-emerald-950/40 to-emerald-950/30" />

        <div className="relative flex min-h-[240px] flex-col justify-between p-5 sm:min-h-[280px] sm:p-6">
          {/* Top row: date/live badge + competition pill */}
          <div className="flex items-start justify-between gap-2">
            {isLive ? (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1 text-xs font-black text-white">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                </span>
                EN DIRECT {liveMinute(match)}&apos;
              </span>
            ) : (
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
                {finished
                  ? "Terminé"
                  : match.date
                    ? `${heroDate(match.date)}${match.time ? ` · ${match.time}` : ""}`
                    : "À programmer"}
              </span>
            )}
            <span className="truncate rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-emerald-100 backdrop-blur-sm">
              {competition.name}{match.group ? ` · Poule ${match.group}` : ""}
            </span>
          </div>

          {/* Bottom: teams + score */}
          <div>
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <TeamBadge name={match.homeTeamName} logo={homeLogo} size={42} />
                <span className="truncate font-display text-lg font-black text-white sm:text-2xl">
                  {match.homeTeamName}
                </span>
              </div>

              <div className="shrink-0 text-center">
                {isLive || finished ? (
                  <span className="font-display text-3xl font-black tabular-nums text-white sm:text-4xl">
                    {match.scoreHome ?? 0}
                    <span className="mx-1.5 text-white/40">:</span>
                    {match.scoreAway ?? 0}
                  </span>
                ) : (
                  <span className="font-display text-2xl font-black text-emerald-300 sm:text-3xl">
                    {match.time ?? "VS"}
                  </span>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5">
                <span className="truncate text-right font-display text-lg font-black text-white sm:text-2xl">
                  {match.awayTeamName}
                </span>
                <TeamBadge name={match.awayTeamName} logo={awayLogo} size={42} />
              </div>
            </div>

            {/* Info bar */}
            <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-emerald-100 backdrop-blur-sm">
              {match.venueName && (
                <>
                  <MapPin size={12} className="text-emerald-300" />
                  <span>{match.venueName}</span>
                  <span className="text-white/30">·</span>
                </>
              )}
              <span>Voir le match</span>
              <ChevronRight size={13} className="text-emerald-300" />
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

// ---- Match row (time | home | score | away | venue) --------------------------------

function MatchRow({
  match, competition, teamsById,
}: {
  match: CompMatch; competition: Competition; teamsById: Map<string, CompTeam>;
}) {
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const homeLogo = logoFor(teamsById, match.homeTeamId, match.homeTeamLogo);
  const awayLogo = logoFor(teamsById, match.awayTeamId, match.awayTeamLogo);

  return (
    <Link
      href={`/c/${competition.slug}/matches/${match.id}`}
      className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 transition-colors last:border-0 hover:bg-gray-50/70"
    >
      {/* Time column */}
      <div className="w-12 shrink-0 text-center">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-500">
            <span className="h-1 w-1 rounded-full bg-red-500" />
            {liveMinute(match)}&apos;
          </span>
        ) : (
          <>
            <p className="text-xs font-black tabular-nums text-gray-900">{match.time ?? "—"}</p>
            {match.date && (
              <p className="text-[10px] font-bold text-gray-300">{shortDay(match.date)}</p>
            )}
          </>
        )}
      </div>

      {/* Home */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TeamBadge name={match.homeTeamName} logo={homeLogo} size={24} />
        <span className={`truncate text-sm font-bold ${finished && (match.scoreHome ?? 0) < (match.scoreAway ?? 0) ? "text-gray-400" : "text-gray-900"}`}>
          {match.homeTeamName}
        </span>
      </div>

      {/* Score / VS */}
      {isLive || finished ? (
        <span className={`shrink-0 rounded-lg px-2.5 py-1 text-sm font-black tabular-nums text-white ${isLive ? "bg-red-500" : "bg-gray-900"}`}>
          {match.scoreHome ?? 0}:{match.scoreAway ?? 0}
        </span>
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-[9px] font-black text-gray-400">
          VS
        </span>
      )}

      {/* Away */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        <span className={`truncate text-right text-sm font-bold ${finished && (match.scoreAway ?? 0) < (match.scoreHome ?? 0) ? "text-gray-400" : "text-gray-900"}`}>
          {match.awayTeamName}
        </span>
        <TeamBadge name={match.awayTeamName} logo={awayLogo} size={24} />
      </div>

      {/* Venue (desktop) */}
      <span className="hidden w-20 shrink-0 truncate text-right text-[10px] font-bold text-gray-300 md:block">
        {match.venueName ?? ""}
      </span>
    </Link>
  );
}

// ---- Poule carousel (one group card at a time, arrow navigation) --------------------

function PouleCarousel({
  groups, competition, teamsById,
}: {
  groups: [string, CompMatch[]][]; competition: Competition; teamsById: Map<string, CompTeam>;
}) {
  const [idx, setIdx] = useState(0);

  // Clamp when the group set shrinks (e.g. a tab with fewer poules).
  const safeIdx = Math.min(idx, groups.length - 1);
  const [label, groupMatches] = groups[safeIdx];
  const hasLive = groupMatches.some((m) => m.status === "live");
  const single = groups.length <= 1;

  const go = (dir: 1 | -1) => {
    setIdx((i) => {
      const cur = Math.min(i, groups.length - 1);
      return (cur + dir + groups.length) % groups.length;
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      {/* Header: prev / label + indicator / next */}
      <div className="flex items-center gap-2.5 border-b border-gray-50 px-3 py-3">
        <button
          onClick={() => go(-1)}
          disabled={single}
          aria-label="Poule précédente"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white">
            {label.startsWith("Poule") ? label.slice(-1) : "★"}
          </span>
          <span className="truncate text-sm font-black text-gray-900">{label}</span>
          {hasLive && (
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-red-500">
              LIVE
            </span>
          )}
        </div>

        <button
          onClick={() => go(1)}
          disabled={single}
          aria-label="Poule suivante"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Matches for the active poule */}
      <AnimatePresence mode="wait">
        <motion.div
          key={label}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {groupMatches.map((m) => (
            <MatchRow key={m.id} match={m} competition={competition} teamsById={teamsById} />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Dots indicator */}
      {!single && (
        <div className="flex items-center justify-center gap-1.5 border-t border-gray-50 py-2.5">
          {groups.map(([gLabel], i) => (
            <button
              key={gLabel}
              onClick={() => setIdx(i)}
              aria-label={gLabel}
              className={`h-1.5 rounded-full transition-all ${
                i === safeIdx ? "w-4 bg-emerald-500" : "w-1.5 bg-gray-200 hover:bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Right rail cards ------------------------------------------------------------

function StandingsCard({
  matches, teams, competition,
}: {
  matches: CompMatch[]; teams: CompTeam[]; competition: Competition;
}) {
  const standings = useMemo(
    () => computeStandings(matches, teams, competition.format),
    [matches, teams, competition.format],
  );
  const [group, setGroup] = useState<string | null>(null);

  if (standings.length === 0) return null;
  const active = standings.find((s) => s.group === group) ?? standings[0];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Classement</h3>
        <Link
          href={`/c/${competition.slug}/standings`}
          className="text-[10px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600"
        >
          Tout voir
        </Link>
      </div>

      {standings.length > 1 && (
        <div className="mt-2.5 flex gap-1">
          {standings.map((s) => (
            <button
              key={s.group}
              onClick={() => setGroup(s.group)}
              className={`h-6 w-6 rounded-md text-[10px] font-black transition-colors ${
                s.group === active.group
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-50 text-gray-400 hover:bg-gray-100"
              }`}
            >
              {s.group}
            </button>
          ))}
        </div>
      )}

      <table className="mt-2.5 w-full text-xs">
        <thead>
          <tr className="text-[9px] font-black uppercase tracking-wide text-gray-300">
            <th className="pb-1.5 text-left">Équipe</th>
            <th className="pb-1.5 text-center">J</th>
            <th className="pb-1.5 text-center">+/-</th>
            <th className="pb-1.5 text-right">Pts</th>
          </tr>
        </thead>
        <tbody>
          {active.rows.slice(0, 4).map((row, i) => (
            <tr key={row.team.id} className="border-t border-gray-50">
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={`w-3 text-center text-[10px] font-black ${i < 2 ? "text-emerald-500" : "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <TeamBadge name={row.team.name} logo={row.team.logoUrl} size={16} />
                  <span className="truncate font-bold text-gray-700">
                    {row.team.shortName ?? row.team.name}
                  </span>
                </div>
              </td>
              <td className="py-1.5 text-center font-semibold tabular-nums text-gray-400">{row.played}</td>
              <td className="py-1.5 text-center font-semibold tabular-nums text-gray-400">
                {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
              </td>
              <td className="py-1.5 text-right font-black tabular-nums text-gray-900">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopScorersCard({
  matches, teams, competition,
}: {
  matches: CompMatch[]; teams: CompTeam[]; competition: Competition;
}) {
  const scorers = useMemo(() => computeTopScorers(matches).slice(0, 5), [matches]);
  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  if (scorers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900">Top buteurs</h3>
        <Link
          href={`/c/${competition.slug}/scorers`}
          className="text-[10px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600"
        >
          Tout voir
        </Link>
      </div>
      <div className="mt-2.5 space-y-1.5">
        {scorers.map((s, i) => {
          const team = teamById.get(s.teamId);
          return (
            <div key={`${s.teamId}-${s.playerName}`} className="flex items-center gap-2.5">
              <span className={`w-4 text-center text-[10px] font-black ${i === 0 ? "text-amber-400" : "text-gray-300"}`}>
                {i + 1}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[9px] font-black text-emerald-600">
                {s.playerName.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-gray-900">{s.playerName}</p>
                {team && <p className="truncate text-[10px] font-semibold text-gray-300">{team.name}</p>}
              </div>
              <span className="text-sm font-black tabular-nums text-gray-900">{s.goals}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Page -----------------------------------------------------------------------

export default function DirectHome({ initialCompetitions }: { initialCompetitions: Competition[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [competitions, setCompetitions] = useState<Competition[]>(initialCompetitions);
  const [compsLoading, setCompsLoading] = useState(initialCompetitions.length === 0);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  // Refresh the (ISR-cached) server list client-side.
  useEffect(() => {
    listPublicCompetitions()
      .then(setCompetitions)
      .catch(() => {})
      .finally(() => setCompsLoading(false));
  }, []);

  // URL-driven selection (?c=slug) — the sidebar/header quick logos drive it.
  const slug = searchParams.get("c");
  const competition = competitions.find((c) => c.slug === slug) ?? competitions[0] ?? null;

  // Resolve logos from the live team docs (always current) instead of the
  // match's denormalised snapshot.
  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Real-time fixtures + teams for the selected competition.
  useEffect(() => {
    if (!competition?.id) return;
    setMatches([]);
    setTeams([]);
    const unsub = onCompMatches(competition.id, setMatches);
    listCompTeams(competition.id).then(setTeams).catch(() => {});
    return () => unsub();
  }, [competition?.id]);

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

  // Tab filter, then bucket by poule (league-group style).
  const groups = useMemo(() => {
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

    const buckets = new Map<string, CompMatch[]>();
    for (const m of sorted) {
      const key = m.stage === "group" && m.group ? `Poule ${m.group}` : "Phase finale";
      const bucket = buckets.get(key) ?? [];
      bucket.push(m);
      buckets.set(key, bucket);
    }
    return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [matches, tab]);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Mobile competition selector (desktop uses the sidebar list) */}
      {competitions.length > 1 && (
        <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden">
          {competitions.map((c) => (
            <button
              key={c.id}
              onClick={() => router.replace(`/?c=${c.slug}`, { scroll: false })}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-black transition-colors ${
                c.id === competition?.id
                  ? "bg-emerald-500 text-white"
                  : "border border-gray-200 bg-white text-gray-500"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="min-w-0 space-y-5">
          {compsLoading ? (
            <div className="h-64 animate-pulse rounded-3xl bg-gray-200" />
          ) : !competition ? (
            <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-gray-200 bg-white py-16">
              <Trophy size={32} className="text-gray-300" />
              <h3 className="mt-4 font-display text-lg font-black text-gray-900">
                Aucune compétition en cours
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Les prochaines compétitions apparaîtront ici.
              </p>
            </div>
          ) : (
            <>
              {hero && <HeroMatchCard match={hero} competition={competition} teamsById={teamsById} />}

              {/* Section header + underlined tabs */}
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="min-w-0 truncate font-display text-xl font-black text-gray-900">
                    Matchs <span className="font-bold text-gray-300">de {competition.name}</span>
                  </h2>
                  <div className="flex shrink-0 items-center gap-3">
                    <FollowCompetitionButton cid={competition.id} />
                    <Link
                      href={`/c/${competition.slug}`}
                      className="hidden shrink-0 items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600 sm:flex"
                    >
                      Classements
                      <ChevronRight size={13} />
                    </Link>
                  </div>
                </div>
                <div className="mt-2 flex gap-5 border-b border-gray-200">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      className={`relative pb-2.5 text-sm font-bold transition-colors ${
                        tab === t.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {t.label}
                      {tab === t.key && (
                        <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Poule groups */}
              {groups.length === 0 ? (
                <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center shadow-sm">
                  <CalendarDays size={24} className="mx-auto text-gray-300" />
                  <p className="mt-2 text-sm text-gray-400">Aucun match dans cette catégorie.</p>
                </div>
              ) : (
                <PouleCarousel key={tab} groups={groups} competition={competition} teamsById={teamsById} />
              )}

              {/* Standings + top scorers */}
              <div className="grid gap-4 md:grid-cols-2">
                <StandingsCard matches={matches} teams={teams} competition={competition} />
                <TopScorersCard matches={matches} teams={teams} competition={competition} />
              </div>
            </>
          )}
      </div>
    </div>
  );
}
