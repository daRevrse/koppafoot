"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Trophy, Calendar, MapPin, Clock, Search, Filter,
  Activity, MonitorPlay, ChevronRight, Loader2, Award
} from "lucide-react";
import { getGlobalMatches } from "@/lib/firestore";
import type { Match } from "@/types";
import Link from "next/link";
import { format } from "date-fns";

export default function CommunityMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "live" | "upcoming">("all");

  useEffect(() => {
    getGlobalMatches(50).then((data) => {
      setMatches(data);
      setLoading(false);
    });
  }, []);

  const filteredMatches = matches.filter(m => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[3rem] bg-gray-900 px-8 py-16 text-white shadow-2xl">
        <div className="absolute top-0 left-0 h-full w-full bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.15),transparent)]" />
        <div className="relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400"
          >
            <Activity size={12} className="animate-pulse" /> Direct & Prochains Matchs
          </motion.div>
          <h1 className="text-4xl font-black md:text-5xl font-display">Directory des Matchs</h1>
          <p className="mt-4 mx-auto max-w-lg text-lg font-medium text-gray-400 italic">
            Découvrez tous les matchs en cours et à venir au sein de la communauté KOPPAFOOT.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm">
           {[
             { id: "all", label: "Tous" },
             { id: "live", label: "En direct" },
             { id: "upcoming", label: "À venir" }
           ].map(t => (
             <button
               key={t.id}
               onClick={() => setFilter(t.id as any)}
               className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-tight transition-all ${
                 filter === t.id ? "bg-gray-900 text-white shadow-lg shadow-gray-200" : "text-gray-500 hover:bg-gray-50"
               }`}
             >
               {t.label}
             </button>
           ))}
        </div>
      </div>

      {loading ? (
        <div className="flex h-[40vh] flex-col items-center justify-center gap-4">
           <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
           <p className="font-bold text-gray-500 italic">Recherche des rencontres...</p>
        </div>
      ) : filteredMatches.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredMatches.map((match) => (
            <MatchCommunityCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-gray-200 py-20 text-center bg-gray-50/50">
           <Trophy size={48} className="text-gray-200 mb-4" />
           <p className="text-gray-500 font-bold italic">Aucun match trouvé pour ce filtre.</p>
        </div>
      )}
    </div>
  );
}

function MatchCommunityCard({ match }: { match: Match }) {
  const isLive = match.status === "live";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative overflow-hidden rounded-[2.5rem] bg-white border border-gray-100 shadow-sm transition-all hover:shadow-xl hover:border-emerald-200"
    >
      {/* Card Header Status */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
           <Award size={14} className={isLive ? "text-red-500 animate-pulse" : "text-emerald-500"} />
           <span className="text-[10px] font-black uppercase tracking-tight text-gray-500 italic">Format {match.format}</span>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
          isLive ? "bg-red-100 text-red-600" : 
          match.status === "completed" ? "bg-gray-100 text-gray-500" : "bg-emerald-100 text-emerald-600"
        }`}>
          {isLive ? "Live" : match.status === "completed" ? "Terminé" : "À venir"}
        </span>
      </div>

      <div className="p-8">
        {/* Scoreboard Style */}
        <div className="flex items-center justify-between gap-4 mb-6">
           <div className="flex flex-col items-center flex-1 text-center">
             <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 font-black text-xl text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors uppercase">
               {match.homeTeamName[0]}
             </div>
             <span className="text-xs font-black text-gray-900 leading-tight truncate w-full">{match.homeTeamName}</span>
           </div>

           <div className="flex flex-col items-center justify-center">
              {match.status === "completed" || isLive ? (
                <div className="flex items-center gap-3">
                   <span className="text-3xl font-black text-gray-900">{match.scoreHome || 0}</span>
                   <span className="text-gray-200 font-black text-xl">-</span>
                   <span className="text-3xl font-black text-gray-900">{match.scoreAway || 0}</span>
                </div>
              ) : (
                <span className="text-[11px] font-black italic text-gray-300">VS</span>
              )}
           </div>

           <div className="flex flex-col items-center flex-1 text-center">
             <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 font-black text-xl text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors uppercase">
               {match.awayTeamName[0]}
             </div>
             <span className="text-xs font-black text-gray-900 leading-tight truncate w-full">{match.awayTeamName}</span>
           </div>
        </div>

        {/* Details */}
        <div className="space-y-3 pt-4 border-t border-gray-50">
           <div className="flex items-center gap-3">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
               <Calendar size={14} />
             </div>
             <span className="text-xs font-bold text-gray-700">{match.date} à {match.time}</span>
           </div>
           <div className="flex items-center gap-3">
             <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
               <MapPin size={14} />
             </div>
             <span className="text-xs font-bold text-gray-700 truncate">{match.venueName}</span>
           </div>
        </div>

        {/* CTA */}
        <div className="mt-8">
           <Link
             href={`/matches/${match.id}/live`}
             className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-black uppercase tracking-tight transition-all shadow-sm group-hover:shadow-lg ${
               isLive ? "bg-red-600 text-white hover:bg-red-700" : "bg-gray-900 text-white hover:bg-black"
             }`}
           >
             {isLive ? "Suivre le direct" : "Voir les détails"}
             <ChevronRight size={14} />
           </Link>
        </div>
      </div>
    </motion.div>
  );
}
