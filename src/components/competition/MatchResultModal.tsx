"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, X, Trophy, Goal } from "lucide-react";
import {
  setCompMatchResult,
  ensureCompPlayers,
  rosterNameKey,
  OWN_GOAL_DETAIL,
  type ResultGoal,
} from "@/lib/competition-firestore";
import type { CompMatch, CompPlayer, CompTeam } from "@/types";
import toast from "react-hot-toast";

/** Sentinel option of the scorer picker: "this name is not on the roster yet". */
const NEW_PLAYER = "__new__";

/**
 * Ceiling on the scorer lines a score can unfold. A typo (a stray "99") should
 * not render a hundred selects; the real scores stay far below.
 */
const MAX_GOAL_LINES = 20;

/** One scorer line of the result form — one line per goal typed. */
interface GoalRow {
  /** "" = unknown scorer, NEW_PLAYER = create from `newName`, else a roster id. */
  playerId: string;
  newName: string;
  /** Free text so the field can stay empty (minute is optional). */
  minute: string;
  ownGoal: boolean;
}

const emptyGoalRow = (): GoalRow => ({ playerId: "", newName: "", minute: "", ownGoal: false });

/** Fit the scorer lines to a score, keeping what the organizer already typed. */
function resizeGoalRows(rows: GoalRow[], score: number): GoalRow[] {
  const n = Math.max(0, Math.min(isNaN(score) ? 0 : score, MAX_GOAL_LINES));
  if (rows.length === n) return rows;
  if (rows.length > n) return rows.slice(0, n);
  return [...rows, ...Array.from({ length: n - rows.length }, emptyGoalRow)];
}

/**
 * Enter (or correct) a played match's result after the fact: score, scorers,
 * and — on a knockout tie — the shootout that decides who goes through.
 *
 * Shared by the calendar (group matches) and the bracket (knockout), because
 * both catch up on matches the live console never ran.
 */
export default function MatchResultModal({
  cid,
  match,
  teams,
  onClose,
}: {
  cid: string;
  /** The match being edited; `null` closes the modal. */
  match: CompMatch | null;
  /** Competition teams — the source of both rosters. */
  teams: CompTeam[];
  onClose: () => void;
}) {
  const [scoreHome, setScoreHome] = useState("");
  const [scoreAway, setScoreAway] = useState("");
  const [penaltyHome, setPenaltyHome] = useState("");
  const [penaltyAway, setPenaltyAway] = useState("");
  const [homeGoalRows, setHomeGoalRows] = useState<GoalRow[]>([]);
  const [awayGoalRows, setAwayGoalRows] = useState<GoalRow[]>([]);
  const [saving, setSaving] = useState(false);

  const rosterOf = (teamId: string | null): CompPlayer[] =>
    teams.find((t) => t.id === teamId)?.players ?? [];

  // Seed the form from the match every time a different one is opened. Keyed on
  // the id (not the object) so a live Firestore snapshot arriving mid-edit does
  // not wipe what the organizer is typing.
  useEffect(() => {
    if (!match) return;
    setScoreHome(String(match.scoreHome ?? ""));
    setScoreAway(String(match.scoreAway ?? ""));
    setPenaltyHome(String(match.penaltyHome ?? ""));
    setPenaltyAway(String(match.penaltyAway ?? ""));

    /**
     * Rebuild one side's scorer lines from the goals already stored, so
     * reopening shows what was saved instead of blank rows. An own goal is
     * stored without a `player_id` (its scorer belongs to the other team), so it
     * is re-matched against that team's roster by name.
     */
    const rowsFor = (side: "home" | "away"): GoalRow[] => {
      const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
      const opponentId = side === "home" ? match.awayTeamId : match.homeTeamId;
      const rows: GoalRow[] = (match.liveState?.events ?? [])
        .filter((e) => e.type === "goal" && e.teamId === teamId)
        .map((e) => {
          const ownGoal = e.detail === OWN_GOAL_DETAIL;
          const name = (e.playerName ?? "").trim();
          const known =
            e.playerId ??
            rosterOf(ownGoal ? opponentId : teamId).find(
              (p) => rosterNameKey(p.name) === rosterNameKey(name),
            )?.id ??
            "";
          return {
            // A name we could not match stays editable as a "new player" line —
            // saving it resolves to the same roster entry, never a duplicate.
            playerId: known || (name ? NEW_PLAYER : ""),
            newName: known ? "" : name,
            minute: e.minute ? String(e.minute) : "",
            ownGoal,
          };
        });
      const score = (side === "home" ? match.scoreHome : match.scoreAway) ?? 0;
      return resizeGoalRows(rows, score);
    };

    setHomeGoalRows(rowsFor("home"));
    setAwayGoalRows(rowsFor("away"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.id]);

  // One scorer line per goal typed: raising the score appends blank (unknown
  // scorer) lines, lowering it drops the trailing ones.
  useEffect(() => {
    if (!match) return;
    setHomeGoalRows((prev) => resizeGoalRows(prev, parseInt(scoreHome, 10)));
  }, [scoreHome, match]);

  useEffect(() => {
    if (!match) return;
    setAwayGoalRows((prev) => resizeGoalRows(prev, parseInt(scoreAway, 10)));
  }, [scoreAway, match]);

  const updateGoalRow = (side: "home" | "away", index: number, patch: Partial<GoalRow>) => {
    const setter = side === "home" ? setHomeGoalRows : setAwayGoalRows;
    setter((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        // Flipping "contre son camp" swaps which roster the picker lists, so a
        // selection made against the old one no longer means anything.
        const reset = patch.ownGoal !== undefined && patch.ownGoal !== row.ownGoal
          ? { playerId: "" }
          : {};
        return { ...row, ...patch, ...reset };
      }),
    );
  };

  const handleSave = async () => {
    if (!match) return;
    const h = parseInt(scoreHome, 10);
    const a = parseInt(scoreAway, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      toast.error("Entrez un score valide (≥ 0)");
      return;
    }
    if (h > MAX_GOAL_LINES || a > MAX_GOAL_LINES) {
      toast.error(`Score trop élevé (max ${MAX_GOAL_LINES})`);
      return;
    }

    // Shootout: only meaningful on a knockout tie, and only if both sides given.
    const isShootout = match.stage === "knockout" && h === a;
    const ph = isShootout && penaltyHome.trim() ? parseInt(penaltyHome, 10) : null;
    const pa = isShootout && penaltyAway.trim() ? parseInt(penaltyAway, 10) : null;
    if (isShootout) {
      if ((ph == null) !== (pa == null)) {
        toast.error("Renseignez les tirs au but des deux équipes");
        return;
      }
      if (ph != null && pa != null) {
        if (isNaN(ph) || isNaN(pa) || ph < 0 || pa < 0) {
          toast.error("Tirs au but invalides");
          return;
        }
        if (ph === pa) {
          toast.error("Une séance de tirs au but ne peut pas être à égalité");
          return;
        }
      }
    }

    // Each line carries the team the SCORER plays for — the opponent's, on an
    // own goal — which is both the roster the name is created in and the roster
    // the picker offered.
    const lines = [
      ...homeGoalRows.map((row) => ({
        row,
        side: "home" as const,
        scorerTeamId: row.ownGoal ? match.awayTeamId : match.homeTeamId,
      })),
      ...awayGoalRows.map((row) => ({
        row,
        side: "away" as const,
        scorerTeamId: row.ownGoal ? match.homeTeamId : match.awayTeamId,
      })),
    ];

    for (const { row } of lines) {
      if (!row.minute.trim()) continue;
      const min = parseInt(row.minute, 10);
      if (isNaN(min) || min < 1 || min > 130) {
        toast.error("Minute invalide (entre 1 et 130)");
        return;
      }
    }
    if (lines.some((l) => l.row.playerId === NEW_PLAYER && !l.row.newName.trim())) {
      toast.error("Nom manquant pour un nouveau joueur");
      return;
    }

    setSaving(true);
    try {
      // Create the missing roster lines first — one write per team, so two
      // new scorers in the same squad never race each other.
      const namesByTeam = new Map<string, string[]>();
      for (const { row, scorerTeamId } of lines) {
        if (row.playerId !== NEW_PLAYER || !scorerTeamId) continue;
        const name = row.newName.trim();
        if (!name) continue;
        namesByTeam.set(scorerTeamId, [...(namesByTeam.get(scorerTeamId) ?? []), name]);
      }
      const createdIds = new Map<string, string>(); // `${teamId}::${nameKey}` -> playerId
      let createdCount = 0;
      for (const [teamId, names] of namesByTeam) {
        const knownIds = new Set(rosterOf(teamId).map((p) => p.id));
        const players = await ensureCompPlayers(cid, teamId, names.map((name) => ({ name })));
        players.forEach((p, i) => createdIds.set(`${teamId}::${rosterNameKey(names[i])}`, p.id));
        createdCount += new Set(players.map((p) => p.id).filter((id) => !knownIds.has(id))).size;
      }

      const goals: ResultGoal[] = [];
      for (const { row, side, scorerTeamId } of lines) {
        let playerId: string | null = null;
        let playerName: string | null = null;
        if (row.playerId === NEW_PLAYER) {
          const name = row.newName.trim();
          playerName = name || null;
          playerId = scorerTeamId
            ? createdIds.get(`${scorerTeamId}::${rosterNameKey(name)}`) ?? null
            : null;
        } else if (row.playerId) {
          playerId = row.playerId;
          playerName = rosterOf(scorerTeamId).find((p) => p.id === row.playerId)?.name ?? null;
        }
        const minute = row.minute.trim() ? parseInt(row.minute, 10) : null;
        // A line with neither a scorer nor a minute says nothing the score does
        // not already say — don't write an empty event for it.
        if (!playerName && minute == null) continue;
        goals.push({ side, playerId, playerName, minute, ownGoal: row.ownGoal });
      }

      await setCompMatchResult(cid, match.id, {
        scoreHome: h,
        scoreAway: a,
        goals,
        penaltyHome: ph,
        penaltyAway: pa,
      });
      toast.success(
        createdCount > 0
          ? `Score enregistré — ${createdCount} joueur${createdCount > 1 ? "s ajoutés" : " ajouté"} à l'effectif`
          : "Score enregistré — match terminé",
      );
      onClose();
    } catch (err) {
      console.error("Error saving match result:", err);
      toast.error(err instanceof Error ? err.message : "Impossible d'enregistrer le score");
    } finally {
      setSaving(false);
    }
  };

  const completed = match?.status === "completed";
  const shootoutVisible =
    match?.stage === "knockout" &&
    scoreHome.trim() !== "" &&
    scoreAway.trim() !== "" &&
    parseInt(scoreHome, 10) === parseInt(scoreAway, 10);

  return (
    <AnimatePresence>
      {match && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-gray-900">
                {completed ? "Score & buteurs" : "Ajouter le score final"}
              </h2>
              <button
                onClick={() => !saving && onClose()}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            <p className="mb-1 text-sm text-gray-500">
              {completed ? (
                <>Corrigez le score ou complétez les buteurs.</>
              ) : (
                <>Le match sera marqué comme <strong>terminé</strong>.</>
              )}
            </p>
            <p className="mb-5 text-xs text-gray-400">
              {match.homeTeamName} vs {match.awayTeamName}
              {match.date ? ` · ${match.date}` : ""}
            </p>

            <div className="flex items-center justify-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-gray-600">{match.homeTeamName}</span>
                <input
                  type="number"
                  min={0}
                  value={scoreHome}
                  onChange={(e) => setScoreHome(e.target.value)}
                  className="w-20 rounded-xl border border-gray-300 px-3 py-3 text-center text-2xl font-black text-gray-900 focus:border-primary-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <span className="mt-5 text-xl font-bold text-gray-300">—</span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-gray-600">{match.awayTeamName}</span>
                <input
                  type="number"
                  min={0}
                  value={scoreAway}
                  onChange={(e) => setScoreAway(e.target.value)}
                  className="w-20 rounded-xl border border-gray-300 px-3 py-3 text-center text-2xl font-black text-gray-900 focus:border-primary-500 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>

            {/* Shootout — a knockout tie has to send someone through */}
            {shootoutVisible && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2 text-xs font-bold text-amber-800">
                  Score de parité — tirs au but
                  <span className="ml-1 font-medium text-amber-600">
                    (laissez vide si le match n&apos;a pas été départagé)
                  </span>
                </p>
                <div className="flex items-center justify-center gap-3">
                  <input
                    type="number"
                    min={0}
                    value={penaltyHome}
                    onChange={(e) => setPenaltyHome(e.target.value)}
                    placeholder="0"
                    aria-label={`Tirs au but ${match.homeTeamName}`}
                    className="w-16 rounded-lg border border-amber-300 bg-white px-2 py-2 text-center text-lg font-black text-gray-900 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-sm font-bold text-amber-400">tab</span>
                  <input
                    type="number"
                    min={0}
                    value={penaltyAway}
                    onChange={(e) => setPenaltyAway(e.target.value)}
                    placeholder="0"
                    aria-label={`Tirs au but ${match.awayTeamName}`}
                    className="w-16 rounded-lg border border-amber-300 bg-white px-2 py-2 text-center text-lg font-black text-gray-900 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Scorers — one line per goal, all fields optional */}
            {(homeGoalRows.length > 0 || awayGoalRows.length > 0) && (
              <div className="mt-6 space-y-4 border-t border-gray-100 pt-5">
                <div className="flex items-center gap-2">
                  <Goal size={15} className="text-emerald-600" />
                  <h3 className="text-sm font-bold text-gray-900">Buteurs</h3>
                  <span className="text-xs text-gray-400">optionnel</span>
                </div>
                <ScorerLines
                  teamName={match.homeTeamName}
                  opponentName={match.awayTeamName}
                  rows={homeGoalRows}
                  roster={rosterOf(match.homeTeamId)}
                  opponentRoster={rosterOf(match.awayTeamId)}
                  onChange={(i, patch) => updateGoalRow("home", i, patch)}
                />
                <ScorerLines
                  teamName={match.awayTeamName}
                  opponentName={match.homeTeamName}
                  rows={awayGoalRows}
                  roster={rosterOf(match.awayTeamId)}
                  opponentRoster={rosterOf(match.homeTeamId)}
                  onChange={(i, patch) => updateGoalRow("away", i, patch)}
                />
                <p className="text-[11px] text-gray-400">
                  Un buteur absent de l&apos;effectif y est ajouté automatiquement à
                  l&apos;enregistrement. Les lignes laissées vides restent des buts sans buteur connu.
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => !saving && onClose()}
                className="rounded-lg px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-200 transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
                Valider le score
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * Scorer lines for one side: one row per goal, each with an optional scorer, an
 * optional minute, and an own-goal switch that flips the picker to the opposing
 * squad (the player who put it in his own net).
 */
function ScorerLines({
  teamName,
  opponentName,
  rows,
  roster,
  opponentRoster,
  onChange,
}: {
  teamName: string;
  opponentName: string;
  rows: GoalRow[];
  roster: CompPlayer[];
  opponentRoster: CompPlayer[];
  onChange: (index: number, patch: Partial<GoalRow>) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{teamName}</p>
      <div className="space-y-2">
        {rows.map((row, i) => {
          const list = row.ownGoal ? opponentRoster : roster;
          return (
            <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/50 p-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-black text-emerald-700">
                  {i + 1}
                </span>
                <select
                  value={row.playerId}
                  onChange={(e) => onChange(i, { playerId: e.target.value })}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
                >
                  <option value="">Buteur inconnu</option>
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.number ? `${p.number}. ` : ""}{p.name}
                    </option>
                  ))}
                  <option value={NEW_PLAYER}>＋ Nouveau joueur…</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={130}
                  placeholder="min"
                  value={row.minute}
                  onChange={(e) => onChange(i, { minute: e.target.value })}
                  className="w-16 shrink-0 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
                />
              </div>

              {row.playerId === NEW_PLAYER && (
                <input
                  type="text"
                  placeholder={`Nom du joueur (ajouté à l'effectif de ${row.ownGoal ? opponentName : teamName})`}
                  value={row.newName}
                  onChange={(e) => onChange(i, { newName: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
                />
              )}

              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-gray-500">
                <input
                  type="checkbox"
                  checked={row.ownGoal}
                  onChange={(e) => onChange(i, { ownGoal: e.target.checked })}
                  className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Contre son camp
                {row.ownGoal && <span className="text-gray-400">— joueur de {opponentName}</span>}
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
