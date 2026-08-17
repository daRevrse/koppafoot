import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import type { Team } from "@/types";

// Directory tile for a Koppafoot team. Deliberately shorter than the
// competition tiles — a team is a smaller thing than a competition, and the
// grid reads better when it says so.
//
// Logos are user-uploaded arbitrary URLs → plain <img>, as elsewhere.

const LEVEL_LABELS: Record<Team["level"], string> = {
  beginner: "Débutant",
  amateur: "Amateur",
  intermediate: "Intermédiaire",
  advanced: "Confirmé",
};

export default function TeamDirectoryCard({ team }: { team: Team }) {
  return (
    <Link
      href={`/teams/${team.id}`}
      className="group flex items-center gap-3 rounded-[1.5rem] border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-emerald-200 hover:shadow-lg"
    >
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logoUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-2xl object-cover"
        />
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 font-display text-base font-black text-emerald-600">
          {team.name.slice(0, 2).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-display text-sm font-black tracking-tight text-gray-900">
            {team.name}
          </h3>
          {team.isRecruiting && (
            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-600">
              Recrute
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-bold text-gray-400">
          {team.city && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="shrink-0 text-gray-300" />
              <span className="truncate">{team.city}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users size={11} className="shrink-0 text-gray-300" />
            {team.memberIds.length} joueur{team.memberIds.length > 1 ? "s" : ""}
          </span>
          <span className="truncate">{LEVEL_LABELS[team.level]}</span>
        </div>
      </div>
    </Link>
  );
}
