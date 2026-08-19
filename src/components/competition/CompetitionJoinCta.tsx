"use client";

import { UserPlus, Eye } from "lucide-react";
import RegisterTeamButton from "./RegisterTeamButton";
import FollowCompetitionButton from "./FollowCompetitionButton";
import type { Competition } from "@/types";

// ============================================
// CompetitionJoinCta — the ask, on the join page.
//
// Two audiences land on the same link: a club president who could enter a
// team, and a supporter who just wants the scores. Registration leads while
// it is open, because that is the one the organizer sent the link for; the
// follow button stays reachable either way, and takes over entirely once
// entries close, so a late visitor is never met with a dead end.
// ============================================

export default function CompetitionJoinCta({ competition }: { competition: Competition }) {
  const open = competition.status === "registration";

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      {open ? (
        <>
          <p className="flex items-center gap-2 font-display text-base font-black text-gray-900">
            <UserPlus size={17} className="text-emerald-500" />
            Inscris ton équipe
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Il te faut un compte KoppaFoot et une équipe. Les deux se créent en
            deux minutes, et l&apos;organisateur valide ensuite ton inscription.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <RegisterTeamButton
              competition={competition}
              className="w-full justify-center rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-700 sm:w-auto"
            />
            <FollowCompetitionButton cid={competition.id} />
          </div>
        </>
      ) : (
        <>
          <p className="flex items-center gap-2 font-display text-base font-black text-gray-900">
            <Eye size={17} className="text-emerald-500" />
            Suis la compétition
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Les inscriptions sont closes. Active le suivi pour recevoir les
            coups d&apos;envoi, les buts et les résultats sur ton téléphone.
          </p>
          <div className="mt-4">
            <FollowCompetitionButton cid={competition.id} />
          </div>
        </>
      )}
    </div>
  );
}
