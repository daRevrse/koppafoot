"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Users, Loader2, ArrowRight, Mail, Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listCompTeamsByManager } from "@/lib/competition-firestore";
import { getTeamsByManager } from "@/lib/firestore";
import CompetitionRegistrationPanel from "@/components/competition/CompetitionRegistrationPanel";
import type { CompTeam, Team } from "@/types";

// ============================================
// Mon équipe — the competition teams this manager owns. Two ways in: an
// organizer invites them onto an existing team (/invitations/equipe/[id]),
// or they enter one of their own clubs from the panel below.
// ============================================

export default function MyTeamsPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<CompTeam[] | null>(null);
  const [clubs, setClubs] = useState<Team[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    listCompTeamsByManager(user.uid)
      .then((t) => {
        if (!cancelled) setTeams(t);
      })
      .catch((err) => {
        console.error("Error loading managed teams:", err);
        if (!cancelled) setTeams([]);
      });
    // Clubs are the entry ticket: a manager registers a club, not a
    // competition team.
    getTeamsByManager(user.uid)
      .then((c) => {
        if (!cancelled) setClubs(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  if (teams === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
          <Users size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
            Mon équipe
          </h1>
          <p className="mt-0.5 text-sm font-bold text-gray-400">
            Les équipes de compétition dont tu es le manager.
          </p>
        </div>
      </div>

      {/* Entering a competition with one of the manager's own clubs. Sits
          above the list because it is how that list gets populated. */}
      <CompetitionRegistrationPanel clubs={clubs} />

      {teams.length === 0 ? (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <Mail size={26} />
          </div>
          <p className="mt-4 font-display text-lg font-black text-gray-900">
            Pas encore d&apos;équipe
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-gray-500">
            Un organisateur peut te confier une équipe de sa compétition — tu recevras
            l&apos;invitation par email et dans tes notifications.
          </p>
          <Link
            href="/competitions"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
          >
            <Trophy size={15} />
            Voir les compétitions
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map((team, i) => (
            <motion.div
              key={`${team.competitionId}-${team.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={`/mon-equipe/${team.competitionId}/${team.id}`}
                className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                  {team.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Users size={20} className="text-gray-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-gray-900">{team.name}</p>
                  <p className="mt-0.5 text-xs font-semibold text-gray-400">
                    {team.players.length} joueur{team.players.length !== 1 ? "s" : ""}
                    {team.group ? ` · Groupe ${team.group}` : ""}
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-gray-300" />
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
