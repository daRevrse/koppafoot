"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, Users, Shield, Trophy, MapPin, MessageCircle, Loader2 } from "lucide-react";
import { getPlatformCounts, getUserCityDistribution, type PlatformCounts, type CityDistribution } from "@/lib/admin-firestore";

export default function AdminStatsPage() {
  const [counts, setCounts] = useState<PlatformCounts | null>(null);
  const [cities, setCities] = useState<CityDistribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPlatformCounts(), getUserCityDistribution()])
      .then(([c, ci]) => { setCounts(c); setCities(ci); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>;

  const topCities = cities.slice(0, 10);
  const maxCity = topCities[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div>
        <motion.h1 initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-extrabold text-gray-900 font-display">Statistiques globales</motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de la plateforme KOPPAFOOT</motion.p>
      </div>

      {counts && (
        <>
          {/* Growth metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Users, label: "Utilisateurs", value: counts.users, sub: `${counts.players}J / ${counts.managers}M / ${counts.referees}A`, color: "bg-blue-500" },
              { icon: Shield, label: "Équipes", value: counts.teams, sub: `Joueurs moyens: ${counts.users > 0 ? Math.round(counts.players / Math.max(counts.teams, 1)) : 0}`, color: "bg-emerald-500" },
              { icon: Trophy, label: "Matchs", value: counts.matches, sub: `${counts.matchesCompleted} terminés, ${counts.matchesUpcoming} à venir`, color: "bg-amber-500" },
              { icon: MapPin, label: "Terrains", value: counts.venues, sub: `${counts.venueOwners} propriétaires`, color: "bg-purple-500" },
              { icon: MessageCircle, label: "Publications", value: counts.posts, sub: "Sur La Tribune", color: "bg-pink-500" },
              { icon: TrendingUp, label: "Taux de complétion", value: counts.matches > 0 ? `${Math.round((counts.matchesCompleted / counts.matches) * 100)}%` : "—", sub: "Matchs terminés / total", color: "bg-sky-500" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.color}`}><s.icon size={20} className="text-white" /></div>
                  <div>
                    <p className="text-2xl font-extrabold text-gray-900 font-display">{s.value}</p>
                    <p className="text-xs font-medium text-gray-500">{s.label}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">{s.sub}</p>
              </motion.div>
            ))}
          </div>

          {/* City distribution */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 font-display mb-5 flex items-center gap-2"><MapPin size={18} className="text-purple-500" /> Répartition par ville</h3>
            {topCities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
            ) : (
              <div className="space-y-3">
                {topCities.map((c, i) => (
                  <div key={c.city} className="flex items-center gap-3">
                    <span className="w-6 text-xs font-medium text-gray-400 text-right">{i + 1}</span>
                    <span className="w-28 text-sm font-medium text-gray-700 truncate">{c.city}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(c.count / maxCity) * 100}%` }} transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }} className="h-full bg-gradient-to-r from-purple-400 to-blue-500 rounded-full" />
                    </div>
                    <span className="w-10 text-xs font-bold text-gray-700 text-right">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
