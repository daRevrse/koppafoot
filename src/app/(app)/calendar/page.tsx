"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft, ChevronRight, Trophy, MapPin, Clock, Shield, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getMatchesByTeamIds, getTeamsByManager, getTeamsByPlayer } from "@/lib/firestore";
import type { Match, Team } from "@/types";

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

// ============================================
// Status styles
// ============================================

const STATUS_STYLES: Record<string, { dot: string; bg: string; label: string }> = {
  upcoming: { dot: "bg-primary-500", bg: "bg-primary-50", label: "Match" },
  completed: { dot: "bg-gray-400", bg: "bg-gray-50", label: "Terminé" },
  cancelled: { dot: "bg-red-400", bg: "bg-red-50", label: "Annulé" },
};

const DEFAULT_STYLE = { dot: "bg-primary-500", bg: "bg-primary-50", label: "Match" };

// ============================================
// Loading skeleton
// ============================================

function CalendarSkeleton() {
  return (
    <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
        <div className="h-5 w-36 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-8 animate-pulse rounded-lg bg-gray-200" />
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-50 p-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-lg bg-gray-100" />
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

  // Group matches by date
  const matchesByDate = useMemo(() => {
    const map: Record<string, Match[]> = {};
    for (const match of matches) {
      if (!match.date) continue;
      if (!map[match.date]) map[match.date] = [];
      map[match.date].push(match);
    }
    return map;
  }, [matches]);

  const selectedMatches = selectedDate ? (matchesByDate[selectedDate] ?? []) : [];

  const trainingEventsByDate = useMemo(() => {
    const map: Record<string, TrainingEvent[]> = {};
    for (const ev of generateTrainingEvents(teams, year, month)) {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [teams, year, month]);

  const selectedTrainings = selectedDate ? (trainingEventsByDate[selectedDate] ?? []) : [];

  // Fetch matches for user's teams
  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const isManager = user.userType === "manager";
      const userTeams = isManager
        ? await getTeamsByManager(user.uid)
        : await getTeamsByPlayer(user.uid);
      const teamIds = [...new Set(userTeams.map((t) => t.id))];
      setTeams(userTeams);
      if (teamIds.length > 0) {
        const result = await getMatchesByTeamIds(teamIds);
        setMatches(result);
      } else {
        setMatches([]);
      }
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

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">Calendrier</h1>
        <p className="mt-1 text-sm text-gray-500">Tes matchs et événements à venir</p>
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
            className="lg:col-span-2 rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            {/* Month nav */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <button
                onClick={prevMonth}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h2 className="text-sm font-bold text-gray-900 font-display">
                {MONTHS[month]} {year}
              </h2>
              <button
                onClick={nextMonth}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-50 px-2 py-2">
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 uppercase">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px bg-gray-50 p-2">
              {/* Empty days before first */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Actual days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const key = dateKey(year, month, day);
                const hasEvents = !!matchesByDate[key];
                const hasTraining = !!trainingEventsByDate[key];
                const isToday = key === today;
                const isSelected = key === selectedDate;
                const events = matchesByDate[key] ?? [];

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(isSelected ? null : key)}
                    className={`relative flex flex-col items-center justify-center rounded-lg aspect-square text-sm transition-all ${
                      isSelected
                        ? "bg-primary-600 text-white font-bold ring-2 ring-primary-300"
                        : isToday
                          ? "bg-primary-50 text-primary-700 font-bold"
                          : hasEvents
                            ? "bg-white hover:bg-gray-100 font-medium text-gray-900"
                            : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {day}
                    {hasEvents && (
                      <div className="mt-0.5 flex gap-0.5">
                        {events.slice(0, 3).map((e) => {
                          const style = STATUS_STYLES[e.status] ?? DEFAULT_STYLE;
                          return (
                            <div
                              key={e.id}
                              className={`h-1 w-1 rounded-full ${
                                isSelected ? "bg-white" : style.dot
                              }`}
                            />
                          );
                        })}
                      </div>
                    )}
                    {hasTraining && (
                      <div className="mt-0.5 flex gap-0.5">
                        <div className={`h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-violet-400"}`} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 border-t border-gray-100 px-5 py-3">
              {Object.entries(STATUS_STYLES).map(([key, style]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                  <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                  {style.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className="h-2 w-2 rounded-full bg-violet-400" />
                Entraînement
              </div>
            </div>
          </motion.div>
        )}

        {/* Side panel — selected day details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.16 }}
          className="rounded-xl border border-gray-200 bg-white"
        >
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-bold text-gray-900 font-display">
              {selectedDate
                ? `${parseInt(selectedDate.split("-")[2])} ${MONTHS[parseInt(selectedDate.split("-")[1]) - 1]}`
                : "Sélectionne un jour"}
            </h3>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">Chargement...</p>
              </div>
            ) : selectedMatches.length > 0 || selectedTrainings.length > 0 ? (
              <div className="space-y-3">
                {/* Matches */}
                {selectedMatches.map((match) => {
                  const style = STATUS_STYLES[match.status] ?? DEFAULT_STYLE;
                  return (
                    <motion.div key={match.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                      className={`rounded-lg ${style.bg} p-3`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                        <span className="text-xs font-semibold text-gray-500 uppercase">
                          {style.label} {match.format && `· ${match.format}`}
                        </span>
                      </div>
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <Shield size={14} className="text-gray-500" />
                          <span className="text-sm font-bold text-gray-900">
                            {match.homeTeamName} vs {match.awayTeamName}
                          </span>
                        </div>
                        {match.status === "completed" && match.scoreHome != null && match.scoreAway != null && (
                          <div className="mt-1 flex items-center gap-2 ml-6">
                            <span className="text-sm font-bold text-gray-700 font-display">
                              {match.scoreHome} - {match.scoreAway}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        {match.time && <span className="flex items-center gap-1"><Clock size={12} /> {match.time}</span>}
                        {match.venueName && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {match.venueName}{match.venueCity ? `, ${match.venueCity}` : ""}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                {/* Training events */}
                {selectedTrainings.map((ev, i) => (
                  <motion.div key={`training-${i}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    className="rounded-lg bg-violet-50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-violet-400" />
                      <span className="text-xs font-semibold text-violet-600 uppercase">🏋️ Entraînement</span>
                    </div>
                    <div className="mt-2">
                      <span className="text-sm font-bold text-violet-900">{ev.teamName}</span>
                      {ev.label && <span className="ml-2 text-xs text-violet-500">· {ev.label}</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-violet-600">
                      {ev.time && <span className="flex items-center gap-1"><Clock size={12} /> {ev.time}</span>}
                      <span className="flex items-center gap-1"><MapPin size={12} /> {ev.location}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center py-8 text-center">
                <Trophy size={24} className="text-gray-300" />
                <p className="mt-2 text-sm text-gray-400">
                  {selectedDate ? "Rien de prévu ce jour" : "Clique sur un jour pour voir les détails"}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
