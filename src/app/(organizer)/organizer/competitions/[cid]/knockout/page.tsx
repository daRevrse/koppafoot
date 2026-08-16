"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  GitBranch, ArrowLeft, Loader2, Sparkles, ChevronRight, Pencil, Check, X, Trophy, Goal,
  Users, AlertTriangle, Trash2, PenLine, CalendarClock, MapPin, Save,
} from "lucide-react";
import {
  onCompetition,
  onCompMatches,
  onCompTeams,
  generateKnockout,
  updateCompMatch,
  updateCompetition,
  scheduleCompMatch,
  computeStandings,
  createKnockoutBracket,
  clearKnockoutBracket,
  setBracketSlotSource,
  resolveBracketSlots,
  resolveBracketSlot,
  describeBracketSlotSource,
  bracketSlotSourceKey,
  parseBracketSlotSourceKey,
  KNOCKOUT_BRACKET_SIZES,
  type KnockoutBracketSize,
} from "@/lib/competition-firestore";
import MatchResultModal from "@/components/competition/MatchResultModal";
import type {
  BracketSlotSource, Competition, CompMatch, CompMatchRound, CompTeam,
} from "@/types";
import toast from "react-hot-toast";

// ============================================
// Helpers
// ============================================

// Display order of the bracket rounds. `third_place` is intentionally excluded
// here — it is rendered separately (it isn't part of the elimination tree).
const ROUND_ORDER: CompMatchRound[] = ["round_of_16", "quarter", "semi", "final"];

/** "Quarts, demies, finale" — the rounds a bracket of that size implies. */
function roundsPlanLabel(size: number): string {
  const names: string[] = [];
  for (let teams = size; teams >= 2; teams = teams / 2) {
    names.push(
      teams === 16 ? "8es" : teams === 8 ? "quarts" : teams === 4 ? "demies" : "finale",
    );
  }
  return `${size / 2} match${size / 2 > 1 ? "s" : ""} au 1er tour · ${names.join(", ")}`;
}

const ROUND_LABELS: Record<CompMatchRound, string> = {
  round_of_16: "8es de finale",
  quarter: "Quarts de finale",
  semi: "Demi-finales",
  final: "Finale",
  third_place: "Petite finale",
};

/** "sam. 11 août · 16:00 · Stade X" — empty string when nothing is scheduled. */
function formatSlot(match: CompMatch): string {
  const parts: string[] = [];
  if (match.date) {
    const d = new Date(`${match.date}T00:00`);
    parts.push(
      Number.isNaN(d.getTime())
        ? match.date
        : d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }),
    );
  }
  if (match.time) parts.push(match.time);
  if (match.venueName) parts.push(match.venueName);
  return parts.join(" · ");
}

// A team slot shows the team once one is seated. Until then it shows where the
// place comes from ("1er poule A") when the organizer has drawn it, and falls
// back to "À déterminer" for the rounds that are fed by winners.
function TeamSlot({
  teamId,
  name,
  logo,
  isWinner,
  placeholder,
}: {
  teamId: string | null;
  name: string;
  logo: string | null;
  isWinner: boolean;
  placeholder?: string | null;
}) {
  if (!teamId) {
    return (
      <div className={`flex items-center gap-2.5 ${placeholder ? "text-purple-500" : "text-gray-400"}`}>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed text-xs font-black ${
            placeholder ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"
          }`}
        >
          ?
        </div>
        <span className="truncate text-sm font-medium italic">
          {placeholder ?? "À déterminer"}
        </span>
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

/**
 * Where a first-round slot comes from, as a menu of group positions and
 * repêchage places. Picking a source is what lets the bracket be drawn before
 * the group stage is over — the slot says "1er poule A" until a team earns it.
 */
function SourcePicker({
  groups,
  maxRank,
  groupCount,
  value,
  onChange,
  disabled,
}: {
  groups: string[];
  /** Highest finishing position worth offering — the size of a group. */
  maxRank: number;
  groupCount: number;
  value: BracketSlotSource | null;
  onChange: (source: BracketSlotSource | null) => void;
  disabled: boolean;
}) {
  const ranks = Array.from({ length: Math.max(1, maxRank) }, (_, i) => i + 1);
  // Repêchage only makes sense below first place: a group has exactly one winner,
  // so "best 1st" would just re-pick a team a group slot already covers.
  const repechageRanks = ranks.filter((r) => r >= 2);

  return (
    <select
      value={value ? bracketSlotSourceKey(value) : ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value ? parseBracketSlotSourceKey(e.target.value) : null)}
      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 focus:border-purple-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
    >
      <option value="">— Provenance —</option>
      {groups.map((g) => (
        <optgroup key={g} label={`Poule ${g}`}>
          {ranks.map((rank) => {
            const source: BracketSlotSource = { kind: "group_rank", group: g, rank };
            return (
              <option key={rank} value={bracketSlotSourceKey(source)}>
                {describeBracketSlotSource(source)}
              </option>
            );
          })}
        </optgroup>
      ))}
      {repechageRanks.length > 0 && (
        <optgroup label="Repêchage">
          {repechageRanks.flatMap((rank) =>
            Array.from({ length: groupCount }, (_, i) => {
              const source: BracketSlotSource = { kind: "best_rank", rank, index: i + 1 };
              return (
                <option key={`${rank}-${i}`} value={bracketSlotSourceKey(source)}>
                  {describeBracketSlotSource(source)}
                </option>
              );
            }),
          )}
        </optgroup>
      )}
    </select>
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
  // Match whose result (score + scorers + shootout) is being entered.
  const [resultMatch, setResultMatch] = useState<CompMatch | null>(null);
  // Manual bracket design.
  const [size, setSize] = useState<KnockoutBracketSize>(8);
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [savingSlot, setSavingSlot] = useState<string | null>(null);
  // Date / heure / lieu of one bracket match. A knockout match is scheduled
  // before its two teams are known — the tournament calendar is fixed first,
  // the qualifiers arrive later — so this never waits on a seated team.
  const [scheduleMatch, setScheduleMatch] = useState<CompMatch | null>(null);
  const [slotForm, setSlotForm] = useState({ date: "", time: "", venueName: "", venueCity: "" });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Group matches are kept alongside the knockout ones: the standings they
  // produce are what every slot source resolves against.
  const [groupMatches, setGroupMatches] = useState<CompMatch[]>([]);

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubMatches = onCompMatches(cid, (next) => {
      setMatches(next.filter((m) => m.stage === "knockout"));
      setGroupMatches(next.filter((m) => m.stage === "group"));
      setLoading(false);
    });
    const unsubTeams = onCompTeams(cid, setTeams);
    return () => {
      unsubCompetition();
      unsubMatches();
      unsubTeams();
    };
  }, [cid]);

  // Live projection of every source, so the organizer sees who a slot currently
  // points at while drawing — provisional until the group stage is over.
  const standings = useMemo(
    () => (competition ? computeStandings(groupMatches, teams, competition.format) : []),
    [groupMatches, teams, competition],
  );

  const groupStageDone = useMemo(
    () => groupMatches.length > 0 && groupMatches.every((m) => m.status === "completed"),
    [groupMatches],
  );

  const groupLetters = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) if (t.group) set.add(t.group);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [teams]);

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

  /** Knockout matches that already carry a result — what a redraw would erase. */
  const playedKnockoutCount = useMemo(
    () => matches.filter((m) => m.status === "live" || m.status === "completed").length,
    [matches],
  );

  /** The bracket's opening round — the only one whose slots carry a source. */
  const firstRound = rounds[0]?.round ?? null;

  const firstRoundMatches = useMemo(
    () => (firstRound ? (rounds[0]?.matches ?? []) : []),
    [rounds, firstRound],
  );

  /**
   * What is wrong with the drawing as it stands. These are warnings, not
   * blockers: an organizer mid-draw is allowed an unfinished tree, and an
   * unusual bracket may be exactly what their regulations call for.
   */
  const designWarnings = useMemo(() => {
    if (firstRoundMatches.length === 0) return [];
    const out: string[] = [];

    const seen = new Map<string, number>();
    let empty = 0;
    for (const m of firstRoundMatches) {
      for (const source of [m.homeSource, m.awaySource]) {
        if (!source) {
          empty += 1;
          continue;
        }
        const key = bracketSlotSourceKey(source);
        seen.set(key, (seen.get(key) ?? 0) + 1);
      }
    }

    if (empty > 0) {
      out.push(`${empty} place${empty > 1 ? "s" : ""} sans provenance`);
    }
    const duplicates = [...seen.entries()].filter(([, n]) => n > 1);
    if (duplicates.length > 0) {
      out.push(
        `Provenance utilisée plusieurs fois : ${duplicates
          .map(([key]) => {
            const s = parseBracketSlotSourceKey(key);
            return s ? describeBracketSlotSource(s) : key;
          })
          .join(", ")}`,
      );
    }
    // Two teams out of the same group meeting straight away is the exact
    // mistake the automatic seeding made — worth naming explicitly.
    const sameGroup = firstRoundMatches.filter(
      (m) =>
        m.homeSource?.kind === "group_rank" &&
        m.awaySource?.kind === "group_rank" &&
        m.homeSource.group === m.awaySource.group,
    );
    if (sameGroup.length > 0) {
      out.push(
        `${sameGroup.length} affiche${sameGroup.length > 1 ? "s opposent" : " oppose"} deux équipes de la même poule`,
      );
    }
    return out;
  }, [firstRoundMatches]);

  const handleCreateBracket = async () => {
    setCreating(true);
    try {
      await createKnockoutBracket(cid, size);
      toast.success(`Tableau à ${size} équipes créé — placez les provenances`);
    } catch (err) {
      console.error("Error creating bracket:", err);
      toast.error(err instanceof Error ? err.message : "Impossible de créer le tableau");
    } finally {
      setCreating(false);
    }
  };

  const handleClearBracket = async () => {
    setClearing(true);
    try {
      const removed = await clearKnockoutBracket(cid);
      toast.success(`${removed} match${removed > 1 ? "s" : ""} de phase finale supprimé${removed > 1 ? "s" : ""}`);
      setConfirmClear(false);
    } catch (err) {
      console.error("Error clearing bracket:", err);
      toast.error("Impossible de supprimer le tableau");
    } finally {
      setClearing(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      const seated = await resolveBracketSlots(cid);
      toast.success(
        seated > 0
          ? `${seated} place${seated > 1 ? "s attribuées" : " attribuée"}`
          : "Aucune place à attribuer pour l'instant",
      );
    } catch (err) {
      console.error("Error resolving bracket slots:", err);
      toast.error("Impossible d'attribuer les places");
    } finally {
      setResolving(false);
    }
  };

  const handleSetSource = async (
    match: CompMatch,
    side: "home" | "away",
    source: BracketSlotSource | null,
  ) => {
    const key = `${match.id}:${side}`;
    setSavingSlot(key);
    try {
      await setBracketSlotSource(cid, match.id, side, source);
    } catch (err) {
      console.error("Error setting slot source:", err);
      toast.error("Impossible d'enregistrer la provenance");
    } finally {
      setSavingSlot(null);
    }
  };

  // ── Scheduling ────────────────────────────────────────────
  // A venue clash does not care about the stage: a quarter-final and a group
  // match cannot share a pitch at the same hour, so both are checked.
  const allMatches = useMemo(() => [...groupMatches, ...matches], [groupMatches, matches]);

  /** Slots already booked at that venue, other matches only. */
  const takenSlotsFor = (venue: string, exceptId: string): string[] => {
    const v = venue.trim().toLowerCase();
    if (!v) return [];
    return allMatches
      .filter(
        (m) =>
          m.id !== exceptId &&
          (m.venueName ?? "").trim().toLowerCase() === v &&
          m.date &&
          m.time,
      )
      .map((m) => `${m.date} ${m.time}`)
      .sort((a, b) => a.localeCompare(b));
  };

  /** True when another match already holds this venue + date + time. */
  const hasSlotClash = (m: CompMatch): boolean => {
    const venue = (m.venueName ?? "").trim().toLowerCase();
    if (!venue || !m.date || !m.time) return false;
    return allMatches.some(
      (other) =>
        other.id !== m.id &&
        (other.venueName ?? "").trim().toLowerCase() === venue &&
        (other.date ?? "").trim() === m.date &&
        (other.time ?? "").trim() === m.time,
    );
  };

  const openSchedule = (m: CompMatch) => {
    setScheduleMatch(m);
    setSlotForm({
      date: m.date ?? "",
      time: m.time ?? "",
      venueName: m.venueName ?? "",
      venueCity: m.venueCity ?? "",
    });
  };

  const handleSaveSchedule = async () => {
    if (!scheduleMatch) return;
    const venue = slotForm.venueName.trim().toLowerCase();
    const date = slotForm.date.trim();
    const time = slotForm.time.trim();
    if (venue && date && time) {
      const clash = allMatches.some(
        (m) =>
          m.id !== scheduleMatch.id &&
          (m.venueName ?? "").trim().toLowerCase() === venue &&
          (m.date ?? "").trim() === date &&
          (m.time ?? "").trim() === time,
      );
      if (
        clash &&
        !window.confirm("Ce créneau (stade + date + heure) est déjà pris. Enregistrer quand même ?")
      ) {
        return;
      }
    }

    setSavingSchedule(true);
    try {
      await scheduleCompMatch(cid, scheduleMatch.id, {
        date: slotForm.date,
        time: slotForm.time,
        venueName: slotForm.venueName,
        venueCity: slotForm.venueCity,
      });
      toast.success("Date et lieu enregistrés");
      setScheduleMatch(null);
    } catch (err) {
      console.error("Error scheduling knockout match:", err);
      toast.error("Impossible d'enregistrer la date");
    } finally {
      setSavingSchedule(false);
    }
  };

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

  // One match card: two slots (provenance + team), score/status, live link.
  const renderMatchCard = (match: CompMatch) => {
    const played = match.status === "live" || match.status === "completed";
    // A result can only be entered once both slots hold a real team.
    const canEnterResult =
      match.status !== "cancelled" && !!match.homeTeamId && !!match.awayTeamId;
    const shootout = match.penaltyHome != null && match.penaltyAway != null;
    // Only the opening round is drawn from the group tables; later rounds are
    // fed by the winners flowing up the tree, and the petite finale by hand.
    const sourceable = match.round === firstRound;

    const renderSlot = (side: "home" | "away") => {
      const key = `${match.id}:${side}`;
      const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
      const teamName = side === "home" ? match.homeTeamName : match.awayTeamName;
      const teamLogo = side === "home" ? match.homeTeamLogo : match.awayTeamLogo;
      const source = side === "home" ? match.homeSource : match.awaySource;
      const score = side === "home" ? match.scoreHome : match.scoreAway;
      const penalty = side === "home" ? match.penaltyHome : match.penaltyAway;
      // Who the source points at right now — provisional until the tables are
      // final, and only shown while no team has actually been seated.
      const projected = source && !teamId ? resolveBracketSlot(source, standings) : null;

      return (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {editing === key ? (
                <SlotEditor
                  teams={teams}
                  onPick={(t) => handlePickTeam(match, side, t)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <TeamSlot
                  teamId={teamId}
                  name={teamName}
                  logo={teamLogo}
                  isWinner={match.status === "completed" && match.winnerTeamId === teamId}
                  placeholder={source ? describeBracketSlotSource(source) : null}
                />
              )}
            </div>
            {editing !== key && (
              <>
                {played && (
                  <span className="flex items-baseline gap-1">
                    <span className="text-base font-black tabular-nums text-gray-900">
                      {score ?? 0}
                    </span>
                    {shootout && (
                      <span className="text-[10px] font-bold tabular-nums text-amber-600">
                        ({penalty} tab)
                      </span>
                    )}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(key)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 transition-colors hover:bg-gray-50 hover:text-purple-600"
                  title="Placer une équipe à la main"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>

          {sourceable && editing !== key && (
            <div className="mt-2 flex items-center gap-2">
              <SourcePicker
                groups={groupLetters}
                maxRank={competition?.format.teams_per_group ?? 4}
                groupCount={groupLetters.length || (competition?.format.group_count ?? 0)}
                value={source}
                onChange={(next) => handleSetSource(match, side, next)}
                disabled={played || savingSlot === key}
              />
              {savingSlot === key && <Loader2 size={13} className="animate-spin text-gray-300" />}
            </div>
          )}
          {projected && (
            <p className="mt-1.5 pl-0.5 text-[11px] text-gray-400">
              Actuellement : <span className="font-semibold text-gray-500">{projected.name}</span>
              {!groupStageDone && " (provisoire)"}
            </p>
          )}
        </div>
      );
    };

    return (
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        {/* Slots */}
        <div className="divide-y divide-gray-50">
          {renderSlot("home")}
          {renderSlot("away")}
        </div>

        {/* Date, heure, lieu — settable before the two teams are known */}
        {(() => {
          const slot = formatSlot(match);
          const clash = hasSlotClash(match);
          return (
            <button
              type="button"
              onClick={() => openSchedule(match)}
              className={`group flex w-full items-center gap-2 border-t px-4 py-2 text-left transition-colors ${
                clash
                  ? "border-amber-100 bg-amber-50/60 hover:bg-amber-50"
                  : "border-gray-50 hover:bg-gray-50/70"
              }`}
            >
              <CalendarClock
                size={13}
                className={`shrink-0 ${clash ? "text-amber-500" : slot ? "text-purple-500" : "text-gray-300"}`}
              />
              <span
                className={`min-w-0 flex-1 truncate text-xs ${
                  slot ? "font-semibold text-gray-600" : "font-medium italic text-gray-400"
                }`}
              >
                {slot || "Aucune date"}
                {match.venueCity && <span className="font-normal text-gray-400"> ({match.venueCity})</span>}
              </span>
              {clash && (
                <span
                  title="Créneau déjà pris (stade + date + heure)"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700"
                >
                  <AlertTriangle size={10} />
                  Conflit
                </span>
              )}
              <Pencil
                size={11}
                className="shrink-0 text-gray-300 transition-colors group-hover:text-purple-600"
              />
            </button>
          );
        })()}

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
          <div className="flex shrink-0 items-center gap-1">
            {/* Result entered after the fact — for a match the live console
                never ran, and to correct one it did. */}
            {canEnterResult && (
              <button
                type="button"
                onClick={() => setResultMatch(match)}
                className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-50"
              >
                <Goal size={14} />
                {match.status === "completed" ? "Score & buteurs" : "Ajouter score"}
              </button>
            )}
            <Link
              href={`/organizer/competitions/${cid}/matches/${match.id}/live`}
              target="_blank"
              rel="noopener"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-purple-600 transition-colors hover:bg-purple-50"
            >
              Console live
              <ChevronRight size={14} />
            </Link>
          </div>
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
        {hasKnockout && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleResolve}
              disabled={resolving}
              title={
                groupStageDone
                  ? "Placer les équipes selon les classements"
                  : "Les poules ne sont pas terminées — le placement sera provisoire"
              }
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resolving ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
              Attribuer les places
            </button>
            {canSetKnockout && (
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
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Trash2 size={16} />
              Redessiner
            </button>
          </div>
        )}
      </div>

      {/* What is wrong with the drawing as it stands */}
      {hasKnockout && designWarnings.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="text-sm text-amber-800">
            <p className="font-bold">À vérifier avant de lancer la phase finale</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-700">
              {designWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

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
          <p className="mt-1 max-w-md text-sm text-gray-500">
            Choisissez la taille du tableau : l&apos;arbre est créé vide, et vous décidez
            vous-même d&apos;où vient chaque place — «&nbsp;1<sup>er</sup> poule A&nbsp;»,
            «&nbsp;2<sup>e</sup> meilleur 3<sup>e</sup>&nbsp;». Pas besoin d&apos;attendre la fin
            des poules.
          </p>

          <div className="mt-6 flex items-center gap-2">
            {KNOCKOUT_BRACKET_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  size === s
                    ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s} équipes
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">{roundsPlanLabel(size)}</p>

          <button
            type="button"
            onClick={handleCreateBracket}
            disabled={creating}
            className="mt-5 flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <PenLine size={16} />}
            Dessiner le tableau
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="mt-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            ou générer automatiquement
          </button>
          <p className="mt-2 max-w-sm text-[11px] text-gray-400">
            La génération automatique ne place proprement les qualifiés que si le nombre de
            poules divise le tableau. Avec 5 poules, elle coupe deux qualifiés au hasard.
          </p>
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

      {/* Redraw confirmation — this throws away played results, so it says so */}
      {confirmClear && (
        <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md modal-sheet rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-gray-900">Redessiner le tableau</h2>
              <button
                onClick={() => !clearing && setConfirmClear(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle size={16} />
                {matches.length} match{matches.length > 1 ? "s" : ""} de phase finale seront supprimés
              </p>
              {playedKnockoutCount > 0 && (
                <p className="mt-1.5 font-semibold">
                  Dont {playedKnockoutCount} déjà joué{playedKnockoutCount > 1 ? "s" : ""} : leurs
                  scores, buteurs et compositions seront perdus.
                </p>
              )}
              <p className="mt-1.5 text-red-600">Cette action est irréversible.</p>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !clearing && setConfirmClear(false)}
                className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleClearBracket}
                disabled={clearing}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-red-200 transition-all hover:bg-red-700 disabled:opacity-50"
              >
                {clearing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Supprimer le tableau
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Date / heure / lieu of one bracket match */}
      {scheduleMatch && (() => {
        const sideLabel = (side: "home" | "away") => {
          const name = side === "home" ? scheduleMatch.homeTeamName : scheduleMatch.awayTeamName;
          if (name) return name;
          const source = side === "home" ? scheduleMatch.homeSource : scheduleMatch.awaySource;
          return source ? describeBracketSlotSource(source) : "À déterminer";
        };
        const taken = takenSlotsFor(slotForm.venueName, scheduleMatch.id).filter(
          (s) => s !== `${slotForm.date.trim()} ${slotForm.time.trim()}`,
        );
        return (
          <div className="fixed inset-0 modal-layer flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md modal-sheet rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
            >
              <div className="mb-1 flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-gray-900">Date et lieu</h2>
                <button
                  onClick={() => !savingSchedule && setScheduleMatch(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
                >
                  <X size={18} />
                </button>
              </div>
              <p className="mb-5 text-xs text-gray-400">
                {scheduleMatch.round ? `${ROUND_LABELS[scheduleMatch.round]} · ` : ""}
                {sideLabel("home")} vs {sideLabel("away")}
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
                    <input
                      type="date"
                      value={slotForm.date}
                      onChange={(e) => setSlotForm((p) => ({ ...p, date: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Heure</label>
                    <input
                      type="time"
                      value={slotForm.time}
                      onChange={(e) => setSlotForm((p) => ({ ...p, time: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Stade</label>
                  <input
                    type="text"
                    placeholder="Nom du stade"
                    value={slotForm.venueName}
                    onChange={(e) => setSlotForm((p) => ({ ...p, venueName: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  />
                  {taken.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      <span className="font-semibold text-gray-500">Créneaux déjà pris :</span>{" "}
                      {taken.slice(0, 6).join(" · ")}
                      {taken.length > 6 ? " …" : ""}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-700">
                    <MapPin size={13} />
                    Ville
                  </label>
                  <input
                    type="text"
                    placeholder="Lomé"
                    value={slotForm.venueCity}
                    onChange={(e) => setSlotForm((p) => ({ ...p, venueCity: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => !savingSchedule && setScheduleMatch(null)}
                  className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={savingSchedule}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-200 transition-all hover:bg-purple-700 disabled:opacity-50"
                >
                  {savingSchedule ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Enregistrer
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

      {/* Score + scorers modal — shared with the calendar */}
      <MatchResultModal
        cid={cid}
        match={resultMatch}
        teams={teams}
        competition={competition}
        onClose={() => setResultMatch(null)}
      />
    </div>
  );
}
