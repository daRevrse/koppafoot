"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  BarChart3, Loader2, Trophy, Target, Shirt, Square, ArrowRight, Info,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listCompMatches } from "@/lib/competition-firestore";
import {
  computePlayerStats, computeAppearances, totalStats, EMPTY_STATS,
  type PlayerStats, type PlayerAppearance,
} from "@/lib/player-stats";
import type { LinkedCompPlayer } from "@/types";

// ============================================
// Mes statistiques — the player's own record, aggregated over every
// competition roster line linked to their account.
//
// Links are now created automatically: when a manager registers their club
// in a competition (or imports it into an existing team), every member's
// roster line carries their user_id and a row lands on their user doc. So a
// player with a linked line but no minutes yet is the NORMAL case, not an
// edge one — competitions are listed with zeros rather than hidden, because
// seeing the competition is how the player knows the link worked.
// ============================================

interface Row {
  link: LinkedCompPlayer;
  stats: PlayerStats;
  appearances: PlayerAppearance[];
}

function StatTile({
  label, value, Icon, accent,
}: {
  label: string; value: number; Icon: typeof Target; accent: string;
}) {
  return (
    <div className=" border border-gray-200/70 bg-white p-4 text-center">
      <Icon size={20} className={`mx-auto ${accent}`} />
      <p className="mt-2 font-display text-2xl font-black text-gray-900">{value}</p>
      <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
    </div>
  );
}

function matchDate(date: string | null): string {
  if (!date) return "";
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR", {
      day: "numeric", month: "short",
    });
  } catch {
    return date;
  }
}

export default function StatsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  const links = useMemo(() => user?.linkedCompPlayers ?? [], [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      if (links.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }

      // One read per distinct competition; every linked line of that
      // competition is then computed from the same match list.
      const byCompetition = new Map<string, LinkedCompPlayer[]>();
      for (const link of links) {
        const bucket = byCompetition.get(link.competition_id);
        if (bucket) bucket.push(link);
        else byCompetition.set(link.competition_id, [link]);
      }

      const out: Row[] = [];
      for (const [cid, compLinks] of byCompetition) {
        try {
          const matches = await listCompMatches(cid);
          for (const link of compLinks) {
            out.push({
              link,
              stats: computePlayerStats(matches, link.team_id, link.player_id),
              appearances: computeAppearances(matches, link.team_id, link.player_id),
            });
          }
        } catch (err) {
          console.error("Error loading matches for competition", cid, err);
          // A competition that fails to load must not blank the whole page.
          for (const link of compLinks) {
            out.push({ link, stats: { ...EMPTY_STATS }, appearances: [] });
          }
        }
      }
      if (!cancelled) setRows(out);
    })();

    return () => { cancelled = true; };
  }, [user, links]);

  if (!user) return null;

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  const total = totalStats(rows.map((r) => r.stats));
  const recent = rows
    .flatMap((r) => r.appearances.map((a) => ({ ...a, link: r.link })))
    .sort((a, b) =>
      `${b.match.date ?? ""}T${b.match.time ?? ""}`.localeCompare(
        `${a.match.date ?? ""}T${a.match.time ?? ""}`,
      ),
    )
    .slice(0, 8);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center bg-emerald-50 text-emerald-500">
          <BarChart3 size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black uppercase tracking-tight text-gray-900 sm:text-3xl">Mes statistiques</h1>
          <p className="mt-0.5 text-sm font-bold text-gray-400">
            Ton bilan sur toutes les compétitions KoppaFoot.
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-[2rem] border border-gray-200/70 bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center bg-gray-100 text-gray-300">
            <Users size={26} />
          </div>
          <p className="mt-4 font-display text-lg font-black text-gray-900">
            Pas encore de compétition
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-gray-500">
            Tes statistiques se remplissent toutes seules dès que ton équipe est
            engagée dans une compétition. Rien à faire de ton côté : c&apos;est ton
            manager qui inscrit l&apos;équipe, et tu apparais automatiquement sur les
            feuilles de match.
          </p>
          <p className="mx-auto mt-3 max-w-sm text-xs font-semibold text-gray-400">
            Tu n&apos;es dans aucune équipe ? Le mercato est fait pour ça.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/mercato"
              className="inline-flex items-center gap-2 bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
            >
              Trouver une équipe
            </Link>
            <Link
              href="/competitions"
              className="inline-flex items-center gap-2 border border-gray-200/70 px-5 py-3 text-sm font-black text-gray-600 transition-colors hover:bg-gray-50"
            >
              <Trophy size={15} />
              Voir les compétitions
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Career totals */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Matchs" value={total.matchesPlayed} Icon={Shirt} accent="text-emerald-500" />
            <StatTile label="Titulaire" value={total.starts} Icon={Users} accent="text-emerald-500" />
            <StatTile label="Buts" value={total.goals} Icon={Target} accent="text-emerald-500" />
            <StatTile
              label="Cartons"
              value={total.yellowCards + total.redCards}
              Icon={Square}
              accent={total.redCards > 0 ? "text-red-500" : "text-amber-400"}
            />
          </div>

          {/* Per competition */}
          <div className="space-y-3">
            <p className="px-1 text-xs font-black uppercase tracking-widest text-gray-400">
              Par compétition
            </p>
            {rows.map((row, i) => {
              const noMinutes = row.stats.matchesPlayed === 0;
              return (
                <motion.div
                  key={`${row.link.competition_id}-${row.link.player_id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={`/c/${row.link.competition_slug}/teams/${row.link.team_id}`}
                    className="flex items-center gap-4 border border-gray-200/70 bg-white p-4 transition-all hover:border-gray-200/70"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center bg-amber-50 text-amber-500">
                      <Trophy size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-900">
                        {row.link.competition_name}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-gray-400">
                        {row.link.team_name} · {row.link.player_name}
                      </p>
                      {noMinutes ? (
                        // Zeros on purpose: this is what tells the player the
                        // link worked and they are on the squad sheet.
                        <p className="mt-1.5 text-xs font-bold text-gray-400">
                          Inscrit — aucun match joué pour l&apos;instant
                        </p>
                      ) : (
                        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-gray-600">
                          <span>{row.stats.matchesPlayed} match{row.stats.matchesPlayed !== 1 ? "s" : ""}</span>
                          <span>{row.stats.starts} titulaire</span>
                          <span className="text-emerald-600">
                            {row.stats.goals} but{row.stats.goals !== 1 ? "s" : ""}
                          </span>
                          {row.stats.yellowCards > 0 && (
                            <span className="text-amber-600">{row.stats.yellowCards} 🟨</span>
                          )}
                          {row.stats.redCards > 0 && (
                            <span className="text-red-600">{row.stats.redCards} 🟥</span>
                          )}
                        </p>
                      )}
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-gray-300" />
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* Match by match — the question a player actually opens with */}
          {recent.length > 0 && (
            <div className="space-y-3">
              <p className="px-1 text-xs font-black uppercase tracking-widest text-gray-400">
                Mes derniers matchs
              </p>
              <div className="divide-y divide-gray-50 overflow-hidden border border-gray-200/70 bg-white">
                {recent.map((a) => {
                  const m = a.match;
                  const isHome = m.homeTeamId === a.link.team_id;
                  const opponent = isHome ? m.awayTeamName : m.homeTeamName;
                  const mine = isHome ? m.scoreHome : m.scoreAway;
                  const theirs = isHome ? m.scoreAway : m.scoreHome;
                  const won = (mine ?? 0) > (theirs ?? 0);
                  const drew = (mine ?? 0) === (theirs ?? 0);
                  return (
                    <Link
                      key={`${m.id}-${a.link.player_id}`}
                      href={`/c/${a.link.competition_slug}/matches/${m.id}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50/70"
                    >
                      <span className="w-11 shrink-0 text-[11px] font-bold text-gray-400">
                        {matchDate(m.date)}
                      </span>
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center text-[11px] font-black text-white ${
                          drew ? "bg-gray-400" : won ? "bg-emerald-500" : "bg-red-400"
                        }`}
                      >
                        {drew ? "N" : won ? "V" : "D"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900">{opponent}</p>
                        <p className="truncate text-[11px] font-semibold text-gray-400">
                          {mine ?? 0}–{theirs ?? 0} · {a.role === "starter" ? "Titulaire" : "Entré en jeu"}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-black">
                        {a.goals > 0 && (
                          <span className="text-emerald-600">{a.goals}&nbsp;⚽</span>
                        )}
                        {a.yellowCards > 0 && <span>🟨</span>}
                        {a.redCards > 0 && <span>🟥</span>}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <p className="flex items-start gap-2 bg-gray-50 p-4 text-xs font-semibold leading-relaxed text-gray-500">
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
