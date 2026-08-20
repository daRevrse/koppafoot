"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { motion } from "motion/react";
import {
  History, Loader2, Activity, MapPin, Calendar, Clock, SearchX, Users,
  Goal, ArrowRightLeft, BarChart3, ListOrdered, Swords,
} from "lucide-react";
import type { LineupEntry } from "@/types";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import Link from "next/link";
import {
  getCompetitionBySlug, onCompMatch, onCompMatches, onCompTeams,
  computeStandings, OWN_GOAL_DETAIL,
} from "@/lib/competition-firestore";
import MatchRail from "@/components/match/MatchRail";
import type { CompMatch, CompMatchRound, CompTeam, CompetitionFormat } from "@/types";

// ============================================
// Helpers
// ============================================

// Ported verbatim from the (app)/matches/[id]/live spectator view.
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Knockout round -> French label, for the context line under the status.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

/** "2026-08-16" -> "16 août 2026". Falls back to the raw string. */
function matchDay(date: string): string {
  try {
    return format(parseISO(date), "d MMMM yyyy", { locale: fr });
  } catch {
    return date;
  }
}

const PERIODS = [
  { id: 1, label: "1ère Mi-temps" },
  { id: 2, label: "Mi-temps" },
  { id: 3, label: "2ème Mi-temps" },
  { id: 4, label: "Terminé" },
];

// Team crest: real logo when present, otherwise a first-letter avatar.
function TeamCrest({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden border border-white/10 bg-white/5 shadow-inner backdrop-blur-xl sm:mb-4 sm:h-20 sm:w-20">
      {logo ? (
        <Image src={logo} alt={name} width={80} height={80} className="h-full w-full object-cover" />
      ) : (
        <span className="text-2xl font-black sm:text-3xl">{name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// One side's match sheet: starters then substitutes (each group hidden when
// empty). Numbers are shown when set; rows fall back to a dash for the dossard.
function LineupColumn({ title, entries }: { title: string; entries: LineupEntry[] }) {
  const starters = entries.filter((e) => e.role === "starter");
  const substitutes = entries.filter((e) => e.role === "substitute");

  const renderRow = (entry: LineupEntry) => (
    <div key={entry.playerId || `${entry.number}-${entry.name}`} className="flex items-center gap-2.5 py-1.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-gray-50 text-[10px] font-black tabular-nums text-gray-500">
        {entry.number || ","}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">{entry.name}</span>
    </div>
  );

  return (
    <div className="min-w-0">
      <h4 className="mb-3 truncate text-sm font-black uppercase tracking-tight text-gray-900">{title}</h4>
      {starters.length > 0 && (
        <div className="mb-4">
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-300">Titulaires</p>
          <div className="divide-y divide-gray-50">{starters.map(renderRow)}</div>
        </div>
      )}
      {substitutes.length > 0 && (
        <div>
          <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-300">Remplaçants</p>
          <div className="divide-y divide-gray-50">{substitutes.map(renderRow)}</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function PublicCompMatchView() {
  const { slug, mid } = useParams() as { slug: string; mid: string };
  const [match, setMatch] = useState<CompMatch | null>(null);
  const [cid, setCid] = useState<string | null>(null);
  const [compBanner, setCompBanner] = useState<string | null>(null);
  const [compName, setCompName] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<
    "feed" | "lineups" | "stats" | "standings" | "h2h"
  >("feed");
  // Le classement et le face-a-face se calculent sur l'ensemble de la
  // competition, pas sur ce seul match : d'ou ces deux abonnements.
  const [compMatches, setCompMatches] = useState<CompMatch[]>([]);
  const [compTeams, setCompTeams] = useState<CompTeam[]>([]);
  const [compFormat, setCompFormat] = useState<CompetitionFormat | null>(null);
  const [compSlug, setCompSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [displayTime, setDisplayTime] = useState(0);

  // Resolve competition by slug, then subscribe to the match doc in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug || !mid) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const competition = await getCompetitionBySlug(slug);
      if (cancelled) return;
      if (!competition) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCid(competition.id);
      setCompBanner(competition.bannerUrl);
      setCompName(competition.name);
      setCompFormat(competition.format);
      setCompSlug(competition.slug ?? slug);
      unsub = onCompMatch(competition.id, mid, (m) => {
        if (cancelled) return;
        if (!m) setNotFound(true);
        setMatch(m);
        setLoading(false);
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [slug, mid]);

  // Classement et face-a-face : deux lectures de la competition entiere, donc
  // branchees seulement une fois l'identifiant resolu.
  useEffect(() => {
    if (!cid) return;
    const stopMatches = onCompMatches(cid, setCompMatches);
    const stopTeams = onCompTeams(cid, setCompTeams);
    return () => { stopMatches(); stopTeams(); };
  }, [cid]);

  // Server-clock timer. Same semantics as the spectator view: while the clock
  // runs we tick every 100ms from timerStartAt + timerOffset; when paused/stopped
  // the displayed value is the frozen timerOffset (derived at render below, so the
  // effect only drives the running interval, no synchronous setState in its body).
  useEffect(() => {
    const ls = match?.liveState;
    if (match?.status !== "live" || !ls || !ls.isTimerRunning || !ls.timerStartAt) return;

    const start = new Date(ls.timerStartAt).getTime();
    const offset = ls.timerOffset || 0;
    const interval = setInterval(() => {
      setDisplayTime(Date.now() - start + offset);
    }, 100);

    return () => clearInterval(interval);
  }, [match?.liveState, match?.status]);

  // Still resolving the slug (no cid yet) or awaiting the first match snapshot.
  if (loading || (cid && !match && !notFound)) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Connexion au direct...</p>
      </div>
    );
  }

  if (notFound || !match) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">Match introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Ce match n&apos;existe pas ou n&apos;est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const isLive = match.status === "live";
  const periodLabel =
    PERIODS.find((p) => p.id === match.liveState?.currentPeriod)?.label ||
    (match.status === "completed" ? "Terminé" : "À venir");
  const hasMeta = Boolean(match.venueName || match.date || match.time);
  // Competition name plus the round (or poule) this match belongs to.
  const roundLabel = match.round
    ? ROUND_LABELS[match.round]
    : match.group
      ? `Poule ${match.group}`
      : null;
  const contextLabel = [compName, roundLabel].filter(Boolean).join(" · ");
  // While the clock runs, show the ticking value; otherwise the frozen offset.
  const shownTime =
    match.liveState?.isTimerRunning && match.liveState.timerStartAt
      ? displayTime
      : match.liveState?.timerOffset || 0;

  return (
    <div className="mx-auto max-w-[1400px] pb-20">
      {/* Fil d'ariane. Il repond a « ou suis-je » sans reprendre le titre du
          match, qui est deja en grand juste en dessous. */}
      <nav
        aria-label="Fil d'ariane"
        className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400"
      >
        <Link href="/" className="transition-colors hover:text-emerald-700">Direct</Link>
        <span aria-hidden className="text-gray-300">›</span>
        {compSlug && compName ? (
          <Link href={`/c/${compSlug}`} className="transition-colors hover:text-emerald-700">
            {compName}
          </Link>
        ) : (
          <span>Compétition</span>
        )}
        {roundLabel && (
          <>
            <span aria-hidden className="text-gray-300">›</span>
            <span>{roundLabel}</span>
          </>
        )}
        <span aria-hidden className="text-gray-300">›</span>
        <span className="truncate text-gray-600">
          {match.homeTeamName}, {match.awayTeamName}
        </span>
      </nav>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-6">
      {/* Where this match sits: the competition, and its round or group. The
          generic "Centre de Match" title said nothing the page did not already
          show, and "Rapport de match" named the document rather than the game. */}
      <div className="flex items-center justify-center gap-2 text-center">
        {isLive && (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500 italic">
              En direct
            </span>
            {contextLabel && <span className="text-gray-200">·</span>}
          </>
        )}
        {contextLabel && (
          <h1 className="truncate text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
            {contextLabel}
          </h1>
        )}
      </div>

      {/* Main Scoreboard */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black p-5 text-white sm:p-8"
      >
        {/* Banner background: per-match → competition → none. A dark overlay
            keeps the scoreboard legible. */}
        {(match.bannerUrl || compBanner) && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={match.bannerUrl ?? compBanner ?? ""}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900/80 via-gray-900/70 to-black/80" />
          </>
        )}
        <div className="relative z-10 grid grid-cols-3 items-center gap-2 sm:gap-6">
          {/* Home */}
          <div className="text-center">
            <TeamCrest name={match.homeTeamName} logo={match.homeTeamLogo} />
            <h2 className="mb-1 truncate text-xs font-black uppercase tracking-tight sm:mb-2 sm:text-sm">{match.homeTeamName}</h2>
            <div className="text-5xl font-black tracking-tighter sm:text-7xl">{match.scoreHome || 0}</div>
          </div>

          {/* Center Info */}
          <div className="flex flex-col items-center justify-center">
            <div className="mb-3 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-emerald-400 sm:mb-4 sm:px-4 sm:text-[10px] sm:tracking-widest">
              {periodLabel}
            </div>
{/* The clock runs only for a match in progress. A finished one kept
                showing its frozen final time, which read like a live chrono
                stopped mid-second; one still to come showed 00:00. */}
            {isLive ? (
              <div className="font-mono text-2xl font-black text-emerald-500 drop- sm:text-5xl">
                {formatTime(shownTime)}
              </div>
            ) : match.status === "completed" ? null : (
              <div className="text-lg font-black text-white/50 italic">VS</div>
            )}
          </div>

          {/* Away */}
          <div className="text-center">
            <TeamCrest name={match.awayTeamName} logo={match.awayTeamLogo} />
            <h2 className="mb-1 truncate text-xs font-black uppercase tracking-tight sm:mb-2 sm:text-sm">{match.awayTeamName}</h2>
            <div className="text-5xl font-black tracking-tighter sm:text-7xl">{match.scoreAway || 0}</div>
          </div>
        </div>

        {/* Where and when, inside the frame rather than in a card of its own
            below it: these belong to the fixture, not beside it. */}
        {hasMeta && (
          <div className="relative z-10 mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-t border-white/10 pt-4 text-[11px] font-bold text-white/50">
            {match.venueName && (
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{match.venueName}</span>
              </span>
            )}
            {match.date && (
              <span className="flex items-center gap-1.5">
                <Calendar size={12} className="shrink-0" />
                {matchDay(match.date)}
              </span>
            )}
            {match.time && (
              <span className="flex items-center gap-1.5">
                <Clock size={12} className="shrink-0" />
                {match.time}
              </span>
            )}
          </div>
        )}
      </motion.div>

      {/* Tabs: match feed / lineups */}
      {(() => {
        const hasLineups = match.homeLineup.length > 0 || match.awayLineup.length > 0;
        const events = match.liveState?.events ?? [];
        const hasStats = events.length > 0;
        // Goals come from the scoreboard, not the timeline: an own goal is
        // recorded against the team that conceded it, so counting goal events
        // per team would credit the wrong side.
        const countBy = (type: string, teamId: string | null) =>
          events.filter((e) => e.type === type && e.teamId === teamId).length;
        const statRows = [
          { label: "Buts", home: match.scoreHome ?? 0, away: match.scoreAway ?? 0 },
          { label: "Cartons jaunes", home: countBy("yellow_card", match.homeTeamId), away: countBy("yellow_card", match.awayTeamId) },
          { label: "Cartons rouges", home: countBy("red_card", match.homeTeamId), away: countBy("red_card", match.awayTeamId) },
          { label: "Changements", home: countBy("substitution", match.homeTeamId), away: countBy("substitution", match.awayTeamId) },
        ];
        // Classement : uniquement si la competition a une phase de groupes
        // remplie. Une poule vide afficherait un tableau de zeros.
        const standings = compFormat ? computeStandings(compMatches, compTeams, compFormat) : [];
        const hasStandings = standings.some((g) => g.rows.length > 0);

        // Face-a-face : les rencontres terminees entre ces deux equipes dans
        // cette competition, celle-ci exclue. On ne remonte pas plus loin,
        // rien ne relie deux equipes d'une competition a l'autre.
        const h2h = (match.homeTeamId && match.awayTeamId)
          ? compMatches.filter((m) =>
              m.id !== mid
              && m.status === "completed"
              && m.scoreHome !== null && m.scoreAway !== null
              && ((m.homeTeamId === match.homeTeamId && m.awayTeamId === match.awayTeamId)
                || (m.homeTeamId === match.awayTeamId && m.awayTeamId === match.homeTeamId)))
          : [];
        const hasH2H = h2h.length > 0;

        const TABS = [
          { id: "feed" as const, label: "Résumé", Icon: History, on: true },
          { id: "lineups" as const, label: "Compos", Icon: Users, on: hasLineups },
          { id: "stats" as const, label: "Stats", Icon: BarChart3, on: hasStats },
          { id: "standings" as const, label: "Classement", Icon: ListOrdered, on: hasStandings },
          { id: "h2h" as const, label: "H2H", Icon: Swords, on: hasH2H },
        ].filter((t) => t.on);

        // Un onglet dont la donnee a disparu (compo retiree, classement vide)
        // ne doit pas laisser la page sur un panneau muet.
        const activeTab = TABS.some((t) => t.id === detailTab) ? detailTab : "feed";
        return (
          <div className=" border border-gray-200/70 bg-white p-5 sm:p-6">
            {/* Barre d'onglets. Pilotee par TABS : un onglet sans donnee
                derriere ne s'affiche pas du tout, plutot que de s'ouvrir sur
                un panneau vide. */}
            <div className="mb-8 flex gap-7 overflow-x-auto border-b border-gray-200/70">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id)}
                  className={`relative flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 pb-3 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                    activeTab === tab.id
                      ? "border-gray-900 text-gray-900"
                      : "border-transparent text-gray-400 hover:text-gray-700"
                  }`}
                >
                  <tab.Icon size={14} />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Stats panel: one row per metric, the two teams facing each
                other, with a bar showing each side's share. */}
            {activeTab === "stats" && hasStats && (
              <div className="space-y-5">
                {statRows.map((row) => {
                  const total = row.home + row.away;
                  const homePct = total === 0 ? 50 : (row.home / total) * 100;
                  return (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="w-8 text-left text-base font-black tabular-nums text-gray-900">
                          {row.home}
                        </span>
                        <span className="truncate text-[11px] font-black uppercase tracking-wide text-gray-400">
                          {row.label}
                        </span>
                        <span className="w-8 text-right text-base font-black tabular-nums text-gray-900">
                          {row.away}
                        </span>
                      </div>
                      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{ width: `${homePct}%` }}
                        />
                        <div
                          className="bg-gray-300 transition-all"
                          style={{ width: `${100 - homePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between gap-3 pt-1 text-[10px] font-black uppercase tracking-wide">
                  <span className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                    <span className="truncate">{match.homeTeamName}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <span className="truncate">{match.awayTeamName}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-gray-300" />
                  </span>
                </div>
              </div>
            )}

            {/* Lineups panel */}
            {activeTab === "lineups" && hasLineups && (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <LineupColumn title={match.homeTeamName} entries={match.homeLineup} />
                <LineupColumn title={match.awayTeamName} entries={match.awayLineup} />
              </div>
            )}

            {/* Feed panel */}
            {activeTab === "standings" && (
              <div className="space-y-8">
                {standings.filter((g) => g.rows.length > 0).map((group) => (
                  <div key={group.group}>
                    <h3 className="mb-3 border-b border-gray-200/70 pb-2 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
                      Poule {group.group}
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[30rem] text-sm">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                            <th className="py-2 pr-3 text-left font-black">Équipe</th>
                            <th className="px-2 py-2 text-right font-black">J</th>
                            <th className="px-2 py-2 text-right font-black">G</th>
                            <th className="px-2 py-2 text-right font-black">N</th>
                            <th className="px-2 py-2 text-right font-black">P</th>
                            <th className="px-2 py-2 text-right font-black">Diff</th>
                            <th className="py-2 pl-2 text-right font-black">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200/70">
                          {group.rows.map((row, i) => {
                            // Les deux equipes du match sont mises en avant :
                            // c'est la seule raison de lire ce tableau ici.
                            const involved = row.team.id === match.homeTeamId || row.team.id === match.awayTeamId;
                            return (
                              <tr key={row.team.id} className={involved ? "bg-emerald-50/60" : undefined}>
                                <td className="py-2.5 pr-3">
                                  <span className="flex items-center gap-2">
                                    <span className="w-5 shrink-0 text-right text-[11px] font-black tabular-nums text-gray-400">{i + 1}</span>
                                    <span className={`truncate ${involved ? "font-black text-gray-900" : "font-bold text-gray-700"}`}>
                                      {row.team.name}
                                    </span>
                                  </span>
                                </td>
                                <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{row.played}</td>
                                <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{row.won}</td>
                                <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{row.drawn}</td>
                                <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">{row.lost}</td>
                                <td className="px-2 py-2.5 text-right tabular-nums text-gray-500">
                                  {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                                </td>
                                <td className="py-2.5 pl-2 text-right font-display font-black tabular-nums text-gray-900">{row.points}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "h2h" && (
              <div className="space-y-5">
                {/* Le bilan d'abord, les rencontres ensuite. */}
                {(() => {
                  let hw = 0, d = 0, aw = 0;
                  for (const m of h2h) {
                    const hs = m.scoreHome ?? 0, as = m.scoreAway ?? 0;
                    const homeIsOurHome = m.homeTeamId === match.homeTeamId;
                    const ourHome = homeIsOurHome ? hs : as;
                    const ourAway = homeIsOurHome ? as : hs;
                    if (ourHome > ourAway) hw += 1;
                    else if (ourHome < ourAway) aw += 1;
                    else d += 1;
                  }
                  return (
                    <div className="grid grid-cols-3 gap-px border border-gray-200/70 bg-gray-200/70">
                      {[
                        { label: match.homeTeamName, value: hw },
                        { label: "Nuls", value: d },
                        { label: match.awayTeamName, value: aw },
                      ].map((x) => (
                        <div key={x.label} className="bg-white p-4 text-center">
                          <p className="font-display text-3xl font-black tabular-nums text-gray-900">{x.value}</p>
                          <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{x.label}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                <div className="divide-y divide-gray-200/70 border border-gray-200/70">
                  {h2h.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className="min-w-0 flex-1 truncate text-right font-bold text-gray-900">{m.homeTeamName}</span>
                      <span className="shrink-0 font-display text-base font-black tabular-nums text-gray-900">
                        {m.scoreHome} <span className="text-gray-300">–</span> {m.scoreAway}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-bold text-gray-900">{m.awayTeamName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "feed" && (
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-[21px] top-4 bottom-4 w-0.5 bg-gray-50" />

          <div className="relative space-y-5 sm:space-y-7">
            {match.liveState?.events && match.liveState.events.length > 0 ? (
              [...match.liveState.events].reverse().map((event) => {
                const isHome = event.teamId === match.homeTeamId;
                const teamName = isHome ? match.homeTeamName : match.awayTeamName;
                const isSub = event.type === "substitution";
                // A goal the VAR is looking at, or took away. The disallowed
                // one stays in the feed, the crowd saw it, and the timeline
                // is what explains why the score did not move.
                const checking = event.type === "goal" && event.varStatus === "checking";
                const cancelled = event.type === "goal" && event.varStatus === "cancelled";
                return (
                  <div key={event.id} className="group flex items-start gap-3 sm:gap-5">
                    {/* Minute badge */}
                    <div
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center border-2 sm:h-11 sm:w-11 ${
                        cancelled
                          ? "border-gray-200/70 bg-gray-50 text-gray-300"
                          : checking
                            ? "border-amber-100 bg-amber-50 text-amber-600"
                            : event.type === "goal"
                          ? "border-emerald-100 bg-emerald-50 text-emerald-600"
                          : event.type === "yellow_card"
                            ? "border-amber-100 bg-amber-50 text-amber-500"
                            : event.type === "red_card"
                              ? "border-red-100 bg-red-50 text-red-500"
                              : "border-gray-200/70 bg-gray-50 text-gray-400"
                      }`}
                    >
                      {/* A result entered after the fact may carry no minute
                          (stored as 0), no goal is ever scored at the 0th. */}
                      <span className="text-[10px] font-black">
                        {event.minute ? `${event.minute}'` : ","}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        {/* Type marker */}
                        {event.type === "goal" && (
                          <Goal
                            size={15}
                            className={`shrink-0 ${cancelled ? "text-gray-300" : "text-emerald-600"}`}
                          />
                        )}
                        {event.type === "yellow_card" && (
                          <span className="h-3.5 w-2.5 shrink-0 bg-amber-400" />
                        )}
                        {event.type === "red_card" && (
                          <span className="h-3.5 w-2.5 shrink-0 bg-red-500" />
                        )}
                        {isSub && <ArrowRightLeft size={14} className="shrink-0 text-blue-500" />}
                        <span
                          className={`truncate text-xs font-black uppercase tracking-wide sm:text-sm ${
                            cancelled ? "text-gray-400 line-through" : "text-gray-900"
                          }`}
                        >
                          {event.type === "goal"
                            ? event.detail === OWN_GOAL_DETAIL ? "But contre son camp" : "But"
                            : event.type === "yellow_card"
                              ? "Carton jaune"
                              : event.type === "red_card"
                                ? event.detail === "2e carton jaune" ? "Expulsion (2e jaune)" : "Carton rouge"
                                : isSub
                                  ? "Changement"
                                  : "Événement"}
                        </span>
                        {checking && (
                          <span className="inline-flex shrink-0 items-center gap-1 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-700">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                            VAR
                          </span>
                        )}
                        {cancelled && (
                          <span className="shrink-0 bg-red-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-700">
                            Refusé
                          </span>
                        )}
                        <span className="ml-auto shrink-0 truncate text-[10px] font-black uppercase tracking-wide text-gray-300 max-w-[35%]">
                          {teamName}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-gray-500 sm:text-xs">
                        {isSub && event.detail ? event.detail : event.playerName || ""}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center bg-gray-50 text-gray-200">
                  <Activity size={32} />
                </div>
                <p className="text-sm font-bold text-gray-400 italic">Le match n&apos;a pas encore commencé...</p>
              </div>
            )}
          </div>
        </div>
            )}
          </div>
          );
        })()}
        </div>

        {/* Le rail de la page. Il est rendu ici et non par le shell : son
            contenu depend du match. ScoreShell referme sa gouttiere sur cette
            route (routeOwnsItsRail) pour ne pas reserver 320px par-dessus. */}
        <aside className="mt-6 lg:sticky lg:top-6 lg:mt-0">
          <MatchRail
            match={{
              id: mid,
              homeTeamName: match.homeTeamName,
              awayTeamName: match.awayTeamName,
              homeTeamLogo: match.homeTeamLogo,
              awayTeamLogo: match.awayTeamLogo,
              date: match.date,
              time: match.time,
              venueName: match.venueName,
              venueCity: match.venueCity,
              // Le pronostic ferme des que le match n'est plus a venir.
              started: match.status !== "scheduled",
              competition: compName
                ? { name: compName, href: compSlug ? `/c/${compSlug}` : "/", round: roundLabel }
                : null,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
