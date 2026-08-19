"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  CalendarDays, ChevronRight, ChevronLeft, Trophy, MapPin,
  ChevronDown, Star, Flame,
} from "lucide-react";
import {
  onCompMatches, listCompTeams, describeBracketSlotSource,
} from "@/lib/competition-firestore";
import { useAuth } from "@/contexts/AuthContext";
import FollowCompetitionButton from "@/components/competition/FollowCompetitionButton";
import type { CompetitionFeed } from "@/lib/competition-admin";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// DirectHome — the live-score home, served publicly at "/".
//
// It answers one question: what is on right now, everywhere. It reads ACROSS
// every public competition: a banner carousel of the matches that matter,
// then the board itself.
//
// Le corps sous le hero suit désormais le modèle des tableaux de scores
// (FlashScore & co), parce que c'est la grammaire que le public connaît :
//
//   portée (Tous / Favoris / Compétitions)      ·  navigateur de date
//   pastilles de statut (En direct / Terminés / À venir)
//   une section repliable par COMPÉTITION, ses matchs dedans
//
// Deux changements de fond par rapport à la version « timeline » :
//  - on regroupe par compétition et plus par jour. Le jour est choisi en
//    haut, une fois ; à l'intérieur, ce qu'on cherche c'est « où en est ma
//    compétition », pas « qu'est-ce qui se joue à 16 h ».
//  - la ligne de match empile domicile au-dessus d'extérieur avec son score
//    en bout : sur un téléphone, deux noms d'équipe sur une seule ligne ne
//    tiennent pas sans tronquer.
//
// La colonne « Odds » du modèle n'a pas d'équivalent ici : KoppaFoot ne
// diffuse pas de cotes.
// ============================================

/** Un match et la compétition dont il relève — le tableau mélange les deux. */
type Entry = { match: CompMatch; competition: Competition };

/** Portée de la liste — l'ensemble, ce que l'utilisateur suit, ou les
 *  compétitions elles-mêmes. */
type Scope = "all" | "favorites" | "competitions";

const SCOPES: { key: Scope; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "favorites", label: "Favoris" },
  { key: "competitions", label: "Compétitions" },
];

/** Filtre de statut, en pastilles. `null` = pas de filtre. */
type StatusFilter = "live" | "finished" | "upcoming" | null;

// ---- helpers ------------------------------------------------------------------

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

  // Banner fallback chain: per-match → competition → default stadium.
  const bg = match.bannerUrl ?? competition.bannerUrl ?? "/branding/hero_stadium.png";

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

// ---- Match row (stacked: home over away, score at the end) -------------------------

/**
 * Nom affichable d'un côté de l'affiche.
 *
 * Un match de tableau dont le tirage n'est pas fait porte un nom d'équipe
 * vide : la ligne se rendait alors avec deux pastilles nues et rien à lire.
 * On retombe sur la provenance du créneau ("1er poule A"), comme la page
 * Tableau, et sinon sur le même « À déterminer ».
 */
function sideName(match: CompMatch, side: "home" | "away"): string {
  const name = side === "home" ? match.homeTeamName : match.awayTeamName;
  if (name) return name;
  const source = side === "home" ? match.homeSource : match.awaySource;
  return source ? describeBracketSlotSource(source) : "À déterminer";
}

/** Pastille d'un créneau que le tirage n'a pas encore rempli. */
function EmptyBadge({ size = 20 }: { size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border border-dashed border-gray-200 text-gray-300"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
    >
      ?
    </span>
  );
}

function ScoreCell({ value, dim }: { value: number; dim: boolean }) {
  return (
    <span
      className={`w-5 shrink-0 text-right font-display text-sm font-black tabular-nums ${
        dim ? "text-gray-400" : "text-gray-900"
      }`}
    >
      {value}
    </span>
  );
}

function MatchRow({
  match, competition, teamsById,
}: {
  match: CompMatch; competition: Competition; teamsById: Map<string, CompTeam>;
}) {
  const isLive = match.status === "live";
  const finished = match.status === "completed";
  const scored = isLive || finished;
  const home = match.scoreHome ?? 0;
  const away = match.scoreAway ?? 0;
  const homeLogo = logoFor(teamsById, match.homeTeamId, match.homeTeamLogo);
  const awayLogo = logoFor(teamsById, match.awayTeamId, match.awayTeamLogo);
  const homeName = sideName(match, "home");
  const awayName = sideName(match, "away");
  const drawn = Boolean(match.homeTeamName && match.awayTeamName);

  return (
    <Link
      href={`/c/${competition.slug}/matches/${match.id}`}
      className="flex items-center gap-3 border-b border-gray-50 px-3 py-2.5 transition-colors last:border-0 hover:bg-gray-50/70 sm:px-4"
    >
      {/* Colonne horaire — l'état du match, pas seulement l'heure */}
      <div className="w-12 shrink-0 text-center sm:w-14">
        {isLive ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-500">
            <span className="h-1 w-1 rounded-full bg-red-500" />
            {liveMinute(match)}&apos;
          </span>
        ) : finished ? (
          <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">
            Terminé
          </p>
        ) : (
          <>
            <p className="text-xs font-black tabular-nums text-gray-900">
              {match.time ?? "—"}
            </p>
            {!match.date && (
              <p className="text-[10px] font-bold text-gray-300">à programmer</p>
            )}
          </>
        )}
      </div>

      {/* Les deux équipes, empilées */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {match.homeTeamName
            ? <TeamBadge name={homeName} logo={homeLogo} size={20} />
            : <EmptyBadge />}
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              drawn ? "font-bold" : "font-semibold italic text-gray-400"
            } ${finished && home < away ? "text-gray-400" : drawn ? "text-gray-900" : ""}`}
          >
            {homeName}
          </span>
          {scored && <ScoreCell value={home} dim={finished && home < away} />}
        </div>
        <div className="flex items-center gap-2">
          {match.awayTeamName
            ? <TeamBadge name={awayName} logo={awayLogo} size={20} />
            : <EmptyBadge />}
          <span
            className={`min-w-0 flex-1 truncate text-sm ${
              drawn ? "font-bold" : "font-semibold italic text-gray-400"
            } ${finished && away < home ? "text-gray-400" : drawn ? "text-gray-900" : ""}`}
          >
            {awayName}
          </span>
          {scored && <ScoreCell value={away} dim={finished && away < home} />}
        </div>
      </div>

      {/* Poule / lieu — l'info qui distingue deux affiches du même jour */}
      <span className="hidden w-24 shrink-0 truncate text-right text-[10px] font-bold text-gray-300 md:block">
        {match.group ? `Poule ${match.group}` : match.venueName ?? ""}
      </span>
    </Link>
  );
}

// ---- Competition section (collapsible, like the model's league blocks) ------------

function CompetitionGroup({
  competition, items, teamsById, collapsed, onToggle,
}: {
  competition: Competition;
  items: Entry[];
  teamsById: Map<string, CompTeam>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const liveCount = items.filter((x) => x.match.status === "live").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center gap-2.5 border-b border-gray-100 bg-gray-50/70 px-3 py-2.5 sm:px-4">
        {/* Le blason mène à la compétition ; le reste de l'en-tête plie la
            section. Deux gestes distincts sur la même barre, comme le modèle. */}
        <Link href={`/c/${competition.slug}`} className="shrink-0">
          {competition.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={competition.logoUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Trophy size={14} />
            </span>
          )}
        </Link>

        <button
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-black text-gray-900">
              {competition.name}
            </span>
            <span className="flex items-center gap-1 truncate text-[11px] font-bold text-gray-400">
              {competition.venueCity ? (
                <>
                  <MapPin size={9} className="shrink-0" />
                  {competition.venueCity}
                </>
              ) : (
                competition.organizerName ?? "Compétition"
              )}
            </span>
          </span>
        </button>

        {liveCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-500">
            <span className="h-1 w-1 rounded-full bg-red-500" />
            {liveCount}
          </span>
        )}
        <span className="shrink-0 text-[11px] font-bold text-gray-400">{items.length}</span>
        <FollowCompetitionButton cid={competition.id} variant="star" />
        <button
          onClick={onToggle}
          aria-label={collapsed ? "Déplier" : "Replier"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200/70"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${collapsed ? "-rotate-90" : ""}`}
          />
        </button>
      </div>

      {!collapsed &&
        items.map(({ match }) => (
          <MatchRow
            key={match.id}
            match={match}
            competition={competition}
            teamsById={teamsById}
          />
        ))}
    </div>
  );
}
// ---- Hero carousel (featured match per competition, auto-advancing) ----------------

function HeroCarousel({
  slides, teamsById,
}: {
  slides: { match: CompMatch; competition: Competition }[];
  teamsById: Map<string, CompTeam>;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = slides.length;
  const safeIndex = count === 0 ? 0 : index % count;

  // Auto-advance. Pauses on hover and while a finger is down, so the banner
  // never slides out from under a tap.
  useEffect(() => {
    if (count < 2 || paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count, paused]);

  if (count === 0) return null;

  const go = (next: number) => setIndex(((next % count) + count) % count);
  const current = slides[safeIndex];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        setPaused(true);
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        setPaused(false);
        const start = touchStartX.current;
        touchStartX.current = null;
        if (start == null) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 50) go(safeIndex + (dx < 0 ? 1 : -1));
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={`${current.competition.id}-${current.match.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <HeroMatchCard
            match={current.match}
            competition={current.competition}
            teamsById={teamsById}
          />
        </motion.div>
      </AnimatePresence>

      {count > 1 && (
        <>
          {/* Arrows are pointer-only; mobile swipes instead. */}
          <button
            aria-label="Affiche précédente"
            onClick={() => go(safeIndex - 1)}
            className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:flex"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            aria-label="Affiche suivante"
            onClick={() => go(safeIndex + 1)}
            className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-colors hover:bg-black/50 sm:flex"
          >
            <ChevronRight size={18} />
          </button>

          <div className="absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={`${s.competition.id}-${s.match.id}`}
                aria-label={`Affiche ${i + 1}`}
                onClick={() => go(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === safeIndex ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- Day helpers ------------------------------------------------------------------

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDay(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** Aujourd&apos;hui / Demain / Hier, sinon une date française courte. */
function dayLabel(date: string): string {
  const today = new Date();
  if (date === dayKey(today)) return "Aujourd'hui";
  if (date === shiftDay(dayKey(today), 1)) return "Demain";
  if (date === shiftDay(dayKey(today), -1)) return "Hier";
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "short", day: "numeric", month: "short",
    });
  } catch {
    return date;
  }
}

/**
 * Libellé long, en minuscules, destiné à être posé dans une phrase.
 *
 * Le libellé court du navigateur ("jeu. 20 août") passé en minuscules donnait
 * « aucun match jeu. 20 août », qui se lit comme le mot « jeu ».
 */
function longDayLabel(date: string): string {
  const today = dayKey(new Date());
  if (date === today) return "aujourd'hui";
  if (date === shiftDay(today, 1)) return "demain";
  if (date === shiftDay(today, -1)) return "hier";
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long", day: "numeric", month: "long",
    });
  } catch {
    return date;
  }
}

const UNDATED = "0000-00-00";

/**
 * Le jour auquel un match appartient sur le tableau.
 *
 * Un match EN COURS compte pour aujourd'hui, quelle que soit la date portée
 * par sa fiche : c'est ce qui se joue maintenant, et une rencontre non
 * programmée qui démarre quand même resterait sinon introuvable derrière le
 * navigateur de date.
 */
function bucketOf(m: CompMatch, today: string): string {
  if (m.status === "live") return today;
  return m.date ?? UNDATED;
}

/** Regroupe par compétition, celles en cours d'abord, puis par ordre alphabétique. */
function groupByCompetition(list: Entry[]): { competition: Competition; items: Entry[] }[] {
  const buckets = new Map<string, { competition: Competition; items: Entry[] }>();
  for (const x of list) {
    const bucket = buckets.get(x.competition.id);
    if (bucket) bucket.items.push(x);
    else buckets.set(x.competition.id, { competition: x.competition, items: [x] });
  }
  return [...buckets.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) =>
        (a.match.time ?? "99:99").localeCompare(b.match.time ?? "99:99"),
      ),
    }))
    .sort((a, b) => {
      const la = a.items.some((x) => x.match.status === "live") ? 0 : 1;
      const lb = b.items.some((x) => x.match.status === "live") ? 0 : 1;
      return la - lb || a.competition.name.localeCompare(b.competition.name);
    });
}

// ---- Date navigator ---------------------------------------------------------------

function DateNav({
  value, onChange, today,
}: {
  value: string;
  onChange: (next: string) => void;
  today: string;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-white">
      <button
        aria-label="Jour précédent"
        onClick={() => onChange(shiftDay(value, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-l-xl text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        onClick={() => onChange(today)}
        title="Revenir à aujourd'hui"
        className="min-w-[104px] border-x border-gray-200 px-2 py-1.5 text-xs font-black text-gray-900"
      >
        {dayLabel(value)}
      </button>
      <button
        aria-label="Jour suivant"
        onClick={() => onChange(shiftDay(value, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-r-xl text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ---- Page -------------------------------------------------------------------------

export default function DirectHome({ initialFeed }: { initialFeed: CompetitionFeed[] }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState<CompetitionFeed[]>(initialFeed);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [scope, setScope] = useState<Scope>("all");
  const [status, setStatus] = useState<StatusFilter>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Calculé une fois par montage : recalculer `new Date()` à chaque rendu
  // ferait sauter le jour sélectionné au passage de minuit, en plein clic.
  const today = useMemo(() => dayKey(new Date()), []);
  const [day, setDay] = useState(today);

  const competitions = useMemo(() => feed.map((f) => f.competition), [feed]);
  // Stable dependency: `competitions` is a fresh array on every feed update,
  // so keying the effects on it would tear down the listeners each time a
  // score changes.
  const competitionIds = useMemo(
    () => competitions.map((c) => c.id).join(","),
    [competitions],
  );

  // One real-time listener per competition: the home is a live-score board,
  // so every fixture on screen has to move on its own.
  useEffect(() => {
    const ids = competitionIds ? competitionIds.split(",") : [];
    if (ids.length === 0) return;
    const unsubs = ids.map((id) =>
      onCompMatches(id, (matches) =>
        setFeed((prev) =>
          prev.map((f) => (f.competition.id === id ? { ...f, matches } : f)),
        ),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [competitionIds]);

  // Team docs carry the current crest; match docs only a snapshot of it.
  useEffect(() => {
    const ids = competitionIds ? competitionIds.split(",") : [];
    if (ids.length === 0) return;
    let cancelled = false;
    Promise.all(ids.map((id) => listCompTeams(id).catch(() => []))).then((lists) => {
      if (!cancelled) setTeams(lists.flat());
    });
    return () => { cancelled = true; };
  }, [competitionIds]);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Every fixture, all competitions, each keeping its competition context.
  const allMatches = useMemo<Entry[]>(
    () => feed.flatMap((f) => f.matches.map((match) => ({ match, competition: f.competition }))),
    [feed],
  );

  // Banner: live first, then soonest upcoming, then most recent results —
  // capped so the carousel stays a highlight reel, not a second fixture list.
  const heroSlides = useMemo(() => {
    const live = allMatches.filter((x) => x.match.status === "live");
    const upcoming = allMatches
      .filter((x) => x.match.status === "scheduled" && x.match.date != null)
      .sort((a, b) =>
        `${a.match.date}T${a.match.time ?? ""}`.localeCompare(`${b.match.date}T${b.match.time ?? ""}`),
      );
    const recent = allMatches
      .filter((x) => x.match.status === "completed")
      .sort((a, b) =>
        `${b.match.date ?? ""}T${b.match.time ?? ""}`.localeCompare(`${a.match.date ?? ""}T${a.match.time ?? ""}`),
      );
    return [...live, ...upcoming, ...recent].slice(0, 5);
  }, [allMatches]);

  const followedIds = useMemo(
    () => new Set(user?.followedCompetitionIds ?? []),
    [user],
  );

  // La portée s'applique avant tout le reste : « Favoris » restreint le
  // tableau aux compétitions suivies, pas les matchs un par un.
  const inScope = useMemo<Entry[]>(() => {
    if (scope !== "favorites") return allMatches;
    return allMatches.filter((x) => followedIds.has(x.competition.id));
  }, [allMatches, scope, followedIds]);

  const ofDay = useMemo(
    () => inScope.filter((x) => bucketOf(x.match, today) === day),
    [inScope, today, day],
  );

  // Les compteurs des pastilles portent sur le jour affiché : une pastille
  // qui annonce 16 matchs et n'en montre aucun serait un mensonge.
  const counts = useMemo(() => ({
    live: ofDay.filter((x) => x.match.status === "live").length,
    finished: ofDay.filter((x) => x.match.status === "completed").length,
    upcoming: ofDay.filter((x) => x.match.status === "scheduled").length,
  }), [ofDay]);

  const filtered = useMemo<Entry[]>(() => {
    if (status === "live") return ofDay.filter((x) => x.match.status === "live");
    if (status === "finished") return ofDay.filter((x) => x.match.status === "completed");
    if (status === "upcoming") return ofDay.filter((x) => x.match.status === "scheduled");
    return ofDay;
  }, [ofDay, status]);

  const groups = useMemo(() => groupByCompetition(filtered), [filtered]);

  // Les matchs sans date ne sont atteignables par aucune flèche : ils sont
  // rappelés sous le jour courant plutôt que d'être perdus.
  const undated = useMemo(
    () => (day === today && status !== "live" && status !== "finished"
      ? groupByCompetition(inScope.filter((x) => bucketOf(x.match, today) === UNDATED))
      : []),
    [inScope, day, today, status],
  );

  // Le prochain jour qui a quelque chose à montrer, pour ne pas laisser
  // l'utilisateur tâtonner de flèche en flèche sur une semaine vide.
  const nextBusyDay = useMemo(() => {
    const days = [...new Set(
      inScope
        .map((x) => bucketOf(x.match, today))
        .filter((d) => d !== UNDATED && d !== day),
    )].sort();
    return days.find((d) => d > day) ?? days.reverse().find((d) => d < day) ?? null;
  }, [inScope, today, day]);

  const toggleGroup = (cid: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });

  const liveTotal = allMatches.filter((x) => x.match.status === "live").length;

  if (feed.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-gray-200 bg-white py-16">
          <Trophy size={32} className="text-gray-300" />
          <h3 className="mt-4 font-display text-lg font-black text-gray-900">
            Aucune compétition en cours
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Les prochaines compétitions apparaîtront ici.
          </p>
        </div>
      </div>
    );
  }

  const statusPills: { key: Exclude<StatusFilter, null>; label: string; count: number }[] = [
    { key: "live", label: "En direct", count: counts.live },
    { key: "finished", label: "Terminés", count: counts.finished },
    { key: "upcoming", label: "À venir", count: counts.upcoming },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <HeroCarousel slides={heroSlides} teamsById={teamsById} />

      {/* ── Barre 1 : portée + navigateur de date ── */}
      <div className="rounded-2xl border border-gray-100 bg-white px-3 pt-2 shadow-sm sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 gap-4 overflow-x-auto sm:gap-5">
            {SCOPES.map((s) => (
              <button
                key={s.key}
                onClick={() => setScope(s.key)}
                className={`relative shrink-0 pb-2.5 text-sm font-bold transition-colors ${
                  scope === s.key ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {s.label}
                {scope === s.key && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-emerald-500" />
                )}
              </button>
            ))}
          </div>
          {scope !== "competitions" && (
            <div className="pb-2">
              <DateNav value={day} onChange={setDay} today={today} />
            </div>
          )}
        </div>

        {/* ── Barre 2 : pastilles de statut ── */}
        {scope !== "competitions" && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 py-2.5">
            <div className="flex gap-2 overflow-x-auto">
              {statusPills.map((p) => {
                const active = status === p.key;
                const isLive = p.key === "live";
                return (
                  <button
                    key={p.key}
                    // Recliquer sur la pastille active enlève le filtre :
                    // sinon on ne peut plus revenir à la liste entière.
                    onClick={() => setStatus(active ? null : p.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-colors ${
                      active
                        ? isLive
                          ? "bg-red-500 text-white"
                          : "bg-gray-900 text-white"
                        : isLive && p.count > 0
                          ? "bg-red-50 text-red-500 hover:bg-red-100"
                          : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {isLive && p.count > 0 && !active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    )}
                    {p.label}
                    {p.count > 0 && ` (${p.count})`}
                  </button>
                );
              })}
            </div>
            <span className="hidden shrink-0 items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-gray-400 sm:flex">
              <Flame size={12} className="text-emerald-500" />
              {liveTotal} en direct
            </span>
          </div>
        )}
      </div>

      {/* ── Onglet Compétitions : le répertoire, pas les matchs ── */}
      {scope === "competitions" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {competitions.map((c) => {
            const played = allMatches.filter((x) => x.competition.id === c.id);
            const live = played.filter((x) => x.match.status === "live").length;
            return (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
              >
                <Link href={`/c/${c.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <Trophy size={18} />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-gray-900">{c.name}</span>
                    <span className="block truncate text-[11px] font-bold text-gray-400">
                      {c.venueCity ?? c.organizerName ?? "Compétition"} · {played.length} match
                      {played.length > 1 ? "s" : ""}
                      {live > 0 ? ` · ${live} en direct` : ""}
                    </span>
                  </span>
                </Link>
                <FollowCompetitionButton cid={c.id} variant="star" />
              </div>
            );
          })}
        </div>
      ) : groups.length === 0 && undated.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-12 text-center shadow-sm">
          {scope === "favorites" && followedIds.size === 0 ? (
            <>
              <Star size={24} className="mx-auto text-gray-300" />
              <p className="mt-2 text-sm font-bold text-gray-500">Aucun favori</p>
              <p className="mt-1 text-sm text-gray-400">
                Touche l&apos;étoile d&apos;une compétition pour la retrouver ici.
              </p>
            </>
          ) : (
            <>
              <CalendarDays size={24} className="mx-auto text-gray-300" />
              <p className="mt-2 text-sm text-gray-400">
                Aucun match {longDayLabel(day)}
                {status ? " dans ce filtre" : ""}.
              </p>
              {nextBusyDay && (
                <button
                  onClick={() => { setDay(nextBusyDay); setStatus(null); }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
                >
                  Aller au {longDayLabel(nextBusyDay)}
                  <ChevronRight size={13} />
                </button>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <CompetitionGroup
              key={g.competition.id}
              competition={g.competition}
              items={g.items}
              teamsById={teamsById}
              collapsed={collapsed.has(g.competition.id)}
              onToggle={() => toggleGroup(g.competition.id)}
            />
          ))}

          {undated.length > 0 && (
            <div className="space-y-3 pt-1">
              <p className="px-1 text-xs font-black uppercase tracking-wide text-gray-400">
                À programmer
              </p>
              {undated.map((g) => (
                <CompetitionGroup
                  key={`undated-${g.competition.id}`}
                  competition={g.competition}
                  items={g.items}
                  teamsById={teamsById}
                  collapsed={collapsed.has(`undated-${g.competition.id}`)}
                  onToggle={() => toggleGroup(`undated-${g.competition.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center pb-2">
        <Link
          href="/competitions"
          className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wide text-emerald-500 hover:text-emerald-600"
        >
          Toutes les compétitions
          <ChevronRight size={13} />
        </Link>
      </div>
    </div>
  );
}
