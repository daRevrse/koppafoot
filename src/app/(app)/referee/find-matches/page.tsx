"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Search, MapPin, Calendar, Clock, Award, Shield,
  ChevronRight, Filter, X, Loader2, AlertCircle, CheckCircle2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getMatchesLookingForReferee, applyToMatchAsReferee } from "@/lib/firestore";
import type { Match } from "@/types";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ============================================
// Constants
// ============================================

const CITIES = ["Toutes", "Paris", "Lyon", "Marseille", "Toulouse"];

// ============================================
// Component
// ============================================

export default function FindMatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [filterCity, setFilterCity] = useState("Toutes");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      try {
        const results = await getMatchesLookingForReferee();
        setMatches(results);
      } catch (err) {
        console.error("Erreur lors du chargement des matchs:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const handleApply = async (matchId: string) => {
    if (!user) return;
    setApplying(matchId);
    try {
      await applyToMatchAsReferee(matchId, user.uid, `${user.firstName} ${user.lastName}`);
      // Optimistic update: remove from list
      setMatches(prev => prev.filter(m => m.id !== matchId));
    } catch (err) {
      console.error("Erreur lors de la postulation:", err);
    } finally {
      setApplying(null);
    }
  };

  const filteredMatches = matches.filter(m => {
    const matchesCity = filterCity === "Toutes" || m.venueCity === filterCity;
    const matchesSearch = !searchQuery || 
      m.homeTeamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.awayTeamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.venueName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCity && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-emerald-900 p-8 text-white shadow-2xl lg:p-12">
        <div className="relative z-10 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-800/50 px-3 py-1 text-xs font-semibold text-emerald-300 backdrop-blur-md"
          >
            <Shield size={14} /> Espace Arbitre
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-4 text-4xl font-black tracking-tight font-display lg:text-5xl"
          >
            Trouve ton prochain <span className="text-accent-400">match</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-lg text-emerald-100/80 leading-relaxed"
          >
            Parcours les défis et matchs programmés qui recherchent un arbitre certifié. 
            Dépose ta candidature en un clic et coordonne la rencontre.
          </motion.p>
        </div>

        {/* Decorative elements */}
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-48 w-48 translate-x-12 translate-y-12 rounded-full bg-accent-500/10 blur-2xl" />
      </div>

      {/* Search & Filters */}
      <div className="sticky top-0 z-30 -mx-1 px-1 py-1">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4 rounded-2xl border border-white/40 bg-white/80 p-4 shadow-xl backdrop-blur-xl md:flex-row md:items-center"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher une équipe, un terrain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border-gray-200 bg-gray-50/50 py-3 pl-10 pr-4 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative min-w-[140px]">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <select
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full appearance-none rounded-xl border-gray-200 bg-gray-50/50 py-3 pl-10 pr-8 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-[46px] items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all ${
                showFilters ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Plus de filtres</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Matches Grid */}
      {loading ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-gray-500 animate-pulse">Recherche des matchs disponibles...</p>
        </div>
      ) : filteredMatches.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredMatches.map((match, idx) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-all hover:border-emerald-200"
            >
              {/* Card Header: Teams */}
              <div className="bg-emerald-50/50 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col items-center gap-2 flex-1 text-center">
                    <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 shadow-sm border border-emerald-200 uppercase">
                      {match.homeTeamName[0]}
                    </div>
                    <span className="text-xs font-bold text-gray-900 truncate max-w-full leading-tight">
                      {match.homeTeamName}
                    </span>
                  </div>
                  
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase text-emerald-400 bg-white px-2 py-0.5 rounded-full border border-emerald-100 italic">VS</span>
                  </div>

                  <div className="flex flex-col items-center gap-2 flex-1 text-center">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 shadow-sm border border-blue-200 uppercase">
                      {match.awayTeamName[0]}
                    </div>
                    <span className="text-xs font-bold text-gray-900 truncate max-w-full leading-tight">
                      {match.awayTeamName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Match info */}
              <div className="flex-1 p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      <Calendar size={12} className="text-emerald-500" /> Date
                    </div>
                    <div className="text-sm font-semibold text-gray-900 capitalize leading-none">
                      {format(new Date(match.date), "EEEE d MMMM", { locale: fr })}
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                      <Clock size={12} className="text-emerald-500" /> Heure
                    </div>
                    <div className="text-sm font-semibold text-gray-900 leading-none">
                      {match.time}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                    <MapPin size={12} className="text-emerald-500" /> Lieu
                  </div>
                  <div className="text-sm font-medium text-gray-900 leading-tight">
                    {match.venueName}, <span className="text-gray-500">{match.venueCity}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-accent-100 flex items-center justify-center">
                      <Award size={12} className="text-accent-700" />
                    </div>
                    <span className="text-[11px] font-bold text-accent-700 uppercase tracking-tighter">
                      Format {match.format}
                    </span>
                  </div>
                  
                  {match.refereeStatus === "pending" && (
                     <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700 uppercase italic animate-pulse">
                      <Loader2 size={10} className="animate-spin" /> Postulant présent
                    </div>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="p-6 pt-0">
                <button
                  onClick={() => handleApply(match.id)}
                  disabled={!!applying}
                  className="group/btn relative w-full overflow-hidden rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:opacity-50"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {applying === match.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Traitement...
                      </>
                    ) : (
                      <>
                        Postuler comme arbitre
                        <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 z-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 transition-opacity group-hover/btn:opacity-100" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex min-h-[400px] flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-white/50 p-12 text-center"
        >
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gray-50 text-gray-300">
            <Shield size={48} strokeWidth={1.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 font-display">Aucun match disponible</h3>
          <p className="mx-auto mt-2 max-w-sm text-gray-500">
            Il n&apos;y a actuellement aucun match en attente d&apos;arbitre. 
            Reviens plus tard ou ajuste tes filtres !
          </p>
          {(filterCity !== "Toutes" || searchQuery) && (
            <button
              onClick={() => { setFilterCity("Toutes"); setSearchQuery(""); }}
              className="mt-6 font-bold text-emerald-600 hover:text-emerald-700"
            >
              Réinitialiser les filtres
            </button>
          )}
        </motion.div>
      )}

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="rounded-3xl bg-gradient-to-br from-accent-500 to-accent-600 p-8 text-white shadow-xl lg:p-12"
      >
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
             <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-md">
              <Award size={14} /> Recommandations
            </div>
            <h2 className="text-3xl font-black font-display tracking-tight">Certification & Intégrité</h2>
            <p className="mt-4 text-accent-50 text-lg leading-relaxed">
              En postulant, tu t&apos;engages &agrave; respecter la charte de fair-play KOPPAFOOT. 
              Une fois ta candidature accept&eacute;e par le manager, le match sera ajout&eacute; &agrave; ton calendrier et tu pourras saisir le rapport final.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur-md">
              <span className="text-2xl font-black">100%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-100">Fiabilité</span>
            </div>
            <div className="flex flex-col items-center rounded-2xl bg-white/10 p-4 backdrop-blur-md">
               <span className="text-2xl font-black">2k+</span>
               <span className="text-[10px] font-bold uppercase tracking-widest text-accent-100">Arbitres</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
