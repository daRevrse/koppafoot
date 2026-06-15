"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  GitBranch, ArrowLeft, Loader2, Sparkles, ChevronRight, Pencil, Check, X, Trophy,
} from "lucide-react";
import {
  onCompetition,
  onCompMatches,
  onCompTeams,
  generateKnockout,
  updateCompMatch,
  updateCompetition,
} from "@/lib/competition-firestore";
import type { Competition, CompMatch, CompMatchRound, CompTeam } from "@/types";
import toast from "react-hot-toast";

// ============================================
// Helpers
// ============================================

// Display order of the bracket rounds. `third_place` is intentionally excluded
// here — it is rendered separately (it isn't part of the elimination tree).
const ROUND_ORDER: CompMatchRound[] = ["round_of_16", "quarter", "semi", "final"];

const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quarts de finale",
  semi: "Demi-finales",
  final: "Finale",
  third_place: "Petite finale",
};

// A team slot is "À déterminer" until the bracket feeds (or the organizer
// seeds) a team id into it.
function TeamSlot({
  teamId,
  name,
  logo,
  isWinner,
}: {
  teamId: string | null;
  name: string;
  logo: string | null;
  isWinner: boolean;
}) {
  if (!teamId) {
    return (
      <div className="flex items-center gap-2.5 text-gray-400">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs font-black">
          ?
        </div>
        <span className="truncate text-sm font-medium italic">À déterminer</span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-2.5 ${isWinner ? "text-gray-900" : "text-gray-700"}`}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 text-xs font-black text-gray-500">
        {logo ? (
          <Image src={logo} alt={name} width={32} height={32} className="h-full w-full object-cover" />
        ) : (
          <span>{name?.[0]?.toUpperCase() || "?"}</span>
        )}
      </div>
      <span className={`truncate text-sm ${isWinner ? "font-black" : "font-bold"}`}>{name}</span>
      {isWinner && <Trophy size={13} className="shrink-0 text-amber-500" />}
    </div>
  );
}

// Inline picker over the competition teams for one slot (home/away) of a match.
// Writes the denormalized trio (id + name + logo) so the bracket and downstream
// views stay consistent; logo is coerced to null (never undefined).
function SlotEditor({
  teams,
  onPick,
  onCancel,
}: {
  teams: CompTeam[];
  onPick: (team: CompTeam) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-purple-500 focus:outline-none"
      >
        <option value="">Choisir une équipe…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => {
          const team = teams.find((t) => t.id === value);
          if (team) onPick(team);
        }}
        disabled={!value}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
        title="Valider"
      >
        <Check size={15} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:bg-gray-50"
        title="Annuler"
      >
        <X size={15} />
      </button>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function CompetitionKnockoutPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<CompMatch[]>([]);
  const [teams, setTeams] = useState<CompTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [settingStatus, setSettingStatus] = useState(false);
  // Which slot is currently open in the inline editor: `${matchId}:${side}`.
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubMatches = onCompMatches(cid, (next) => {
      setMatches(next.filter((m) => m.stage === "knockout"));
      setLoading(false);
    });
    const unsubTeams = onCompTeams(cid, setTeams);
    return () => {
      unsubCompetition();
      unsubMatches();
      unsubTeams();
    };
  }, [cid]);

  // Bracket rounds in display order; `third_place` pulled out separately.
  const rounds = useMemo(() => {
    return ROUND_ORDER.map((round) => ({
      round,
      matches: matches
        .filter((m) => m.round === round)
        .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0)),
    })).filter((r) => r.matches.length > 0);
  }, [matches]);

  const thirdPlace = useMemo(
    () => matches.find((m) => m.round === "third_place") ?? null,
    [matches],
  );

  const hasKnockout = matches.length > 0;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateKnockout(cid);
      toast.success("Phase finale générée");
    } catch (err) {
      // Surface the thrown message verbatim (e.g. "Pas assez de qualifiés…").
      const message = err instanceof Error ? err.message : "La génération a échoué";
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSetKnockoutStatus = async () => {
    setSettingStatus(true);
    try {
      await updateCompetition(cid, { status: "knockout" });
      toast.success("Compétition en phase finale");
    } catch (err) {
      console.error("Error updating competition status:", err);
      toast.error("Impossible de mettre à jour le statut");
    } finally {
      setSettingStatus(false);
    }
  };

  // Write the denormalized trio for one slot, then close the editor.
  const handlePickTeam = async (match: CompMatch, side: "home" | "away", team: CompTeam) => {
    try {
      await updateCompMatch(
        cid,
        match.id,
        side === "home"
          ? {
              home_team_id: team.id,
              home_team_name: team.name,
              home_team_logo: team.logoUrl ?? null,
            }
          : {
              away_team_id: team.id,
              away_team_name: team.name,
              away_team_logo: team.logoUrl ?? null,
            },
      );
      toast.success("Équipe mise à jour");
    } catch (err) {
      console.error("Error updating match slot:", err);
      toast.error("Impossible de mettre à jour l'équipe");
    } finally {
      setEditing(null);
    }
  };

  // One match card: two editable slots, score/status when played, live link.
  const renderMatchCard = (match: CompMatch) => {
    const homeKey = `${match.id}:home`;
    const awayKey = `${match.id}:away`;
    const played = match.status === "live" || match.status === "completed";
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Slots */}
        <div className="divide-y divide-gray-50">
          {/* Home slot */}
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              {editing === homeKey ? (
                <SlotEditor
                  teams={teams}
                  onPick={(t) => handlePickTeam(match, "home", t)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <TeamSlot
                  teamId={match.homeTeamId}
                  name={match.homeTeamName}
                  logo={match.homeTeamLogo}
                  isWinner={match.status === "completed" && match.winnerTeamId === match.homeTeamId}
                />
              )}
            </div>
            {editing !== homeKey && (
              <>
                {played && (
                  <span className="text-base font-black tabular-nums text-gray-900">
                    {match.scoreHome ?? 0}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(homeKey)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-50 hover:text-purple-600"
                  title="Modifier l'équipe"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>

          {/* Away slot */}
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="min-w-0 flex-1">
              {editing === awayKey ? (
                <SlotEditor
                  teams={teams}
                  onPick={(t) => handlePickTeam(match, "away", t)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <TeamSlot
                  teamId={match.awayTeamId}
                  name={match.awayTeamName}
                  logo={match.awayTeamLogo}
                  isWinner={match.status === "completed" && match.winnerTeamId === match.awayTeamId}
                />
              )}
            </div>
            {editing !== awayKey && (
              <>
                {played && (
                  <span className="text-base font-black tabular-nums text-gray-900">
                    {match.scoreAway ?? 0}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(awayKey)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-50 hover:text-purple-600"
                  title="Modifier l'équipe"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer: status + live console link */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-50 bg-gray-50/60 px-4 py-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
            {match.status === "live" ? (
              <span className="inline-flex items-center gap-1.5 text-red-600">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                En direct
              </span>
            ) : match.status === "completed" ? (
              "Terminé"
            ) : match.status === "cancelled" ? (
              "Annulé"
            ) : (
              "À venir"
            )}
          </span>
          <Link
            href={`/organizer/competitions/${cid}/matches/${match.id}/live`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-50"
          >
            Console live
            <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    );
  };

  const canSetKnockout =
    competition != null &&
    competition.status !== "knockout" &&
    competition.status !== "completed";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-purple-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-2xl font-extrabold text-gray-900"
          >
            Phase finale
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="mt-0.5 text-sm text-gray-500"
          >
            {competition?.name ?? "Compétition"} · Tableau à élimination directe
          </motion.p>
        </div>
        {hasKnockout && canSetKnockout && (
          <button
            type="button"
            onClick={handleSetKnockoutStatus}
            disabled={settingStatus}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settingStatus ? <Loader2 size={16} className="animate-spin" /> : <GitBranch size={16} />}
            Passer en phase finale
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-gray-300" />
        </div>
      ) : !hasKnockout ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
            <GitBranch size={26} className="text-purple-500" />
          </div>
          <p className="mt-4 text-base font-bold text-gray-900">Pas encore de phase finale</p>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Saisissez d&apos;abord les résultats des matchs de poule, puis générez le tableau :
            les qualifiés seront placés automatiquement.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="mt-6 flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Générer la phase finale
          </button>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {rounds.map((r, ri) => (
            <motion.section
              key={r.round}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ri * 0.04 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <GitBranch size={15} />
                </span>
                <h2 className="text-sm font-bold text-gray-900">{ROUND_LABELS[r.round]}</h2>
                <span className="ml-auto text-xs font-medium text-gray-400">
                  {r.matches.length} match{r.matches.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {r.matches.map((match) => (
                  <div key={match.id}>{renderMatchCard(match)}</div>
                ))}
              </div>
            </motion.section>
          ))}

          {/* Third-place match: rendered separately, not part of the tree. */}
          {thirdPlace && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: rounds.length * 0.04 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 px-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                  <Trophy size={15} />
                </span>
                <h2 className="text-sm font-bold text-gray-900">{ROUND_LABELS.third_place}</h2>
                <span className="ml-auto text-xs font-medium text-gray-400">
                  À renseigner manuellement
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>{renderMatchCard(thirdPlace)}</div>
              </div>
            </motion.section>
          )}
        </div>
      )}
    </div>
  );
}
