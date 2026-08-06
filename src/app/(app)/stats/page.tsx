"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BarChart3, Loader2, Trophy, Target, ShirtIcon, Square, ArrowRight, Info,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listCompMatches } from "@/lib/competition-firestore";
import {
  computePlayerStats, totalStats, EMPTY_STATS,
  type PlayerCompetitionStats,
} from "@/lib/player-stats";

// ============================================
// Mes statistiques — the player's own record, aggregated over every
// competition roster line validated as being them (see the roster-claims
// flow). A player with no validated line sees how to get one.
// ============================================

function StatTile({
  label,
  value,
  Icon,
  accent,
}: {
  label: string;
  value: number;
  Icon: typeof Target;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center shadow-sm">
      <Icon size={20} className={`mx-auto ${accent}`} />
      <p className="mt-2 font-display text-2xl font-black text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

export default function StatsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PlayerCompetitionStats[] | null>(null);

  const links = useMemo(() => user?.linkedCompPlayers ?? [], [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // One read per distinct competition, then every linked line of that
    // competition is computed from the same match list.
    (async () => {
      if (links.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }
      const byCompetition = new Map<string, typeof links>();
      for (const link of links) {
        const bucket = byCompetition.get(link.competition_id);
        if (bucket) bucket.push(link);
        else byCompetition.set(link.competition_id, [link]);
      }

      const out: PlayerCompetitionStats[] = [];
      for (const [cid, compLinks] of byCompetition) {
        try {
          const matches = await listCompMatches(cid);
          for (const link of compLinks) {
            out.push({
              link,
              ...computePlayerStats(matches, link.team_id, link.player_id),
            });
          }
        } catch (err) {
          console.error("Error loading matches for competition", cid, err);
          // A competition that fails to load shouldn't blank the whole page.
          for (const link of compLinks) out.push({ link, ...EMPTY_STATS });
        }
      }
      if (!cancelled) setRows(out);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, links]);

  if (!user) return null;

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const total = totalStats(rows);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
          <BarChart3 size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
            Mes statistiques
          </h1>
          <p className="mt-0.5 text-sm font-bold text-gray-400">
            Ton bilan sur toutes les compétitions KoppaFoot.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <BarChart3 size={26} />
          </div>
          <p className="mt-4 font-display text-lg font-black text-gray-900">
            Pas encore de stats
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-gray-500">
            Tes statistiques se remplissent dès que tu es rattaché à ta ligne dans
            l&apos;effectif d&apos;une compétition. Ouvre la page de ton équipe et
            clique sur <span className="font-black text-gray-700">« C&apos;est moi »</span> —
            l&apos;organisateur ou ton manager valide, et tout se remplit tout seul.
          </p>
          <Link
            href="/competitions"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
          >
            <Trophy size={15} />
            Trouver ma compétition
          </Link>
        </div>
      ) : (
        <>
          {/* Career totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Matchs" value={total.matchesPlayed} Icon={ShirtIcon} accent="text-emerald-500" />
            <StatTile label="Buts" value={total.goals} Icon={Target} accent="text-emerald-500" />
            <StatTile label="Jaunes" value={total.yellowCards} Icon={Square} accent="text-amber-400" />
            <StatTile label="Rouges" value={total.redCards} Icon={Square} accent="text-red-500" />
          </div>

          {/* Per competition */}
          <div className="space-y-3">
            <p className="px-1 text-xs font-black uppercase tracking-widest text-gray-400">
              Par compétition
            </p>
            {rows.map((row, i) => (
              <motion.div
                key={`${row.link.competition_id}-${row.link.player_id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/c/${row.link.competition_slug}/teams/${row.link.team_id}`}
                  className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                    <Trophy size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-gray-900">
                      {row.link.competition_name}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                      {row.link.team_name} · {row.link.player_name}
                    </p>
                    <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-gray-600">
                      <span>{row.matchesPlayed} match{row.matchesPlayed !== 1 ? "s" : ""}</span>
                      <span>{row.starts} titulaire</span>
                      <span className="text-emerald-600">{row.goals} but{row.goals !== 1 ? "s" : ""}</span>
                      {row.yellowCards > 0 && <span className="text-amber-600">{row.yellowCards} 🟨</span>}
                      {row.redCards > 0 && <span className="text-red-600">{row.redCards} 🟥</span>}
                    </p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-gray-300" />
                </Link>
              </motion.div>
            ))}
          </div>

          <p className="flex items-start gap-2 rounded-2xl bg-gray-50 p-4 text-xs font-semibold leading-relaxed text-gray-500">
            <Info size={14} className="mt-0.5 shrink-0 text-gray-400" />
            Un match compte comme joué quand il est terminé et que tu figures sur la
            feuille de match. Les buts et cartons sont ceux saisis en direct par
            l&apos;organisateur. Les passes décisives ne sont pas encore enregistrées
            en console live.
          </p>
        </>
      )}
    </div>
  );
}
