"use client";

import { useEffect, useState, useMemo } from "react";
import { motion } from "motion/react";
import { MapPin, Search, Star, Loader2, Check, X as XIcon } from "lucide-react";
import { getAllVenues } from "@/lib/admin-firestore";
import type { Venue } from "@/types";

const SIZE_LABELS: Record<string, string> = { "5v5": "5v5", "7v7": "7v7", "11v11": "11v11", futsal: "Futsal" };
const SURFACE_LABELS: Record<string, string> = { natural_grass: "Gazon", synthetic: "Synthétique", hybrid: "Hybride", indoor: "Indoor" };

export default function AdminVenuesPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { getAllVenues(300).then(setVenues).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => {
    if (!search) return venues;
    const s = search.toLowerCase();
    return venues.filter((v) => v.name.toLowerCase().includes(s) || v.city.toLowerCase().includes(s));
  }, [venues, search]);

  return (
    <div className="space-y-6">
      <div>
        <motion.h1 initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="text-2xl font-extrabold text-gray-900 font-display">Gestion des terrains</motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-500 mt-0.5">{venues.length} terrain{venues.length > 1 ? "s" : ""} enregistré{venues.length > 1 ? "s" : ""}</motion.p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher par nom ou ville..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-gray-400"><MapPin size={40} className="mb-3 opacity-40" /><p className="text-sm">Aucun terrain</p></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -2 }} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50"><MapPin size={20} className="text-purple-600" /></div>
                  <div><h3 className="text-sm font-bold text-gray-900">{v.name}</h3><p className="text-xs text-gray-500">{v.city}</p></div>
                </div>
                {v.available ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700"><Check size={10} /> Dispo</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700"><XIcon size={10} /> Indispo</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3 truncate">{v.address}</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500">Format</p><p className="text-xs font-medium text-gray-700">{SIZE_LABELS[v.fieldSize] ?? v.fieldSize}</p></div>
                <div className="rounded-lg bg-gray-50 px-3 py-2"><p className="text-[10px] text-gray-500">Surface</p><p className="text-xs font-medium text-gray-700">{SURFACE_LABELS[v.fieldSurface] ?? v.fieldSurface}</p></div>
              </div>
              {v.rating > 0 && (
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-50">
                  <Star size={13} className="text-amber-400 fill-amber-400" /> <span className="text-xs font-semibold">{v.rating.toFixed(1)}</span> <span className="text-xs text-gray-400">({v.reviewCount})</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
