"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Trophy, Loader2, ChevronRight, Radio, Calendar, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listModeratedCompetitions } from "@/lib/competition-firestore";
import { onMatchesIModerate } from "@/lib/firestore";
import LiveTrainingCard from "@/components/competition/LiveTrainingCard";
import type { Competition, Match } from "@/types";

export default function LiveOpsHome() {
  const { user } = useAuth();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
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

  // Les matchs qu'on couvre à titre individuel, hors compétition. En direct :
  // un manager peut nous ajouter pendant qu'on a la page ouverte, et un match
  // qui passe en live doit changer d'allure sans rechargement.
  useEffect(() => {
    if (!user) return;
    return onMatchesIModerate(user.uid, setMatches);
  }, [user]);

  // Un match terminé n'a plus de console à tenir ; il reste consultable
  // depuis sa fiche, pas depuis un poste de commande.
  const aCouvrir = matches.filter(
    (m) => m.status !== "completed" && m.status !== "cancelled",
  );

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
        <h1 className="font-display text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">Console live</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          Les matchs qu&apos;on t&apos;a confiés, et les compétitions où tu es organisateur ou modérateur.
        </p>
      </div>

      {/* Practice before the real thing, always available, first-timers
          especially need it when the list below is empty. */}
      <LiveTrainingCard />

      {/* Les matchs confiés un par un. Ils passent AVANT les compétitions :
          on est ici parce qu'on en couvre un, la compétition est le cas du
          bénévole régulier. */}
      {aCouvrir.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Matchs à couvrir
          </h2>
          {aCouvrir.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/matches/${m.id}/manage`}
                className="group flex items-center gap-4 border border-gray-200/70 bg-white p-4 transition-all hover:border-gray-300"
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center ${
                  m.status === "live"
                    ? "bg-red-50 text-red-500"
                    : "bg-gradient-to-br from-emerald-50 to-teal-50 text-emerald-500"
                }`}>
                  <Radio size={20} className={m.status === "live" ? "animate-pulse" : ""} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-gray-900">
                    {m.homeTeamName} <span className="text-gray-300">vs</span> {m.awayTeamName}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {m.date} à {m.time}
                    </span>
                    {m.venueName && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} /> {m.venueName}
                      </span>
                    )}
                  </p>
                </div>
                {m.status === "live" ? (
                  <span className="shrink-0 bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                    En direct
                  </span>
                ) : (
                  <ChevronRight size={18} className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {competitions.length === 0 && aCouvrir.length === 0 ? (
        <div className="flex flex-col items-center justify-center border border-dashed border-gray-200/70 bg-white py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
            <Trophy size={26} className="text-amber-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Aucun match à couvrir</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Personne ne t&apos;a encore confié de match. Un organisateur t&apos;ajoute comme
            modérateur de sa compétition, ou un manager t&apos;ajoute sur un match précis.
          </p>
        </div>
      ) : competitions.length > 0 ? (
        <div className="grid gap-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            Compétitions modérées
          </h2>
          {competitions.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/live-ops/${c.id}`}
                className="group flex items-center gap-4 border border-gray-200/70 bg-white p-4 transition-all hover:border-gray-200/70"
              >
                <div className="flex h-12 w-12 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
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
      ) : null}
    </div>
  );
}
