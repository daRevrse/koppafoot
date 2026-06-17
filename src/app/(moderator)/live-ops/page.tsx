"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Trophy, Loader2, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import type { Competition } from "@/types";

export default function LiveOpsHome() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listModeratedCompetitions(user.uid)
      .then((c) => { if (!cancelled) setCompetitions(c); })
      .catch((e) => console.error("listModeratedCompetitions failed:", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-gray-900">Mes compétitions</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Gère les matchs en direct des compétitions où tu es modérateur ou organisateur.
        </p>
      </div>

      {competitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50">
            <Trophy size={26} className="text-amber-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucune compétition</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Tu ne modères aucune compétition pour le moment. Un organisateur doit t&apos;ajouter comme modérateur.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {competitions.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/live-ops/${c.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-50 to-orange-50">
                  <Trophy size={20} className="text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">Voir les matchs</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 transition-colors group-hover:text-gray-500" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
