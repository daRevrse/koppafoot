"use client";

import { motion } from "motion/react";
import {
  History, Loader2, Goal, ArrowRightLeft, AlertTriangle, MonitorPlay, Ban, Check, Hand, Flag,
  Target, Trash2,
} from "lucide-react";
import {
  LIBELLE_EVENEMENT, PENALTY_FOUL_DETAIL, PENALTY_GOAL_DETAIL, RECIT_ISSUE_PENALTY, issuePenalty,
} from "@/lib/evenements";
import { libelleMinute } from "@/lib/minute-du-match";
import type { CompMatch, GoalVarStatus } from "@/types";
import type { LiveEvent } from "./types";

/**
 * L'historique du match, sur le fond sombre de la console.
 *
 * IL ÉTAIT BLANC, posé sur une console noire : un panneau d'une autre
 * application, qui recouvrait les terrains. Il suit maintenant l'écran où il
 * s'ouvre.
 *
 * IL NOMME LE PASSEUR. Il nommait la victime d'une faute, pas l'auteur de la
 * passe d'un but : le scoreur ne pouvait pas vérifier qu'il l'avait bien posé.
 *
 * ET IL CORRIGE. Chaque ligne a sa corbeille tant que le match tourne : voir
 * `retirerEvenement` et lib/retrait-evenement.
 */
export function EventTimeline({
  events,
  homeTeamId,
  homeTeamName,
  awayTeamName,
  onVarVerdict,
  varPendingId,
  onRetirer,
  compact = false,
  dureeMiTemps,
}: {
  events: NonNullable<CompMatch["liveState"]>["events"];
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  /** Omitted on a finished match: the feed is then read-only. */
  onVarVerdict?: (event: LiveEvent, status: GoalVarStatus) => void;
  varPendingId?: string | null;
  /** Retirer une ligne. Absent sur un match terminé, qui ne se corrige plus ici. */
  onRetirer?: (event: LiveEvent) => void;
  /** Plus serré, pour le panneau posé sous les terrains sur grand écran. */
  compact?: boolean;
  /** La durée d'une mi-temps du format, pour écrire « 45+2' ». */
  dureeMiTemps: number;
}) {
  if (events.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-6" : "py-14"}`}>
        <History size={compact ? 20 : 28} className="mb-3 text-white/15" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">
          Aucun événement pour l&apos;instant
        </p>
      </div>
    );
  }

  // The VAR is called on the goal that just happened, and play is stopped
  // while it runs, so no other goal can come in and push the review down the
  // feed. The controls therefore hang off the last goal alone, and disappear
  // once it has been ruled on: a verdict is final.
  const lastGoalId = [...events].reverse().find((e) => e.type === "goal")?.id ?? null;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {[...events].reverse().map((event) => {
        const isHome = event.teamId === homeTeamId;
        const isSub = event.type === "substitution";
        const isGoal = event.type === "goal";
        const checking = isGoal && event.varStatus === "checking";
        const issue = event.type === "penalty" ? issuePenalty(event.detail) : null;
        // Un penalty retiré se barre comme un but refusé, et pour la même
        // raison : le stade l'a vu accorder, et le fil doit expliquer
        // pourquoi il ne s'est rien passé ensuite.
        const cancelled = (isGoal && event.varStatus === "cancelled") || issue === "retire";
        const confirmed = isGoal && event.varStatus === "confirmed";
        const varBusy = varPendingId === event.id;
        const reviewable =
          isGoal && !!onVarVerdict && event.id === lastGoalId && !confirmed && !cancelled;
        const titre = isGoal
          ? event.detail === PENALTY_GOAL_DETAIL ? "But sur penalty" : "But"
          : issue
            ? RECIT_ISSUE_PENALTY[issue]
            : event.type === "foul" && event.detail === PENALTY_FOUL_DETAIL
              ? "Faute · penalty"
              : LIBELLE_EVENEMENT[event.type];
        return (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div
              // `min-w` : « 45+2' » déborde d'un carré.
              className={`flex shrink-0 items-center justify-center whitespace-nowrap border px-0.5 text-xs font-black tabular-nums ${
                compact ? "h-8 min-w-8" : "h-10 min-w-10"
              } ${
                cancelled
                  ? "border-white/10 text-white/25"
                  : checking
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                    : "border-white/10 bg-white/5 text-white/70"
              }`}
            >
              {/* 0 = minute unknown (goal entered after the fact, off-clock). */}
              {event.minute ? libelleMinute(event.period, event.minute, dureeMiTemps) : "–"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {isGoal && <Goal size={15} className={cancelled ? "text-white/25" : "text-amber-400"} />}
                {event.type === "yellow_card" && <span className="h-4 w-3 bg-amber-400" />}
                {event.type === "red_card" && <span className="h-4 w-3 bg-red-600" />}
                {isSub && <ArrowRightLeft size={15} className="text-sky-400" />}
                {event.type === "save" && <Hand size={15} className="text-emerald-400" />}
                {event.type === "foul" && <AlertTriangle size={15} className="text-orange-400" />}
                {event.type === "offside" && <Flag size={15} className="text-white/45" />}
                {event.type === "penalty" && (
                  <Target size={15} className={cancelled ? "text-white/25" : "text-amber-400"} />
                )}
                <span
                  className={`text-[13px] font-black uppercase tracking-tight ${
                    cancelled ? "text-white/35 line-through" : "text-white"
                  }`}
                >
                  {titre}
                </span>

                {/* Un penalty accordé et rien de plus : le scoreur n'a pas
                    encore dit ce qu'il est devenu, et cela se voit ici comme
                    dans le bandeau. */}
                {event.type === "penalty" && !issue && (
                  <span className="inline-flex items-center gap-1 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    En attente
                  </span>
                )}
                {checking && (
                  <span className="inline-flex items-center gap-1 bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                    VAR en cours
                  </span>
                )}
                {cancelled && (
                  <span className="inline-flex items-center gap-1 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-red-300">
                    <Ban size={10} />
                    {/* « Retiré » tout court : la VAR n'existe pas sur un
                        amical, et ce fil est le meme des deux cotes. C'est le
                        bouton qui l'a retiré qui la nomme, là où elle existe. */}
                    {issue === "retire" ? "Retiré" : "But refusé"}
                  </span>
                )}
                {confirmed && (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    <Check size={10} />
                    Accordé VAR
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-tight text-white/45">
                {isSub && event.detail ? (
                  <span className="text-sky-300">{event.detail}</span>
                ) : (
                  <>
                    {event.playerName ? `${event.playerName} • ` : ""}
                    {/* Le passeur, que le scoreur vient de poser : c'est ici
                        qu'il vérifie qu'il l'a bien fait. */}
                    {isGoal && event.assistPlayerName ? `passe de ${event.assistPlayerName} • ` : ""}
                    {isHome ? homeTeamName : awayTeamName}
                    {/* Une faute a deux acteurs : la nommer sans sa victime
                        n'apprend que la moitié de ce qui s'est passé. */}
                    {event.type === "foul" && event.victimPlayerName
                      ? ` • sur ${event.victimPlayerName}`
                      : ""}
                  </>
                )}
              </p>

              {/* VAR controls, last goal only, while the match is running */}
              {reviewable && onVarVerdict && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {varBusy && <Loader2 size={13} className="animate-spin text-white/40" />}
                  {!checking && (
                    <button
                      type="button"
                      disabled={varBusy}
                      onClick={() => onVarVerdict(event, "checking")}
                      className="inline-flex items-center gap-1 border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[11px] font-bold text-amber-200 transition-colors hover:bg-amber-400/20 disabled:opacity-50"
                    >
                      <MonitorPlay size={12} />
                      Vérifier (VAR)
                    </button>
                  )}
                  {checking && (
                    <button
                      type="button"
                      disabled={varBusy}
                      onClick={() => onVarVerdict(event, "confirmed")}
                      className="inline-flex items-center gap-1 border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-400/20 disabled:opacity-50"
                    >
                      <Check size={12} />
                      But accordé
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={varBusy}
                    onClick={() => onVarVerdict(event, "cancelled")}
                    className="inline-flex items-center gap-1 border border-red-400/30 bg-red-400/10 px-2 py-1 text-[11px] font-bold text-red-200 transition-colors hover:bg-red-400/20 disabled:opacity-50"
                  >
                    <Ban size={12} />
                    Refuser le but
                  </button>
                </div>
              )}
            </div>

            {/* LA CORBEILLE, VISIBLE SANS SURVOL : un téléphone n'en a pas.
                Elle demande confirmation, parce qu'un retrait peut défaire
                une exclusion ou un changement. */}
            {onRetirer && (
              <button
                type="button"
                onClick={() => onRetirer(event)}
                aria-label={`Retirer : ${titre}${event.playerName ? `, ${event.playerName}` : ""}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center text-white/30 transition-colors hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 size={15} />
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
