"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Trophy, Users, Target, UserPlus, Calendar, Shield, Award,
  FileText, Star, Clock, MapPin, ChevronRight, Play
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getTeamsByManager,
  getTeamsByPlayer,
  getMatchesByTeamIds,
  getParticipationsForPlayer,
  onInvitationsForPlayer,
  onInvitationsByManager,
  onRefereeAssignments,
} from "@/lib/firestore";
import type { Team, Match, Participation, Invitation } from "@/types";
import StatCard from "@/components/ui/StatCard";
import XPProgressBar from "@/components/ui/XPProgressBar";
import LevelBadge from "@/components/ui/LevelBadge";

// ============================================
// Helpers
// ============================================

function getRelevantMatches(matches: Match[]): Match[] {
  return matches
    .filter((m) => m.status === "upcoming" || m.status === "live")
    .sort((a, b) => {
      // Live matches first
      if (a.status === "live" && b.status !== "live") return -1;
      if (a.status !== "live" && b.status === "live") return 1;
      
      const dateA = `${a.date}T${a.time || "00:00"}`;
      const dateB = `${b.date}T${b.time || "00:00"}`;
      return dateA.localeCompare(dateB);
    })
    .slice(0, 3);
}

function formatMatchDate(date: string, time: string): string {
  try {
    const d = new Date(date);
    const days = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
    const months = ["Jan.", "Fév.", "Mar.", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sep.", "Oct.", "Nov.", "Déc."];
    return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} — ${time || "Heure N/A"}`;
  } catch {
    return `${date} — ${time}`;
  }
}

// ============================================
// Static data (kept as-is for now)
// ============================================

const REFEREE_STATS = [
  { icon: Shield, value: 0, label: "Matchs arbitrés", color: "bg-primary-50" },
  { icon: FileText, value: 0, label: "Rapports soumis", color: "bg-blue-50" },
  { icon: Star, value: "N/A", label: "Note moyenne", color: "bg-accent-50" },
  { icon: Calendar, value: 0, label: "Prochain match", color: "bg-purple-50" },
];

const RECENT_ACTIVITY = [
  { id: 1, text: "Vous avez rejoint l'équipe FC Koppa", time: "Il y a 2h", icon: Users },
  { id: 2, text: "Match terminé : victoire 3-1", time: "Hier", icon: Trophy },
  { id: 3, text: "Nouvelle invitation reçue", time: "Il y a 2 jours", icon: UserPlus },
  { id: 4, text: "Profil mis à jour", time: "Il y a 3 jours", icon: Award },
];

// ============================================
// Skeleton
// ============================================

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
      </div>
      <div className="mt-3 h-7 w-16 rounded bg-gray-200 animate-pulse" />
      <div className="mt-1.5 h-4 w-24 rounded bg-gray-200 animate-pulse" />
    </div>
  );
}

function MatchListSkeleton() {
  return (
    <div className="divide-y divide-gray-50">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-10 w-10 rounded-lg bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-56 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function DashboardPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState(0);
  const [refereeMatches, setRefereeMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let unsubInvitations: (() => void) | null = null;

    async function loadData() {
      try {
        if (user!.userType === "player") {
          const [playerTeams, playerParticipations] = await Promise.all([
            getTeamsByPlayer(user!.uid),
            getParticipationsForPlayer(user!.uid),
          ]);
          if (cancelled) return;
          setTeams(playerTeams);
          setParticipations(playerParticipations);

          const teamIds = playerTeams.map((t) => t.id);
          if (teamIds.length > 0) {
            const playerMatches = await getMatchesByTeamIds(teamIds);
            if (!cancelled) setMatches(playerMatches);
          }

          // Real-time listener for pending invitations
          unsubInvitations = onInvitationsForPlayer(user!.uid, (invitations: Invitation[]) => {
            if (!cancelled) {
              setPendingInvitations(invitations.filter((inv) => inv.status === "pending").length);
            }
          });
        } else if (user!.userType === "manager") {
          const managerTeams = await getTeamsByManager(user!.uid);
          if (cancelled) return;
          setTeams(managerTeams);

          const teamIds = managerTeams.map((t) => t.id);
          if (teamIds.length > 0) {
            const managerMatches = await getMatchesByTeamIds(teamIds);
            if (!cancelled) setMatches(managerMatches);
          }

          // Real-time listener for sent invitations
          unsubInvitations = onInvitationsByManager(user!.uid, (invitations: Invitation[]) => {
            if (!cancelled) {
              setPendingInvitations(invitations.filter((inv) => inv.status === "pending").length);
            }
          });
        } else if (user!.userType === "referee") {
          unsubInvitations = onRefereeAssignments(user!.uid, (matches: Match[]) => {
            if (!cancelled) {
              setRefereeMatches(matches);
              setMatches(matches); // Also set matches for the common list
            }
          });
        }
      } catch (err) {
        console.error("Erreur lors du chargement du tableau de bord:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
      if (unsubInvitations) unsubInvitations();
    };
  }, [user]);

  if (!user) return null;

  // ---- Compute stats based on role ----

  const relevantMatches = getRelevantMatches(matches);

  const stats = (() => {
    if (user.userType === "player") {
      const confirmedParticipations = participations.filter((p) => p.status === "confirmed");
      const matchesPlayed = confirmedParticipations.length;
      const totalGoals = confirmedParticipations.reduce((sum, p) => sum + p.goals, 0);
      const upcomingCount = relevantMatches.length;

      return [
        { icon: Trophy, value: matchesPlayed, label: "Matchs joués", color: "bg-primary-50" },
        { icon: Target, value: totalGoals, label: "Buts marqués", color: "bg-accent-50" },
        { icon: Calendar, value: upcomingCount, label: "Prochains matchs", color: "bg-blue-50" },
        { icon: UserPlus, value: pendingInvitations, label: "Invitations", color: "bg-purple-50" },
      ];
    }

    if (user.userType === "manager") {
      const totalPlayers = teams.reduce((sum, t) => sum + t.memberIds.length, 0);
      const upcomingCount = matches.filter((m) => m.status === "upcoming").length;
      const totalWins = teams.reduce((sum, t) => sum + t.wins, 0);

      return [
        { icon: Users, value: totalPlayers, label: "Joueurs", color: "bg-primary-50" },
        { icon: Calendar, value: upcomingCount, label: "Matchs programmés", color: "bg-blue-50" },
        { icon: Trophy, value: totalWins, label: "Victoires", color: "bg-accent-50" },
        { icon: UserPlus, value: pendingInvitations, label: "Invitations envoyées", color: "bg-purple-50" },
      ];
    }

    if (user.userType === "referee") {
      const confirmedMatches = refereeMatches.filter(m => m.refereeStatus === "confirmed");
      const liveCount = refereeMatches.filter(m => m.status === "live").length;
      const completedCount = refereeMatches.filter(m => m.status === "completed").length;
      const pendingInvites = refereeMatches.filter(m => m.refereeStatus === "invited").length;

      return [
        { icon: Play, value: liveCount, label: "Matchs en direct", color: "bg-red-50" },
        { icon: Shield, value: confirmedMatches.length, label: "Matchs confirmés", color: "bg-primary-50" },
        { icon: Award, value: completedCount, label: "Matchs arbitrés", color: "bg-emerald-50" },
        { icon: UserPlus, value: pendingInvites, label: "Invitations", color: "bg-purple-50" },
      ];
    }

    return REFEREE_STATS;
  })();

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Welcome */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 font-display">
          Bienvenue, {user.firstName} !
        </h1>
        <p className="mt-0.5 text-sm sm:text-base text-gray-500">
          Voici un aperçu de ton activité
        </p>
      </motion.div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatCard
              key={stat.label}
              icon={stat.icon}
              value={stat.value}
              label={stat.label}
              color={stat.color}
              delay={i * 0.08}
            />
          ))}
        </div>
      )}

      {/* Two columns */}
      <div className="grid gap-3 sm:gap-5 lg:grid-cols-2">
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
          {loading ? (
            <MatchListSkeleton />
          ) : relevantMatches.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {relevantMatches.map((match) => (
                <div key={match.id} className="flex items-center gap-3 sm:gap-4 px-3 sm:px-5 py-2.5 sm:py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                    <Trophy size={18} className="text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {match.homeTeamName} vs {match.awayTeamName}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500">
                      {match.status === "live" ? (
                        <span className="flex items-center gap-1 font-bold text-red-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                          EN DIRECT
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {formatMatchDate(match.date, match.time)}
                        </span>
                      )}
                      {match.venueName && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {match.venueName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <Calendar size={24} className="text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">Aucun match à venir</p>
            </div>
          )}
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
                <div key={activity.id} className="flex items-center gap-3 px-3 sm:px-5 py-2.5 sm:py-3.5">
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
        className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6"
      >
        <h3 className="mb-3 sm:mb-4 text-sm font-semibold text-gray-900 font-display">Niveau & Progression</h3>
        <div className="flex items-center gap-3 sm:gap-4">
          <LevelBadge level={7} progress={65} size={56} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">Niveau 7 — Milieu confirmé</p>
            <p className="mb-2 sm:mb-3 text-xs text-gray-500">650 / 1000 XP — 350 XP restants</p>
            <XPProgressBar currentXP={650} requiredXP={1000} level={7} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
