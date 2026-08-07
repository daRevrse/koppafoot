"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Trophy, Loader2, ArrowRight, Mail, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { listCompTeamsByManager, getCompetition } from "@/lib/competition-firestore";
import { getTeamsByManager } from "@/lib/firestore";
import { COMPETITION_TYPE_LABELS } from "@/lib/competition-format";
import CompetitionRegistrationPanel from "@/components/competition/CompetitionRegistrationPanel";
import type { Competition, CompTeam, CompetitionStatus, Team } from "@/types";

// ============================================
// Mes compétitions — the competitions this manager's teams are entered in.
// Two ways in: an organizer invites them onto an existing team
// (/invitations/equipe/[id]), or they register one of their own clubs from
// the panel below.
//
// The card leads with the COMPETITION, not the team: a manager knows their
// own squad, what they come here for is "where are we playing, and what
// stage is it at".
// ============================================

const STATUS_LABELS: Record<CompetitionStatus, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-gray-100 text-gray-600" },
  registration: { label: "Inscriptions", cls: "bg-blue-50 text-blue-700" },
  group_stage: { label: "Phase de groupes", cls: "bg-amber-50 text-amber-700" },
  knockout: { label: "Phase finale", cls: "bg-purple-50 text-purple-700" },
  completed: { label: "Terminée", cls: "bg-emerald-50 text-emerald-700" },
};

interface Entry {
  team: CompTeam;
  competition: Competition | null;
}

export default function MyTeamsPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [clubs, setClubs] = useState<Team[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const teams = await listCompTeamsByManager(user.uid);
        // The team doc only carries an id, and the card is built around the
        // competition — so resolve each one. Managers hold few teams.
        const withComps = await Promise.all(
          teams.map(async (team) => ({
            team,
            competition: await getCompetition(team.competitionId).catch(() => null),
          })),
        );
        if (!cancelled) setEntries(withComps);
      } catch (err) {
        console.error("Error loading managed teams:", err);
        if (!cancelled) setEntries([]);
      }
    })();

    // Clubs are the entry ticket: a manager registers a club, not a
    // competition team.
    getTeamsByManager(user.uid)
      .then((c) => {
        if (!cancelled) setClubs(c);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;

  if (entries === null) {
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
          <Trophy size={26} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-black tracking-tight text-gray-900">
            Mes compétitions
          </h1>
          <p className="mt-0.5 text-sm font-bold text-gray-400">
            Les compétitions où tes équipes sont engagées.
          </p>
        </div>
      </div>

      {/* Entering a competition with one of the manager's own clubs. Sits
          above the list because it is how that list gets populated. */}
      <CompetitionRegistrationPanel clubs={clubs} />

      {entries.length === 0 ? (
        <div className="rounded-[2rem] border border-gray-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-300">
            <Mail size={26} />
          </div>
          <p className="mt-4 font-display text-lg font-black text-gray-900">
            Aucune compétition
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-relaxed text-gray-500">
            {clubs.length === 0
              ? "Crée d'abord ton équipe, puis inscris-la à une compétition ouverte."
              : "Inscris une de tes équipes à une compétition ouverte ci-dessus, ou attends l'invitation d'un organisateur."}
          </p>
          <Link
            href={clubs.length === 0 ? "/teams" : "/competitions"}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-600"
          >
            {clubs.length === 0 ? "Créer mon équipe" : "Voir les compétitions"}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(({ team, competition }, i) => {
            const status = competition ? STATUS_LABELS[competition.status] : null;
            return (
              <motion.div
                key={`${team.competitionId}-${team.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link
                  href={`/mon-equipe/${team.competitionId}/${team.id}`}
                  className="block rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-gray-200 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-amber-50">
                      {competition?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={competition.logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Trophy size={20} className="text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-900">
                        {competition?.name ?? "Compétition"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {status && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${status.cls}`}>
                            {status.label}
                          </span>
                        )}
                        {competition && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                            {COMPETITION_TYPE_LABELS[competition.competitionType]}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={16} className="shrink-0 text-gray-300" />
                  </div>

                  {/* The team itself, secondary to the competition */}
                  <div className="mt-3 flex items-center gap-2 border-t border-gray-50 pt-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50">
                      {team.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Users size={13} className="text-gray-300" />
                      )}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-gray-700">
                      {team.name}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-gray-400">
                      {team.players.length} joueur{team.players.length !== 1 ? "s" : ""}
                      {team.group ? ` · Groupe ${team.group}` : ""}
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
