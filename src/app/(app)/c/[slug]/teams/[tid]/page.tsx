"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Loader2, SearchX, CalendarDays, MapPin, Clock, ChevronRight, History, Shield, Users,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale/fr";
import {
  getCompetitionBySlug,
  onCompMatches,
  onCompTeams,
  computeStandings,
} from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompTeam, CompMatchRound } from "@/types";

// ============================================
// Helpers
// ============================================

// Knockout round → French label, for the per-match tag when `round` is set.
const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quart de finale",
  semi: "Demi-finale",
  final: "Finale",
  third_place: "Petite finale",
};

// Small stage tag: "Groupe A" for group matches, the round label for knockout.
function stageTag(match: CompMatch): string | null {
  if (match.group) return `Groupe ${match.group}`;
  if (match.round) return ROUND_LABELS[match.round];
  return null;
}

// French ordinal for a 1-based rank: 1ᵉʳ, 2ᵉ, 3ᵉ, …
function ordinal(rank: number): string {
  return rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`;
}

// Format a single ISO date, e.g. "samedi 18 juil." (fr). Falls back to raw.
function formatShortDate(date: string): string {
  try {
    const label = format(parseISO(date), "EEE d MMM", { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return date;
  }
}

// Team crest: real logo when present, otherwise a first-letter avatar.
function TeamBadge({ name, logo }: { name: string; logo: string | null }) {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-xs font-black text-gray-500">
      {logo ? (
        <Image src={logo} alt={name} width={32} height={32} className="h-full w-full object-cover" />
      ) : (
        <span>{name?.[0]?.toUpperCase() || "?"}</span>
      )}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function PublicTeamPage() {
  const { slug, tid } = useParams() as { slug: string; tid: string };
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  // Only judge "team introuvable" once teams have actually arrived from Firestore.
  const [teamsLoaded, setTeamsLoaded] = useState(false);

  // Resolve competition by slug, then subscribe to teams + matches in real time.
  // Anonymous reads work because Firestore rules allow read on competitions/**.
  useEffect(() => {
    if (!slug) return;
    let unsubTeams: (() => void) | undefined;
    let unsubMatches: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const comp = await getCompetitionBySlug(slug);
      if (cancelled) return;
      if (!comp) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCompetition(comp);
      setLoading(false);
      unsubTeams = onCompTeams(comp.id, (t) => {
        if (cancelled) return;
        setTeams(t);
        setTeamsLoaded(true);
      });
      unsubMatches = onCompMatches(comp.id, (m) => {
        if (!cancelled) setMatches(m);
      });
    })();

    return () => {
      cancelled = true;
      unsubTeams?.();
      unsubMatches?.();
    };
  }, [slug]);

  const team = useMemo(() => teams.find((t) => t.id === tid) ?? null, [teams, tid]);

  // The team's group rank + points, derived from the shared standings helper
  // (never recomputed inline). Null until the team is in a group with a table.
  const standing = useMemo(() => {
    if (!competition || !team || team.group == null) return null;
    const groups = computeStandings(matches, teams, competition.format);
    const group = groups.find((g) => g.group === team.group);
    if (!group) return null;
    const idx = group.rows.findIndex((r) => r.team.id === team.id);
    if (idx === -1) return null;
    return { rank: idx + 1, points: group.rows[idx].points };
  }, [competition, team, teams, matches]);

  // Matches involving this team (home or away), with a per-match "perspective"
  // helper: opponent name/logo and a win/loss/draw outcome for completed games.
  const teamMatches = useMemo(() => {
    if (!team) return [];
    return matches
      .filter((m) => m.homeTeamId === team.id || m.awayTeamId === team.id)
      .map((m) => {
        const isHome = m.homeTeamId === team.id;
        const opponentName = isHome ? m.awayTeamName : m.homeTeamName;
        const opponentLogo = isHome ? m.awayTeamLogo : m.homeTeamLogo;
        const teamScore = isHome ? m.scoreHome : m.scoreAway;
        const oppScore = isHome ? m.scoreAway : m.scoreHome;
        let outcome: "win" | "loss" | "draw" | null = null;
        if (m.status === "completed" && teamScore != null && oppScore != null) {
          outcome = teamScore > oppScore ? "win" : teamScore < oppScore ? "loss" : "draw";
        }
        return { match: m, isHome, opponentName, opponentLogo, teamScore, oppScore, outcome };
      });
  }, [matches, team]);

  // Next scheduled match (with a real date), ascending by date then time.
  const nextMatch = useMemo(() => {
    return teamMatches
      .filter((x) => x.match.status === "scheduled" && x.match.date != null)
      .sort((a, b) => {
        const d = (a.match.date as string).localeCompare(b.match.date as string);
        if (d !== 0) return d;
        if (a.match.time == null && b.match.time == null) return 0;
        if (a.match.time == null) return 1;
        if (b.match.time == null) return -1;
        return a.match.time.localeCompare(b.match.time);
      })[0] ?? null;
  }, [teamMatches]);

  // Played matches (live + completed), most recent first (undated last).
  const results = useMemo(() => {
    return teamMatches
      .filter((x) => x.match.status === "live" || x.match.status === "completed")
      .sort((a, b) => {
        // Live first, then by date desc; undated sorts last within each group.
        if (a.match.status !== b.match.status) {
          return a.match.status === "live" ? -1 : 1;
        }
        if (a.match.date == null && b.match.date == null) return 0;
        if (a.match.date == null) return 1;
        if (b.match.date == null) return -1;
        const d = b.match.date.localeCompare(a.match.date);
        if (d !== 0) return d;
        if (a.match.time == null && b.match.time == null) return 0;
        if (a.match.time == null) return 1;
        if (b.match.time == null) return -1;
        return b.match.time.localeCompare(a.match.time);
      });
  }, [teamMatches]);

  // Roster, sorted numeric-aware by dossard (NaN — blank/non-numeric — last).
  const roster = useMemo(() => {
    const players = team?.players ?? [];
    return [...players].sort((a, b) => {
      const na = parseInt(a.number, 10);
      const nb = parseInt(b.number, 10);
      const aNaN = Number.isNaN(na);
      const bNaN = Number.isNaN(nb);
      if (aNaN && bNaN) return a.name.localeCompare(b.name);
      if (aNaN) return 1;
      if (bNaN) return -1;
      return na - nb;
    });
  }, [team]);

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement de l&apos;équipe...</p>
      </div>
    );
  }

  if (notFound || !competition) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">Compétition introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Cette compétition n&apos;existe pas ou n&apos;est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  // Teams have loaded but none matches the requested id → team not found.
  if (teamsLoaded && !team) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gray-100 text-gray-300">
          <SearchX size={32} />
        </div>
        <div>
          <h1 className="font-display text-xl font-black text-gray-900">Équipe introuvable</h1>
          <p className="mt-1 text-sm font-bold text-gray-400 italic">
            Cette équipe n&apos;existe pas dans cette compétition.
          </p>
          <Link
            href={`/c/${slug}`}
            className="mt-4 inline-block text-xs font-black uppercase tracking-wider text-emerald-600 hover:text-emerald-700"
          >
            Retour à la compétition
          </Link>
        </div>
      </div>
    );
  }

  // Still awaiting the first teams snapshot (competition resolved, team unknown).
  if (!team) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="font-bold text-gray-500 italic">Chargement de l&apos;équipe...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center"
      >
        <span className="mb-3 block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 italic">
          <Link href={`/c/${slug}`} className="hover:text-emerald-600">
            {competition.name}
          </Link>
        </span>

        <div
          className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border border-gray-100 bg-gray-50 text-3xl font-black text-gray-400 shadow-sm"
          style={!team.logoUrl && team.color ? { backgroundColor: team.color, color: "#fff" } : undefined}
        >
          {team.logoUrl ? (
            <Image
              src={team.logoUrl}
              alt={team.name}
              width={96}
              height={96}
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{team.name?.[0]?.toUpperCase() || "?"}</span>
          )}
        </div>

        <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">{team.name}</h1>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {team.group && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-gray-600">
              <Shield size={12} />
              Groupe {team.group}
            </span>
          )}
          {standing && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-700">
              {ordinal(standing.rank)} · {standing.points} pts
            </span>
          )}
        </div>
      </motion.section>

      {/* Prochain match */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <CalendarDays size={15} className="text-emerald-500" />
          <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
            Prochain match
          </h2>
        </div>

        {nextMatch ? (
          <Link
            href={`/c/${slug}/matches/${nextMatch.match.id}`}
            className="group block overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-50 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                {stageTag(nextMatch.match) && (
                  <span className="truncate rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {stageTag(nextMatch.match)}
                  </span>
                )}
                <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  {nextMatch.isHome ? "Domicile" : "Extérieur"}
                </span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-600">
                À venir
              </span>
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex min-w-0 flex-1 items-center justify-end gap-2.5 text-right">
                <span className="truncate text-sm font-bold text-gray-900">{nextMatch.match.homeTeamName}</span>
                <TeamBadge name={nextMatch.match.homeTeamName} logo={nextMatch.match.homeTeamLogo} />
              </div>
              <span className="shrink-0 px-1 text-sm font-black text-gray-300">VS</span>
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <TeamBadge name={nextMatch.match.awayTeamName} logo={nextMatch.match.awayTeamLogo} />
                <span className="truncate text-sm font-bold text-gray-900">{nextMatch.match.awayTeamName}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-50 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-3 text-[11px] font-bold text-gray-400">
                {nextMatch.match.date && (
                  <span className="flex shrink-0 items-center gap-1">
                    <CalendarDays size={12} />
                    {formatShortDate(nextMatch.match.date)}
                  </span>
                )}
                {nextMatch.match.time && (
                  <span className="flex shrink-0 items-center gap-1">
                    <Clock size={12} />
                    {nextMatch.match.time}
                  </span>
                )}
                {nextMatch.match.venueName && (
                  <span className="flex min-w-0 items-center gap-1">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{nextMatch.match.venueName}</span>
                  </span>
                )}
              </div>
              <ChevronRight
                size={16}
                className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500"
              />
            </div>
          </Link>
        ) : (
          <div className="rounded-[1.75rem] border border-gray-100 bg-white px-5 py-8 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-400 italic">Aucun match à venir.</p>
          </div>
        )}
      </section>

      {/* Résultats */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <History size={15} className="text-emerald-500" />
          <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
            Résultats
          </h2>
        </div>

        {results.length === 0 ? (
          <div className="rounded-[1.75rem] border border-gray-100 bg-white px-5 py-8 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-400 italic">Aucun match joué pour l&apos;instant.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map(({ match, opponentName, opponentLogo, teamScore, oppScore, outcome }) => {
              const isLive = match.status === "live";
              const tag = stageTag(match);
              // Subtle accent strip on the left for the team's perspective.
              const accent =
                outcome === "win"
                  ? "border-l-emerald-400"
                  : outcome === "loss"
                    ? "border-l-red-300"
                    : outcome === "draw"
                      ? "border-l-gray-300"
                      : "border-l-transparent";
              const outcomeBadge =
                outcome === "win"
                  ? { label: "Victoire", cls: "bg-emerald-50 text-emerald-700" }
                  : outcome === "loss"
                    ? { label: "Défaite", cls: "bg-red-50 text-red-600" }
                    : outcome === "draw"
                      ? { label: "Nul", cls: "bg-gray-100 text-gray-500" }
                      : null;
              return (
                <Link
                  key={match.id}
                  href={`/c/${slug}/matches/${match.id}`}
                  className={`group block overflow-hidden rounded-[1.75rem] border border-l-4 bg-white shadow-sm transition-all hover:shadow-lg ${
                    isLive ? "border-red-100 hover:border-red-200" : "border-gray-100 hover:border-emerald-200"
                  } ${accent}`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-gray-50 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      {tag && (
                        <span className="truncate rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                          {tag}
                        </span>
                      )}
                    </div>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-red-600">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                        En direct
                      </span>
                    ) : outcomeBadge ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${outcomeBadge.cls}`}
                      >
                        {outcomeBadge.label}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {/* Opponent on the right, this team's crest implied by the score. */}
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <TeamBadge name={opponentName} logo={opponentLogo} />
                      <span className="truncate text-sm font-bold text-gray-900">{opponentName}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 px-1">
                      <span className="text-lg font-black tabular-nums text-gray-900">{teamScore ?? 0}</span>
                      <span className="text-sm font-black text-gray-300">-</span>
                      <span className="text-lg font-black tabular-nums text-gray-900">{oppScore ?? 0}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Effectif */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Users size={15} className="text-emerald-500" />
          <h2 className="font-display text-sm font-black uppercase tracking-tight text-gray-900">
            Effectif
          </h2>
        </div>

        {roster.length === 0 ? (
          <div className="rounded-[1.75rem] border border-gray-100 bg-white px-5 py-8 text-center shadow-sm">
            <p className="text-sm font-bold text-gray-400 italic">Effectif non communiqué.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm">
            {roster.map((player) => (
              <div key={player.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-xs font-black tabular-nums text-gray-500">
                  {player.number || "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                  {player.name}
                </span>
                {player.position && (
                  <span className="shrink-0 rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {player.position}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
