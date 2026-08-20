"use client";

import Link from "next/link";
import { Check, ChevronRight, Users, LayoutGrid, Calendar, GitBranch, ShieldCheck, type LucideIcon } from "lucide-react";
import { hasGroupStage, hasKnockout, isSingleGroup } from "@/lib/competition-format";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// OrganizerProgress, the competition hub as a sequence instead of a wall.
//
// The hub used to show the same five cards side by side, all the same size,
// in a fixed order that said nothing: Équipes, Poules, Calendrier, Phase
// finale, Staff. But that IS an order, you cannot compose poules without
// teams, or draw a bracket before the groups have played. A first-time
// organizer had no way to see it, and no way to tell what was already done.
//
// Every state here is derived from the real documents, never stored: the day
// a team is added or a fixture is dated, the step ticks itself.
// ============================================

interface Step {
  label: string;
  href: string;
  Icon: LucideIcon;
  done: boolean;
  /** What the organizer has actually got so far. */
  hint: string;
  /** Skippable, the competition runs without it. */
  optional?: boolean;
}

export default function OrganizerProgress({
  competition, teams, matches, loading,
}: {
  competition: Competition;
  teams: CompTeam[];
  matches: CompMatch[];
  loading: boolean;
}) {
  const cid = competition.id;
  const type = competition.competitionType;
  const base = `/organizer/competitions/${cid}`;

  const dated = matches.filter((m) => m.date != null).length;
  const knockoutDrawn = matches.some((m) => m.stage === "knockout");
  const grouped = teams.length > 0 && teams.every((t) => t.group != null);
  const moderators = competition.moderatorIds.length;

  // Each type only exposes the stages it actually plays: a cup has no poules,
  // a championnat has no bracket, and a single-group competition composes
  // itself so its "Poules" step would be an empty formality.
  const steps: Step[] = [
    {
      label: "Équipes",
      href: `${base}/teams`,
      Icon: Users,
      done: teams.length >= 2,
      hint: teams.length === 0
        ? "Aucune équipe pour l'instant"
        : `${teams.length} équipe${teams.length > 1 ? "s" : ""} inscrite${teams.length > 1 ? "s" : ""}`,
    },
    ...(hasGroupStage(type) && !isSingleGroup(type)
      ? [{
          label: "Poules",
          href: `${base}/groups`,
          Icon: LayoutGrid,
          done: grouped,
          hint: teams.length === 0
            ? "Ajoute des équipes d'abord"
            : grouped
              ? "Toutes les équipes ont une poule"
              : `${teams.filter((t) => t.group == null).length} équipe(s) sans poule`,
        }]
      : []),
    {
      label: "Calendrier",
      href: `${base}/schedule`,
      Icon: Calendar,
      done: dated > 0,
      hint: dated > 0
        ? `${dated} match${dated > 1 ? "s" : ""} programmé${dated > 1 ? "s" : ""}`
        : "Aucune rencontre datée",
    },
    ...(hasKnockout(type)
      ? [{
          label: type === "league_playoffs" ? "Play-offs" : "Phase finale",
          href: `${base}/knockout`,
          Icon: GitBranch,
          done: knockoutDrawn,
          hint: knockoutDrawn ? "Tableau généré" : "Tableau pas encore tiré",
        }]
      : []),
    {
      label: "Staff",
      href: `${base}/staff`,
      Icon: ShieldCheck,
      done: moderators > 0,
      optional: true,
      hint: moderators > 0
        ? `${moderators} modérateur${moderators > 1 ? "s" : ""} live`
        : "Personne pour saisir les matchs en direct",
    },
  ];

  // The next thing to do is the first required step still open. Optional ones
  // never claim the spotlight, they would keep the competition looking
  // unfinished forever.
  const currentIndex = steps.findIndex((s) => !s.done && !s.optional);
  const requiredDone = steps.filter((s) => !s.optional && s.done).length;
  const requiredTotal = steps.filter((s) => !s.optional).length;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-gray-50 px-5 py-3.5">
        <p className="text-sm font-bold text-gray-900">Mise en place</p>
        <span className="shrink-0 text-xs font-bold text-gray-400 tabular-nums">
          {loading ? "…" : `${requiredDone}/${requiredTotal} étapes`}
        </span>
      </div>

      <div className="p-2">
        {steps.map((step, i) => {
          const current = i === currentIndex;
          const last = i === steps.length - 1;

          return (
            <Link
              key={step.href}
              href={step.href}
              className="group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50"
            >
              {/* Rail joining the markers, so the list reads as one path. */}
              {!last && (
                <span
                  aria-hidden
                  className={`absolute left-[27px] top-[42px] h-[calc(100%-26px)] w-px ${
                    step.done ? "bg-emerald-200" : "bg-gray-100"
                  }`}
                />
              )}

              <span
                className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  step.done
                    ? "bg-emerald-500 text-white"
                    : current
                      ? "bg-white text-emerald-600 ring-2 ring-emerald-500"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                {step.done ? <Check size={15} /> : i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${step.done ? "text-gray-900" : current ? "text-gray-900" : "text-gray-500"}`}>
                    {step.label}
                  </span>
                  {current && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-600">
                      À faire
                    </span>
                  )}
                  {step.optional && !step.done && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-400">
                      Facultatif
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs text-gray-500">
                  {loading ? "Chargement…" : step.hint}
                </span>
              </span>

              <step.Icon size={16} className="hidden shrink-0 text-gray-300 sm:block" />
              <ChevronRight
                size={16}
                className="shrink-0 text-gray-300 transition-colors group-hover:text-gray-500"
              />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
