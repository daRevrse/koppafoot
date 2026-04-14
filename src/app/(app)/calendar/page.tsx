"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import {
  ChevronLeft, ChevronRight, Trophy, MapPin, Clock, Shield,
} from "lucide-react";

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
// Mock data
// ============================================

interface CalendarMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  time: string;
  venue: string;
  type: "match" | "training" | "tournament";
}

// Generate matches for current month
const now = new Date();
const MATCHES_BY_DATE: Record<string, CalendarMatch[]> = {
  [dateKey(now.getFullYear(), now.getMonth(), 8)]: [
    { id: "cm1", homeTeam: "FC Koppa", awayTeam: "AS Roma", time: "15:00", venue: "Stade Municipal", type: "match" },
  ],
  [dateKey(now.getFullYear(), now.getMonth(), 12)]: [
    { id: "cm2", homeTeam: "FC Koppa", awayTeam: "", time: "19:00", venue: "Terrain Nord", type: "training" },
  ],
  [dateKey(now.getFullYear(), now.getMonth(), 15)]: [
    { id: "cm3", homeTeam: "Inter Club", awayTeam: "FC Koppa", time: "20:00", venue: "Terrain Synthétique", type: "match" },
  ],
  [dateKey(now.getFullYear(), now.getMonth(), 20)]: [
    { id: "cm4", homeTeam: "FC Koppa", awayTeam: "Olympique Réunis", time: "15:00", venue: "Complexe Sportif Est", type: "match" },
  ],
  [dateKey(now.getFullYear(), now.getMonth(), 22)]: [
    { id: "cm5", homeTeam: "FC Koppa", awayTeam: "", time: "19:00", venue: "Terrain Nord", type: "training" },
  ],
  [dateKey(now.getFullYear(), now.getMonth(), 27)]: [
    { id: "cm6", homeTeam: "Tournoi Koppa Cup", awayTeam: "", time: "09:00", venue: "Complexe Sportif Est", type: "tournament" },
    { id: "cm7", homeTeam: "FC Koppa", awayTeam: "Red Wolves", time: "14:00", venue: "Complexe Sportif Est", type: "match" },
  ],
};

const TYPE_STYLES: Record<string, { dot: string; bg: string; label: string }> = {
  match: { dot: "bg-primary-500", bg: "bg-primary-50", label: "Match" },
  training: { dot: "bg-blue-500", bg: "bg-blue-50", label: "Entraînement" },
  tournament: { dot: "bg-accent-500", bg: "bg-accent-50", label: "Tournoi" },
};

// ============================================
// Component
// ============================================

export default function CalendarPage() {
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const firstDay = useMemo(() => getFirstDayOfMonth(year, month), [year, month]);

  const today = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const selectedMatches = selectedDate ? (MATCHES_BY_DATE[selectedDate] ?? []) : [];

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
              const hasEvents = !!MATCHES_BY_DATE[key];
              const isToday = key === today;
              const isSelected = key === selectedDate;
              const events = MATCHES_BY_DATE[key] ?? [];

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
                      {events.slice(0, 3).map((e) => (
                        <div
                          key={e.id}
                          className={`h-1 w-1 rounded-full ${
                            isSelected ? "bg-white" : TYPE_STYLES[e.type]?.dot ?? "bg-gray-400"
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 border-t border-gray-100 px-5 py-3">
            {Object.entries(TYPE_STYLES).map(([key, style]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                {style.label}
              </div>
            ))}
          </div>
        </motion.div>

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
            {selectedMatches.length > 0 ? (
              <div className="space-y-3">
                {selectedMatches.map((match) => {
                  const style = TYPE_STYLES[match.type];
                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`rounded-lg ${style.bg} p-3`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${style.dot}`} />
                        <span className="text-xs font-semibold text-gray-500 uppercase">{style.label}</span>
                      </div>
                      <div className="mt-2">
                        {match.type === "match" ? (
                          <div className="flex items-center gap-2">
                            <Shield size={14} className="text-gray-500" />
                            <span className="text-sm font-bold text-gray-900">
                              {match.homeTeam} vs {match.awayTeam}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-gray-900">{match.homeTeam}</p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Clock size={12} /> {match.time}</span>
                        <span className="flex items-center gap-1"><MapPin size={12} /> {match.venue}</span>
                      </div>
                    </motion.div>
                  );
                })}
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
