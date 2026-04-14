"use client";

import { motion } from "motion/react";
import {
  Trophy, Users, Target, UserPlus, Calendar, Shield, Award,
  FileText, Star, Clock, MapPin, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import StatCard from "@/components/ui/StatCard";
import XPProgressBar from "@/components/ui/XPProgressBar";
import LevelBadge from "@/components/ui/LevelBadge";

// ============================================
// Role-specific stats config
// ============================================

const ROLE_STATS = {
  player: [
    { icon: Trophy, value: 12, label: "Matchs joués", trend: "up" as const, trendValue: "+3", color: "bg-primary-50" },
    { icon: Target, value: 5, label: "Buts marqués", trend: "up" as const, trendValue: "+2", color: "bg-accent-50" },
    { icon: Calendar, value: 2, label: "Prochains matchs", color: "bg-blue-50" },
    { icon: UserPlus, value: 3, label: "Invitations", trend: "neutral" as const, color: "bg-purple-50" },
  ],
  manager: [
    { icon: Users, value: 15, label: "Joueurs", trend: "up" as const, trendValue: "+2", color: "bg-primary-50" },
    { icon: Calendar, value: 4, label: "Matchs programmés", color: "bg-blue-50" },
    { icon: Trophy, value: 8, label: "Victoires", trend: "up" as const, trendValue: "+1", color: "bg-accent-50" },
    { icon: UserPlus, value: 5, label: "Invitations envoyées", color: "bg-purple-50" },
  ],
  referee: [
    { icon: Shield, value: 18, label: "Matchs arbitrés", trend: "up" as const, trendValue: "+4", color: "bg-primary-50" },
    { icon: FileText, value: 18, label: "Rapports soumis", color: "bg-blue-50" },
    { icon: Star, value: "4.7", label: "Note moyenne", trend: "up" as const, trendValue: "+0.2", color: "bg-accent-50" },
    { icon: Calendar, value: 1, label: "Prochain match", color: "bg-purple-50" },
  ],
};

const UPCOMING_MATCHES = [
  { id: 1, teams: "FC Koppa vs AS Roma", date: "Dim. 20 Avr. — 15:00", venue: "Stade Municipal" },
  { id: 2, teams: "Inter Club vs FC Koppa", date: "Mer. 23 Avr. — 19:30", venue: "Terrain Synthétique Nord" },
  { id: 3, teams: "FC Koppa vs Olympique", date: "Sam. 26 Avr. — 14:00", venue: "Complexe Sportif Est" },
];

const RECENT_ACTIVITY = [
  { id: 1, text: "Vous avez rejoint l'équipe FC Koppa", time: "Il y a 2h", icon: Users },
  { id: 2, text: "Match terminé : victoire 3-1", time: "Hier", icon: Trophy },
  { id: 3, text: "Nouvelle invitation reçue", time: "Il y a 2 jours", icon: UserPlus },
  { id: 4, text: "Profil mis à jour", time: "Il y a 3 jours", icon: Award },
];

// ============================================
// Component
// ============================================

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const stats = ROLE_STATS[user.userType as keyof typeof ROLE_STATS] ?? ROLE_STATS.player;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">
          Bienvenue, {user.firstName} !
        </h1>
        <p className="mt-1 text-gray-500">
          Voici un aperçu de ton activité
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <StatCard
            key={stat.label}
            icon={stat.icon}
            value={stat.value}
            label={stat.label}
            trend={stat.trend}
            trendValue={stat.trendValue}
            color={stat.color}
            delay={i * 0.08}
          />
        ))}
      </div>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming matches */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.35 }}
          className="rounded-xl border border-gray-200 bg-white"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900 font-display">Prochains matchs</h3>
            <button className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700">
              Tout voir <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {UPCOMING_MATCHES.map((match) => (
              <div key={match.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                  <Trophy size={18} className="text-primary-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{match.teams}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {match.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={12} /> {match.venue}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent activity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.4 }}
          className="rounded-xl border border-gray-200 bg-white"
        >
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900 font-display">Activité récente</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {RECENT_ACTIVITY.map((activity) => {
              const Icon = activity.icon;
              return (
                <div key={activity.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <Icon size={14} className="text-gray-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700">{activity.text}</p>
                    <p className="text-xs text-gray-400">{activity.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Level & Progression */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.5 }}
        className="rounded-xl border border-gray-200 bg-white p-6"
      >
        <h3 className="mb-4 text-sm font-semibold text-gray-900 font-display">Niveau & Progression</h3>
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <LevelBadge level={7} progress={65} size={72} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Niveau 7 — Milieu confirmé</p>
            <p className="mb-3 text-xs text-gray-500">650 XP sur 1000 — encore 350 XP pour le niveau 8</p>
            <XPProgressBar currentXP={650} requiredXP={1000} level={7} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
