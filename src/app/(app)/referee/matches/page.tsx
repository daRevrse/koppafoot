"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck, Calendar, Clock, MapPin, ChevronRight,
  Loader2, Award, FileText, CheckCircle2, History,
  AlertCircle, Trophy, User, ArrowRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onRefereeAssignments } from "@/lib/firestore";
import type { Match } from "@/types";
import { format, isAfter, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";

// ============================================
// Types & Constants
// ============================================

type TabType = "upcoming" | "pending" | "completed";

// ============================================
// Component
// ============================================

export default function RefereeMatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("upcoming");

  useEffect(() => {
    if (!user) return;
    const unsub = onRefereeAssignments(user.uid, (data) => {
      setMatches(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const upcomingMatches = matches.filter(m => m.status === "upcoming" && m.refereeStatus === "confirmed");
  const pendingApplications = matches.filter(m => m.refereeStatus === "pending");
  const completedMatches = matches.filter(m => m.status === "completed");

  const tabContent = {
    upcoming: {
      data: upcomingMatches,
      title: "Matchs programmés",
      emptyMsg: "Aucun match programmé pour le moment.",
      icon: <Calendar size={20} />
    },
    pending: {
      data: pendingApplications,
      title: "Candidatures envoyées",
      emptyMsg: "Tu n'as aucune candidature en attente.",
      icon: <Loader2 size={20} />
    },
    completed: {
      data: completedMatches,
      title: "Historique",
      emptyMsg: "Aucun match arbitré dans ton historique.",
      icon: <History size={20} />
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight font-display">Mes Matchs</h1>
          <p className="mt-1 text-sm text-gray-500 font-medium">Gère tes assignations et ton historique d&apos;arbitrage</p>
        </div>
        <Link 
          href="/referee/find-matches"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-600 active:scale-[0.98] shadow-lg shadow-gray-200"
        >
          Trouver un match
          <ChevronRight size={16} />
        </Link>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Validés", value: upcomingMatches.length, color: "text-emerald-600", bg: "bg-emerald-50", icon: ShieldCheck },
          { label: "En attente", value: pendingApplications.length, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
          { label: "Terminés", value: completedMatches.length, color: "text-blue-600", bg: "bg-blue-50", icon: Award },
          { label: "Saison 2024", value: "32", color: "text-purple-600", bg: "bg-purple-50", icon: Trophy },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`rounded-2xl p-4 ${stat.bg} border border-white/50 shadow-sm`}
          >
            <div className="flex items-center gap-3">
              <div className={`rounded-xl bg-white/80 p-2 shadow-sm ${stat.color}`}>
                <stat.icon size={20} />
              </div>
              <div>
                <div className="text-2xl font-black text-gray-900">{stat.value}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{stat.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-2xl bg-gray-100 p-1.5 md:w-fit">
        {(Object.keys(tabContent) as TabType[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
              activeTab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tabContent[t].icon}
            {tabContent[t].title}
            {tabContent[t].data.length > 0 && (
              <span className={`ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-black ${
                activeTab === t ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
              }`}>
                {tabContent[t].data.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="space-y-4"
        >
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm font-medium text-gray-400">Chargement de tes matchs...</p>
            </div>
          ) : tabContent[activeTab].data.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {tabContent[activeTab].data.map((match) => (
                <div
                  key={match.id}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between border-b border-gray-50 bg-gray-50/30 px-6 py-4">
                    <div className="flex items-center gap-2">
                       <Award size={14} className="text-emerald-500" />
                       <span className="text-[11px] font-black uppercase tracking-tight text-gray-500 italic">
                        Format {match.format}
                       </span>
                    </div>
                    {match.status === "completed" ? (
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase text-blue-700">Terminé</span>
                    ) : (
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
                        match.refereeStatus === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700 animate-pulse"
                      }`}>
                        {match.refereeStatus === "confirmed" ? "Confirmé" : "En attente manager"}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6 space-y-4">
                    <div className="flex items-center justify-between gap-6">
                      <div className="flex flex-1 flex-col items-center text-center">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-emerald-600 border border-emerald-100 shadow-sm mb-2 uppercase">
                          {match.homeTeamName[0]}
                        </div>
                        <div className="text-xs font-black text-gray-900 leading-tight truncate w-full">{match.homeTeamName}</div>
                      </div>

                      {match.status === "completed" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-gray-900">{match.scoreHome}</span>
                          <span className="text-gray-300 font-bold">-</span>
                          <span className="text-2xl font-black text-gray-900">{match.scoreAway}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-black bg-white border border-gray-200 px-2 py-0.5 rounded-lg text-gray-400 italic">VS</div>
                      )}

                      <div className="flex flex-1 flex-col items-center text-center">
                        <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center font-bold text-blue-600 border border-blue-100 shadow-sm mb-2 uppercase">
                          {match.awayTeamName[0]}
                        </div>
                        <div className="text-xs font-black text-gray-900 leading-tight truncate w-full">{match.awayTeamName}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold text-gray-700">{format(new Date(match.date), "dd/MM/yyyy")}</span>
                      </div>
                      <div className="flex items-center gap-2 justify-end text-right">
                        <Clock size={14} className="text-emerald-500" />
                        <span className="text-xs font-bold text-gray-700">{match.time}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-gray-500 truncate">{match.venueName}, {match.venueCity}</span>
                    </div>

                    {/* Actions */}
                    <div className="pt-2">
                      {activeTab === "upcoming" && (
                         <Link
                          href={`/referee/reports?matchId=${match.id}`}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-tight text-white transition-all hover:bg-emerald-700 active:scale-[0.98]"
                         >
                          Saisir le score
                          <FileText size={14} />
                         </Link>
                      )}
                      
                      {activeTab === "completed" && (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 justify-center">
                          <CheckCircle2 size={14} /> Rapport validé
                         </div>
                      )}

                      {activeTab === "pending" && (
                         <div className="text-center text-[10px] font-black uppercase text-amber-600 bg-amber-50 py-2 rounded-xl border border-amber-100 italic">
                           Candidature en cours d&apos;examen
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-100 bg-white/50 p-8 text-center">
              <div className="mb-4 text-gray-200">
                {activeTab === "upcoming" ? <ShieldCheck size={48} /> : <History size={48} />}
              </div>
              <p className="max-w-[240px] text-sm font-medium text-gray-400">{tabContent[activeTab].emptyMsg}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
