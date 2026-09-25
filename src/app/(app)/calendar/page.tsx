"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ChevronLeft, ChevronRight, CalendarDays, MapPin, Loader2, Flag,
  Dumbbell, ArrowUpRight, Navigation, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMatchesByTeamIds, getTeamsIManage, getTeamsByPlayer, getMatchesByReferee,
} from "@/lib/firestore";
import type { Match, Team } from "@/types";
import TirsAuBut from "@/components/match/TirsAuBut";
import MiniEcusson from "@/components/match/MiniEcusson";
import { libelleDuJour } from "@/lib/dates";

// ============================================
// Training types & helpers
// ============================================

type TrainingEvent = {
  date: string;
  teamName: string;
  teamId: string;
  time: string;
  location: string;
  label?: string;
};

function generateTrainingEvents(teams: Team[], year: number, month: number): TrainingEvent[] {
  const events: TrainingEvent[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (const team of teams) {
    for (const slot of team.trainingSchedule ?? []) {
      for (let day = 1; day <= daysInMonth; day++) {
        if (new Date(year, month, day).getDay() === slot.day) {
          events.push({
            date: `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            teamName: team.name,
            teamId: team.id,
            time: slot.time,
            location: slot.location,
            label: slot.label,
          });
        }
      }
    }
  }
  return events;
}

// ============================================
// Calendar helpers
// ============================================

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Un lien d'itinéraire : le lieu tel qu'il est écrit, laissé à la carte. */
function itineraire(lieu: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lieu)}`;
}

// ============================================
// Status styles
//
// Une couleur par nature d'évènement, reprise à l'identique dans la case
// du jour, la puce et la légende : la légende n'a de sens que si c'est
// la même couleur partout.
// ============================================

type Style = { chip: string; dot: string; label: string };

const STATUS_STYLES: Record<string, Style> = {
  upcoming: { chip: "border-primary-500 bg-primary-50 text-primary-800", dot: "bg-primary-500", label: "Match" },
  live: { chip: "border-red-500 bg-red-50 text-red-700", dot: "bg-red-500", label: "En direct" },
  completed: { chip: "border-gray-400 bg-gray-50 text-gray-600", dot: "bg-gray-400", label: "Terminé" },
  cancelled: { chip: "border-red-300 bg-white text-red-400 line-through", dot: "bg-red-300", label: "Annulé" },
};
const DEFAULT_STYLE = STATUS_STYLES.upcoming;
const TRAINING_STYLE: Style = {
  chip: "border-violet-400 bg-violet-50 text-violet-700", dot: "bg-violet-400", label: "Entraînement",
};

const styleDe = (m: Match) => STATUS_STYLES[m.status] ?? DEFAULT_STYLE;

// ============================================
// Evénements
// ============================================

type Evenement =
  | { kind: "match"; date: string; time: string; match: Match }
  | { kind: "training"; date: string; time: string; training: TrainingEvent };

const parHeure = (a: Evenement, b: Evenement) =>
  a.date.localeCompare(b.date) || (a.time || "99").localeCompare(b.time || "99");

/** Un lien sous un évènement : même forme pour tous, on les lit en ligne. */
function Lien({ href, externe, children }: { href: string; externe?: boolean; children: React.ReactNode }) {
  const cls =
    "inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.1em] text-gray-500 transition-colors hover:text-gray-900";
  return externe ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}

function CarteEvenement({ ev, uid, avecDate }: { ev: Evenement; uid: string; avecDate: boolean }) {
  if (ev.kind === "training") {
    const t = ev.training;
    return (
      <div className={`border-l-4 ${TRAINING_STYLE.chip} p-3`}>
        <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
          <span className="flex items-center gap-1.5"><Dumbbell size={12} /> Entraînement</span>
          <span className="text-violet-500">
            {avecDate && `${libelleDuJour(ev.date)} · `}{t.time}
          </span>
        </div>
        <p className="mt-2 text-sm font-bold text-violet-950">
          {t.teamName}
          {t.label && <span className="ml-1.5 font-medium text-violet-500">· {t.label}</span>}
        </p>
        {t.location && (
          <p className="mt-1 flex items-center gap-1 text-xs text-violet-700">
            <MapPin size={12} className="shrink-0" /> {t.location}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-violet-200/60 pt-2">
          <Lien href={`/teams/${t.teamId}`}><Users size={12} /> L&apos;équipe</Lien>
          {t.location && <Lien href={itineraire(t.location)} externe><Navigation size={12} /> Itinéraire</Lien>}
        </div>
      </div>
    );
  }

  const m = ev.match;
  const st = styleDe(m);
  const lieu = [m.venueName, m.venueCity].filter(Boolean).join(", ");
  const aUnScore = m.scoreHome != null && m.scoreAway != null && m.status !== "upcoming";
  return (
    <div className={`border-l-4 ${st.chip.replace("line-through", "")} p-3`}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
        <span className="flex items-center gap-1.5">
          {st.label}{m.format && ` · ${m.format}`}
          {/* Dire pourquoi ce match est là : sans ça, un arbitre voit
              apparaître deux équipes dont aucune n'est la sienne. */}
          {m.refereeId === uid && (
            <span className="flex items-center gap-1 bg-white/70 px-1.5 py-0.5 text-gray-500">
              <Flag size={10} /> Arbitrage
            </span>
          )}
        </span>
        <span className="shrink-0 opacity-80">
          {avecDate && `${libelleDuJour(ev.date)} · `}{m.time}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MiniEcusson nom={m.homeTeamName} logo={m.homeTeamLogo ?? null} taille={24} className="text-gray-400" />
          <span className="truncate text-sm font-bold text-gray-900">{m.homeTeamName}</span>
        </div>
        <span className="font-display text-sm font-black tabular-nums text-gray-900">
          {aUnScore ? <>{m.scoreHome} – {m.scoreAway}</> : <span className="text-xs font-medium text-gray-400">vs</span>}
          {aUnScore && <TirsAuBut home={m.penaltyHome} away={m.penaltyAway} className="ml-1" />}
        </span>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="truncate text-right text-sm font-bold text-gray-900">{m.awayTeamName}</span>
          <MiniEcusson nom={m.awayTeamName} logo={m.awayTeamLogo ?? null} taille={24} className="text-gray-400" />
        </div>
      </div>

      {lieu && (
        <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <MapPin size={12} className="shrink-0" /> <span className="truncate">{lieu}</span>
        </p>
      )}

      {/* LES LIENS SOUS L'ÉVÈNEMENT, pas dans la case : la carte dit ce qui
          se passe, la ligne du dessous dit ce qu'on peut en faire. */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/5 pt-2">
        <Lien href={`/matches/${m.id}`}><ArrowUpRight size={12} /> Fiche du match</Lien>
        {lieu && m.status !== "completed" && m.status !== "cancelled" && (
          <Lien href={itineraire(lieu)} externe><Navigation size={12} /> Itinéraire</Lien>
        )}
      </div>
    </div>
  );
}

// ============================================
// Loading skeleton
// ============================================

function CalendarSkeleton() {
  return (
    <div className="lg:col-span-2 border border-gray-200/70 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200/70 px-5 py-4">
        <div className="h-8 w-8 animate-pulse bg-gray-200" />
        <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-8 animate-pulse bg-gray-200" />
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 p-px">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square sm:aspect-auto sm:h-24 animate-pulse bg-gray-50" />
        ))}
      </div>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function CalendarPage() {
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const firstDay = useMemo(() => getFirstDayOfMonth(year, month), [year, month]);
  const today = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const mesEquipes = useMemo(() => new Set(teams.map((t) => t.id)), [teams]);

  /** Matchs et entraînements du mois, rangés par jour et par heure. */
  const eventsByDate = useMemo(() => {
    const map: Record<string, Evenement[]> = {};
    const push = (ev: Evenement) => (map[ev.date] ??= []).push(ev);
    for (const match of matches) {
      if (match.date) push({ kind: "match", date: match.date, time: match.time, match });
    }
    for (const t of generateTrainingEvents(teams, year, month)) {
      push({ kind: "training", date: t.date, time: t.time, training: t });
    }
    for (const k in map) map[k].sort(parHeure);
    return map;
  }, [matches, teams, year, month]);

  /**
   * SANS JOUR CHOISI, LE PANNEAU N'EST PLUS VIDE. Il disait « Clique sur un
   * jour », c'est-à-dire qu'il fallait chercher dans la grille ce que le
   * panneau aurait pu dire tout de suite : ce qui arrive. Les prochains
   * évènements du mois affiché, à partir d'aujourd'hui.
   */
  const aVenir = useMemo(() => {
    const debutDuMois = dateKey(year, month, 1);
    const depuis = today > debutDuMois ? today : debutDuMois;
    return Object.values(eventsByDate)
      .flat()
      .filter((ev) => ev.date >= depuis)
      .sort(parHeure)
      .slice(0, 8);
  }, [eventsByDate, today, year, month]);

  const panneau = selectedDate ? (eventsByDate[selectedDate] ?? []) : aVenir;

  // Fetch matches for user's teams
  //
  // L'ARBITRE N'A PAS D'ÉQUIPE, et ce calendrier ne lisait que les équipes.
  // Son espace lui proposait pourtant « Mon calendrier » : il ouvrait une
  // grille vide, tous les mois, y compris les jours où il arbitrait. Ses
  // matchs se lisent sur `referee_id`, ils s'ajoutent donc ici, sans se
  // substituer aux autres — un arbitre peut aussi jouer.
  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isManager = user.userType === "manager";
      const isReferee = user.evolutionRole === "referee" || user.userType === "referee";
      const userTeams = isManager
        ? await getTeamsIManage(user.uid)
        : await getTeamsByPlayer(user.uid);
      const teamIds = [...new Set(userTeams.map((t) => t.id))];
      setTeams(userTeams);

      const [teamMatches, refereeMatches] = await Promise.all([
        teamIds.length > 0 ? getMatchesByTeamIds(teamIds) : Promise.resolve([]),
        isReferee ? getMatchesByReferee(user.uid) : Promise.resolve([]),
      ]);

      // Dédoublonnage par id : le même match peut arriver des deux côtés,
      // celui qui arbitre l'équipe d'à côté n'a pas à le voir deux fois.
      const parId = new Map<string, Match>();
      for (const m of [...teamMatches, ...refereeMatches]) parId.set(m.id, m);
      setMatches([...parId.values()]);
    } catch (err) {
      console.error("Error fetching matches:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
    setSelectedDate(null);
  };

  const goToday = () => {
    setMonth(now.getMonth());
    setYear(now.getFullYear());
    setSelectedDate(today);
  };

  if (!user) return null;

  /** Ce qu'une puce de la grille dit d'un évènement, en quelques lettres. */
  const libellePuce = (ev: Evenement): string => {
    if (ev.kind === "training") return ev.training.label || "Entraînement";
    const m = ev.match;
    // Le nom d'en face : le mien, je le connais.
    if (mesEquipes.has(m.homeTeamId)) return `vs ${m.awayTeamName}`;
    if (mesEquipes.has(m.awayTeamId)) return `@ ${m.homeTeamName}`;
    return `${m.homeTeamName} – ${m.awayTeamName}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">Calendrier</h1>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calendar */}
        {loading ? (
          <CalendarSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="lg:col-span-2 border border-gray-200/70 bg-white overflow-hidden"
          >
            {/* Month nav */}
            <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 px-3 py-3 sm:px-5">
              <button
                onClick={prevMonth}
                aria-label="Mois précédent"
                className="flex h-8 w-8 items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-gray-900 font-display">
                  {MONTHS[month]} {year}
                </h2>
                <button
                  onClick={goToday}
                  className="border border-gray-200/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-gray-500 transition-colors hover:border-gray-900 hover:text-gray-900"
                >
                  Aujourd&apos;hui
                </button>
              </div>
              <button
                onClick={nextMonth}
                aria-label="Mois suivant"
                className="flex h-8 w-8 items-center justify-center hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-100 py-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-black uppercase tracking-[0.1em] text-gray-400">{d}</div>
              ))}
            </div>

            {/* Day cells.
                Sur téléphone, un point par évènement : sept colonnes n'y
                laissent pas la place d'un mot. Dès sm, la case s'agrandit
                et chaque évènement s'y lit en clair, heure et adversaire. */}
            <div className="grid grid-cols-7 gap-px bg-gray-100 p-px">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square bg-gray-50/60 sm:aspect-auto sm:min-h-24" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = dateKey(year, month, day);
                const events = eventsByDate[key] ?? [];
                const isToday = key === today;
                const isSelected = key === selectedDate;
                const isPast = key < today;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    aria-label={`${day} ${MONTHS[month]}, ${events.length} évènement${events.length > 1 ? "s" : ""}`}
                    aria-pressed={isSelected}
                    className={`relative flex aspect-square flex-col items-center justify-center gap-1 p-1 text-left transition-colors sm:aspect-auto sm:min-h-24 sm:items-stretch sm:justify-start ${
                      isSelected
                        ? "bg-gray-900 text-white"
                        : isToday
                          ? "bg-primary-50"
                          : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span
                      className={`text-xs sm:text-[13px] font-bold tabular-nums ${
                        isSelected ? "text-white"
                        : isToday ? "text-primary-700"
                        : isPast ? "text-gray-300"
                        : "text-gray-700"
                      }`}
                    >
                      {isToday && !isSelected ? (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center bg-primary-600 px-1 text-white">{day}</span>
                      ) : day}
                    </span>

                    {/* Téléphone : des points */}
                    {events.length > 0 && (
                      <span className="flex gap-0.5 sm:hidden">
                        {events.slice(0, 3).map((ev, k) => (
                          <span
                            key={k}
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected ? "bg-white" : ev.kind === "training" ? TRAINING_STYLE.dot : styleDe(ev.match).dot
                            }`}
                          />
                        ))}
                      </span>
                    )}

                    {/* Écran large : des puces lisibles */}
                    <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                      {events.slice(0, 2).map((ev, k) => {
                        const st = ev.kind === "training" ? TRAINING_STYLE : styleDe(ev.match);
                        return (
                          <span
                            key={k}
                            className={`block truncate border-l-2 px-1 py-0.5 text-[10px] font-semibold leading-tight ${
                              isSelected ? "border-white bg-white/10 text-white" : st.chip
                            }`}
                          >
                            {ev.time && <span className="font-black tabular-nums">{ev.time} </span>}
                            {libellePuce(ev)}
                          </span>
                        );
                      })}
                      {events.length > 2 && (
                        <span className={`text-[10px] font-bold ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                          +{events.length - 2} autre{events.length - 2 > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200/70 px-5 py-3">
              {[...Object.values(STATUS_STYLES), TRAINING_STYLE].map((style) => (
                <div key={style.label} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                  {style.label}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Side panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="border border-gray-200/70 bg-white self-start"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 px-5 py-4">
            <h3 className="text-sm font-bold text-gray-900 font-display first-letter:uppercase">
              {selectedDate ? libelleDuJour(selectedDate) : "À venir"}
            </h3>
            {selectedDate && (
              <button
                onClick={() => setSelectedDate(null)}
                className="text-[10px] font-black uppercase tracking-[0.1em] text-gray-400 transition-colors hover:text-gray-900"
              >
                Voir la suite
              </button>
            )}
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">Chargement...</p>
              </div>
            ) : panneau.length > 0 ? (
              <div className="space-y-3">
                {panneau.map((ev) => (
                  <motion.div
                    key={ev.kind === "match" ? ev.match.id : `t-${ev.training.teamId}-${ev.date}-${ev.time}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <CarteEvenement ev={ev} uid={user.uid} avecDate={!selectedDate} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <CalendarDays size={24} className="text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">
                  {selectedDate ? "Rien de prévu ce jour" : "Rien de prévu d'ici la fin du mois"}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
