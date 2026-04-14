"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Users, Search, Plus, ChevronRight, Shield, MapPin,
  Calendar, Crown, Star, UserMinus,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Mock data
// ============================================

interface Team {
  id: string;
  name: string;
  city: string;
  memberCount: number;
  maxMembers: number;
  role: "captain" | "member";
  level: string;
  nextMatch: string | null;
  wins: number;
  losses: number;
  color: string;
}

const MY_TEAMS: Team[] = [
  {
    id: "1",
    name: "FC Koppa",
    city: "Paris",
    memberCount: 11,
    maxMembers: 16,
    role: "captain",
    level: "Intermédiaire",
    nextMatch: "Dim. 20 Avr. — 15:00",
    wins: 8,
    losses: 3,
    color: "emerald",
  },
  {
    id: "2",
    name: "Les Invincibles",
    city: "Paris",
    memberCount: 9,
    maxMembers: 14,
    role: "member",
    level: "Amateur",
    nextMatch: "Mer. 23 Avr. — 19:30",
    wins: 5,
    losses: 5,
    color: "blue",
  },
];

// ============================================
// Component
// ============================================

export default function TeamsPage() {
  const { user } = useAuth();
  const [teams] = useState<Team[]>(MY_TEAMS);

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 font-display">Mes équipes</h1>
          <p className="mt-1 text-sm text-gray-500">
            {teams.length} équipe{teams.length > 1 ? "s" : ""} rejointe{teams.length > 1 ? "s" : ""}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Link
            href="/teams/search"
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all hover:shadow-[0_0_12px_rgba(5,150,105,0.3)]"
          >
            <Search size={16} /> Trouver une équipe
          </Link>
        </motion.div>
      </div>

      {/* Teams grid */}
      {teams.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team, i) => (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              whileHover={{ y: -2 }}
              className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-md"
            >
              {/* Color stripe top */}
              <div className={`h-1 ${team.color === "emerald" ? "bg-emerald-500" : "bg-blue-500"}`} />

              <div className="p-5">
                {/* Team header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                      team.color === "emerald" ? "bg-emerald-100" : "bg-blue-100"
                    }`}>
                      <Shield size={24} className={
                        team.color === "emerald" ? "text-emerald-600" : "text-blue-600"
                      } />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 font-display">{team.name}</h3>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                        <MapPin size={12} /> {team.city}
                      </div>
                    </div>
                  </div>
                  {team.role === "captain" && (
                    <span className="flex items-center gap-1 rounded-full bg-accent-100 px-2.5 py-1 text-xs font-semibold text-accent-700">
                      <Crown size={12} /> Capitaine
                    </span>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900 font-display">{team.memberCount}</p>
                    <p className="text-xs text-gray-500">Joueurs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-emerald-600 font-display">{team.wins}</p>
                    <p className="text-xs text-gray-500">Victoires</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-500 font-display">{team.losses}</p>
                    <p className="text-xs text-gray-500">Défaites</p>
                  </div>
                </div>

                {/* Meta */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Star size={12} /> {team.level}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={12} /> {team.memberCount}/{team.maxMembers}
                    </span>
                  </div>
                  {team.nextMatch && (
                    <span className="flex items-center gap-1 text-xs font-medium text-primary-600">
                      <Calendar size={12} /> {team.nextMatch}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/teams/${team.id}`}
                    className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Voir l&apos;équipe <ChevronRight size={14} />
                  </Link>
                  {team.role !== "captain" && (
                    <button className="flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                      <UserMinus size={14} /> Quitter
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50">
            <Users size={32} className="text-primary-400" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucune équipe</h3>
          <p className="mt-1 text-sm text-gray-500">Rejoins une équipe pour commencer à jouer</p>
          <Link
            href="/teams/search"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-all"
          >
            <Plus size={16} /> Trouver une équipe
          </Link>
        </motion.div>
      )}
    </div>
  );
}
