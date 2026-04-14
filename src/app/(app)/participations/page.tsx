"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Trophy, Calendar, MapPin, Clock, Users, CheckCircle,
  XCircle, Timer, ChevronRight, Shield,
} from "lucide-react";

// ============================================
// Mock data
// ============================================

type MatchStatus = "upcoming" | "played" | "cancelled";
type MatchResult = "win" | "loss" | "draw" | null;

interface Participation {
  id: string;
  homeTeam: string;
  awayTeam: string;
  myTeam: string;
  date: string;
  time: string;
  venue: string;
  venueCity: string;
  status: MatchStatus;
  result: MatchResult;
  scoreHome: number | null;
  scoreAway: number | null;
  playerStats?: { goals: number; assists: number };
}

const PARTICIPATIONS: Participation[] = [
  {
    id: "m1",
    homeTeam: "FC Koppa",
    awayTeam: "AS Tonnerre",
    myTeam: "FC Koppa",
    date: "Dim. 20 Avr.",
    time: "15:00",
    venue: "Stade Municipal",
    venueCity: "Paris",
    status: "upcoming",
    result: null,
    scoreHome: null,
    scoreAway: null,
  },
  {
    id: "m2",
    homeTeam: "Inter Club",
    awayTeam: "FC Koppa",
    myTeam: "FC Koppa",
    date: "Mer. 23 Avr.",
    time: "19:30",
    venue: "Terrain Synthétique Nord",
    venueCity: "Paris",
    status: "upcoming",
    result: null,
    scoreHome: null,
    scoreAway: null,
  },
  {
    id: "m3",
    homeTeam: "FC Koppa",
    awayTeam: "Olympique Réunis",
    myTeam: "FC Koppa",
    date: "Sam. 12 Avr.",
    time: "14:00",
    venue: "Complexe Sportif Est",
    venueCity: "Paris",
    status: "played",
    result: "win",
    scoreHome: 3,
    scoreAway: 1,
    playerStats: { goals: 1, assists: 1 },
  },
  {
    id: "m4",
    homeTeam: "Red Wolves FC",
    awayTeam: "FC Koppa",
    myTeam: "FC Koppa",
    date: "Sam. 5 Avr.",
    time: "16:00",
    venue: "Terrain Municipal Sud",
    venueCity: "Toulouse",
    status: "played",
    result: "loss",
    scoreHome: 2,
    scoreAway: 1,
    playerStats: { goals: 1, assists: 0 },
  },
  {
    id: "m5",
    homeTeam: "FC Koppa",
    awayTeam: "FC Étoile",
    myTeam: "FC Koppa",
    date: "Dim. 30 Mar.",
    time: "15:00",
    venue: "Stade Municipal",
    venueCity: "Paris",
    status: "played",
    result: "draw",
    scoreHome: 2,
    scoreAway: 2,
    playerStats: { goals: 0, assists: 2 },
  },
  {
    id: "m6",
    homeTeam: "Les Invincibles",
    awayTeam: "Inter Quartier",
    myTeam: "Les Invincibles",
    date: "Mar. 25 Mar.",
    time: "20:00",
    venue: "Terrain Indoor Central",
    venueCity: "Paris",
    status: "cancelled",
    result: null,
    scoreHome: null,
    scoreAway: null,
  },
];

const RESULT_CONFIG = {
  win: { label: "Victoire", color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
  loss: { label: "Défaite", color: "text-red-500", bg: "bg-red-50", icon: XCircle },
  draw: { label: "Nul", color: "text-amber-600", bg: "bg-amber-50", icon: Timer },
};

// ============================================
// Component
// ============================================

type Tab = "upcoming" | "past";

export default function ParticipationsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");

  const upcoming = PARTICIPATIONS.filter((p) => p.status === "upcoming");
  const past = PARTICIPATIONS.filter((p) => p.status !== "upcoming");
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">Participations</h1>
        <p className="mt-1 text-sm text-gray-500">Tes matchs à venir et passés</p>
      </motion.div>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08 }}
        className="flex border-b border-gray-200"
      >
        <button
          onClick={() => setTab("upcoming")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            tab === "upcoming"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Calendar size={16} /> À venir
          {upcoming.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-100 px-1.5 text-xs font-bold text-primary-700">
              {upcoming.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("past")}
          className={`flex items-center gap-2 border-b-2 pb-3 pr-6 text-sm font-medium transition-colors ${
            tab === "past"
              ? "border-primary-600 text-primary-600"
              : "border-transparent text-gray-400 hover:text-gray-600"
          }`}
        >
          <Trophy size={16} /> Historique
          <span className="text-xs text-gray-400">({past.length})</span>
        </button>
      </motion.div>

      {/* Match cards */}
      <div className="space-y-3">
        {displayed.map((match, i) => {
          const isHome = match.homeTeam === match.myTeam;
          const resultConf = match.result ? RESULT_CONFIG[match.result] : null;
          const ResultIcon = resultConf?.icon;

          return (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              whileHover={{ x: 3 }}
              className={`group overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-md ${
                match.status === "cancelled" ? "border-gray-200 opacity-60" : "border-gray-200"
              }`}
            >
              <div className="flex flex-col sm:flex-row">
                {/* Result strip */}
                {resultConf && (
                  <div className={`flex items-center justify-center sm:w-24 py-2 sm:py-0 ${resultConf.bg}`}>
                    <div className="flex sm:flex-col items-center gap-1.5 sm:gap-0.5">
                      {ResultIcon && <ResultIcon size={18} className={resultConf.color} />}
                      <span className={`text-xs font-bold ${resultConf.color}`}>{resultConf.label}</span>
                    </div>
                  </div>
                )}

                {match.status === "cancelled" && (
                  <div className="flex items-center justify-center bg-gray-100 sm:w-24 py-2 sm:py-0">
                    <span className="text-xs font-bold text-gray-400">Annulé</span>
                  </div>
                )}

                {match.status === "upcoming" && (
                  <div className="flex items-center justify-center bg-primary-50 sm:w-24 py-2 sm:py-0">
                    <div className="flex sm:flex-col items-center gap-1.5 sm:gap-0">
                      <span className="text-lg font-bold text-primary-600 font-display">{match.time}</span>
                      <span className="text-xs text-primary-500">{match.date.split(" ")[0]}</span>
                    </div>
                  </div>
                )}

                {/* Main content */}
                <div className="flex-1 p-4 sm:p-5">
                  {/* Teams */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Shield size={16} className={isHome ? "text-primary-500" : "text-gray-400"} />
                      <span className={`text-sm truncate ${isHome ? "font-bold text-gray-900" : "text-gray-600"}`}>
                        {match.homeTeam}
                      </span>
                    </div>

                    {match.scoreHome !== null && match.scoreAway !== null ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-lg font-bold text-gray-900 font-display">{match.scoreHome}</span>
                        <span className="text-xs text-gray-400">-</span>
                        <span className="text-lg font-bold text-gray-900 font-display">{match.scoreAway}</span>
                      </div>
                    ) : (
                      <span className="shrink-0 text-xs font-medium text-gray-400">VS</span>
                    )}

                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className={`text-sm truncate ${!isHome ? "font-bold text-gray-900" : "text-gray-600"}`}>
                        {match.awayTeam}
                      </span>
                      <Shield size={16} className={!isHome ? "text-primary-500" : "text-gray-400"} />
                    </div>
                  </div>

                  {/* Meta + Stats */}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {match.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {match.venue}
                      </span>
                    </div>

                    {match.playerStats && (
                      <div className="flex items-center gap-3 text-xs">
                        {match.playerStats.goals > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-accent-600">
                            {match.playerStats.goals} but{match.playerStats.goals > 1 ? "s" : ""}
                          </span>
                        )}
                        {match.playerStats.assists > 0 && (
                          <span className="flex items-center gap-1 text-gray-500">
                            {match.playerStats.assists} passe{match.playerStats.assists > 1 ? "s" : ""} D
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <div className="hidden sm:flex items-center pr-4">
                  <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors" />
                </div>
              </div>
            </motion.div>
          );
        })}

        {displayed.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              {tab === "upcoming" ? (
                <Calendar size={32} className="text-gray-300" />
              ) : (
                <Trophy size={32} className="text-gray-300" />
              )}
            </div>
            <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">
              {tab === "upcoming" ? "Aucun match à venir" : "Aucun match joué"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {tab === "upcoming"
                ? "Rejoins une équipe pour participer à des matchs"
                : "Tes matchs terminés apparaîtront ici"}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
