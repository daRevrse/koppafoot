"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft, Upload, Users, Calendar, Loader2, FileUp, AlertTriangle, Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  onCompetition,
  onCompTeams,
  parseDelimited,
  importTeamsPlayers,
  importMatches,
  type ImportPlayerRow,
  type ImportMatchRow,
} from "@/lib/competition-firestore";
import type { Competition, CompTeam } from "@/types";
import toast from "react-hot-toast";

type TabKey = "teams" | "matches";

// ---- Parsing helpers --------------------------------------------------------

interface ParsedPlayer {
  row: ImportPlayerRow;
  valid: boolean; // false when team or name is missing
}

interface ParsedMatch {
  row: ImportMatchRow;
  valid: boolean; // false when home or away is missing
  unknownHome: boolean; // valid row but home team not found in comp_teams
  unknownAway: boolean; // valid row but away team not found in comp_teams
}

/** Drop the header row when requested, after parsing. */
function bodyRows(text: string, skipHeader: boolean): string[][] {
  const parsed = parseDelimited(text);
  return skipHeader ? parsed.slice(1) : parsed;
}

function parsePlayers(text: string, skipHeader: boolean): ParsedPlayer[] {
  return bodyRows(text, skipHeader).map((cells) => {
    const team = (cells[0] ?? "").trim();
    const name = (cells[1] ?? "").trim();
    const number = (cells[2] ?? "").trim();
    const position = (cells[3] ?? "").trim();
    const row: ImportPlayerRow = {
      team,
      name,
      number,
      ...(position ? { position } : {}),
    };
    return { row, valid: Boolean(team && name) };
  });
}

function parseMatches(
  text: string,
  skipHeader: boolean,
  knownTeamNames: Set<string>,
): ParsedMatch[] {
  return bodyRows(text, skipHeader).map((cells) => {
    const home = (cells[0] ?? "").trim();
    const away = (cells[1] ?? "").trim();
    const date = (cells[2] ?? "").trim();
    const time = (cells[3] ?? "").trim();
    const venue = (cells[4] ?? "").trim();
    const group = (cells[5] ?? "").trim();
    const row: ImportMatchRow = {
      home,
      away,
      ...(date ? { date } : {}),
      ...(time ? { time } : {}),
      ...(venue ? { venue } : {}),
      ...(group ? { group } : {}),
    };
    const valid = Boolean(home && away);
    return {
      row,
      valid,
      unknownHome: valid && !knownTeamNames.has(home.toLowerCase()),
      unknownAway: valid && !knownTeamNames.has(away.toLowerCase()),
    };
  });
}

// ---- Page -------------------------------------------------------------------

export default function CompetitionImportPage() {
  const params = useParams<{ cid: string }>();
  const cid = params.cid;
  const { user } = useAuth();
  const router = useRouter();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<CompTeam[]>([]);

  const [tab, setTab] = useState<TabKey>("teams");

  // Raw text + header-skip per section.
  const [playersText, setPlayersText] = useState("");
  const [playersSkipHeader, setPlayersSkipHeader] = useState(false);
  const [matchesText, setMatchesText] = useState("");
  const [matchesSkipHeader, setMatchesSkipHeader] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const playersFileRef = useRef<HTMLInputElement>(null);
  const matchesFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cid) return;
    const unsubCompetition = onCompetition(cid, setCompetition);
    const unsubTeams = onCompTeams(cid, setTeams);
    return () => {
      unsubCompetition();
      unsubTeams();
    };
  }, [cid]);

  // Guard: only organizers of this competition may view it.
  useEffect(() => {
    if (!user || !competition) return;
    if (!competition.organizerIds.includes(user.uid)) {
      router.replace("/organizer");
    }
  }, [user, competition, router]);

  const knownTeamNames = useMemo(
    () => new Set(teams.map((t) => t.name.trim().toLowerCase())),
    [teams],
  );

  const parsedPlayers = useMemo(
    () => parsePlayers(playersText, playersSkipHeader),
    [playersText, playersSkipHeader],
  );
  const parsedMatches = useMemo(
    () => parseMatches(matchesText, matchesSkipHeader, knownTeamNames),
    [matchesText, matchesSkipHeader, knownTeamNames],
  );

  // Player counts: valid rows + distinct team count among valid rows.
  const validPlayers = useMemo(
    () => parsedPlayers.filter((p) => p.valid),
    [parsedPlayers],
  );
  const playerTeamCount = useMemo(
    () => new Set(validPlayers.map((p) => p.row.team.trim().toLowerCase())).size,
    [validPlayers],
  );

  // Match counts: valid rows + how many will be skipped (unknown team).
  const validMatches = useMemo(
    () => parsedMatches.filter((m) => m.valid),
    [parsedMatches],
  );
  const unknownMatchCount = useMemo(
    () => validMatches.filter((m) => m.unknownHome || m.unknownAway).length,
    [validMatches],
  );

  const readFileIntoState = async (
    file: File | undefined,
    setText: (v: string) => void,
  ) => {
    if (!file) return;
    try {
      const text = await file.text();
      setText(text);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Impossible de lire le fichier");
    }
  };

  const handleImportPlayers = async () => {
    if (validPlayers.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await importTeamsPlayers(
        cid,
        validPlayers.map((p) => p.row),
      );
      const teamsTouched = result.teamsCreated + result.teamsUpdated;
      toast.success(
        `${teamsTouched} équipe${teamsTouched !== 1 ? "s" : ""} (${result.teamsCreated} créée${
          result.teamsCreated !== 1 ? "s" : ""
        }, ${result.teamsUpdated} mise${result.teamsUpdated !== 1 ? "s" : ""} à jour) · ${
          result.players
        } joueur${result.players !== 1 ? "s" : ""}`,
      );
      setPlayersText("");
      if (playersFileRef.current) playersFileRef.current.value = "";
    } catch (err) {
      console.error("Error importing teams/players:", err);
      toast.error("L'import a échoué");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportMatches = async () => {
    if (validMatches.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await importMatches(
        cid,
        validMatches.map((m) => m.row),
      );
      toast.success(
        `${result.created} match${result.created !== 1 ? "s" : ""} créé${
          result.created !== 1 ? "s" : ""
        }${result.skipped > 0 ? ` · ${result.skipped} ignoré${result.skipped !== 1 ? "s" : ""}` : ""}`,
      );
      setMatchesText("");
      if (matchesFileRef.current) matchesFileRef.current.value = "";
    } catch (err) {
      console.error("Error importing matches:", err);
      toast.error("L'import a échoué");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back link */}
      <Link
        href={`/organizer/competitions/${cid}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600"
      >
        <ArrowLeft size={16} />
        Tableau de bord
      </Link>

      {/* Header */}
      <div>
        <motion.h1
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 font-display text-2xl font-extrabold text-gray-900"
        >
          <Upload size={24} className="text-primary-600" />
          Importer des données
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="mt-0.5 text-sm text-gray-500"
        >
          Collez depuis un tableur (Excel, Google Sheets) ou chargez un fichier CSV/TSV.
        </motion.p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 rounded-xl bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => setTab("teams")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "teams"
              ? "bg-white text-primary-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users size={16} />
          Équipes + joueurs
        </button>
        <button
          type="button"
          onClick={() => setTab("matches")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            tab === "matches"
              ? "bg-white text-primary-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Calendar size={16} />
          Matchs
        </button>
      </div>

      {/* ---- Teams + players section ---- */}
      {tab === "teams" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
        >
          <FormatHint
            columns={["Équipe", "Nom", "Dossard", "Poste (optionnel)"]}
            example="FC Étoile	Kossi Mensah	9	Attaquant"
          />

          <div>
            <textarea
              value={playersText}
              onChange={(e) => setPlayersText(e.target.value)}
              rows={6}
              placeholder={"FC Étoile\tKossi Mensah\t9\tAttaquant\nFC Étoile\tAmin Diallo\t1\tGardien"}
              className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
            />
          </div>

          <SectionControls
            fileRef={playersFileRef}
            onFile={(file) => readFileIntoState(file, setPlayersText)}
            skipHeader={playersSkipHeader}
            onToggleHeader={setPlayersSkipHeader}
          />

          {parsedPlayers.length > 0 && (
            <>
              <PreviewSummary
                parts={[
                  `${playerTeamCount} équipe${playerTeamCount !== 1 ? "s" : ""}`,
                  `${validPlayers.length} joueur${validPlayers.length !== 1 ? "s" : ""}`,
                  ...(parsedPlayers.length - validPlayers.length > 0
                    ? [
                        `${parsedPlayers.length - validPlayers.length} ligne${
                          parsedPlayers.length - validPlayers.length !== 1 ? "s" : ""
                        } invalide${parsedPlayers.length - validPlayers.length !== 1 ? "s" : ""}`,
                      ]
                    : []),
                ]}
              />

              <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Équipe</th>
                      <th className="px-3 py-2 font-semibold">Nom</th>
                      <th className="px-3 py-2 font-semibold">Dossard</th>
                      <th className="px-3 py-2 font-semibold">Poste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedPlayers.map((p, i) => (
                      <tr
                        key={i}
                        className={p.valid ? "" : "bg-red-50/60 text-red-700"}
                      >
                        <td className="px-3 py-1.5">{p.row.team || "—"}</td>
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            {!p.valid && <AlertTriangle size={13} className="shrink-0" />}
                            {p.row.name || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{p.row.number || "—"}</td>
                        <td className="px-3 py-1.5 text-gray-500">{p.row.position ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleImportPlayers}
              disabled={validPlayers.length === 0 || submitting}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Importer{" "}
              {validPlayers.length > 0 &&
                `${validPlayers.length} joueur${validPlayers.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </motion.section>
      )}

      {/* ---- Matches section ---- */}
      {tab === "matches" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
        >
          <FormatHint
            columns={[
              "Domicile",
              "Extérieur",
              "Date (optionnel)",
              "Heure (optionnel)",
              "Stade (optionnel)",
              "Poule (optionnel)",
            ]}
            example="FC Étoile	AS Victoria	2026-07-01	18:00	Stade de Kégué	A"
          />

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Les équipes doivent déjà exister dans la compétition (importez-les d&apos;abord). Les
            rencontres dont une équipe est introuvable seront ignorées.
          </p>

          <div>
            <textarea
              value={matchesText}
              onChange={(e) => setMatchesText(e.target.value)}
              rows={6}
              placeholder={"FC Étoile\tAS Victoria\t2026-07-01\t18:00\tStade de Kégué\tA"}
              className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
            />
          </div>

          <SectionControls
            fileRef={matchesFileRef}
            onFile={(file) => readFileIntoState(file, setMatchesText)}
            skipHeader={matchesSkipHeader}
            onToggleHeader={setMatchesSkipHeader}
          />

          {parsedMatches.length > 0 && (
            <>
              <PreviewSummary
                parts={[
                  `${validMatches.length} match${validMatches.length !== 1 ? "s" : ""}`,
                  ...(unknownMatchCount > 0
                    ? [`${unknownMatchCount} équipe${unknownMatchCount !== 1 ? "s" : ""} introuvable${
                        unknownMatchCount !== 1 ? "s" : ""
                      }`]
                    : []),
                  ...(parsedMatches.length - validMatches.length > 0
                    ? [
                        `${parsedMatches.length - validMatches.length} ligne${
                          parsedMatches.length - validMatches.length !== 1 ? "s" : ""
                        } invalide${parsedMatches.length - validMatches.length !== 1 ? "s" : ""}`,
                      ]
                    : []),
                ]}
              />

              <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Domicile</th>
                      <th className="px-3 py-2 font-semibold">Extérieur</th>
                      <th className="px-3 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Heure</th>
                      <th className="px-3 py-2 font-semibold">Stade</th>
                      <th className="px-3 py-2 font-semibold">Poule</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedMatches.map((m, i) => {
                      const skipped = m.valid && (m.unknownHome || m.unknownAway);
                      return (
                        <tr
                          key={i}
                          className={
                            !m.valid
                              ? "bg-red-50/60 text-red-700"
                              : skipped
                                ? "bg-amber-50/60 text-amber-800"
                                : ""
                          }
                        >
                          <td className="px-3 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              {(!m.valid || m.unknownHome) && (
                                <AlertTriangle size={13} className="shrink-0" />
                              )}
                              {m.row.home || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5">
                            <span className="inline-flex items-center gap-1.5">
                              {m.valid && m.unknownAway && (
                                <AlertTriangle size={13} className="shrink-0" />
                              )}
                              {m.row.away || "—"}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">{m.row.date ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-500">{m.row.time ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-500">{m.row.venue ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-500">{m.row.group ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleImportMatches}
              disabled={validMatches.length === 0 || submitting}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Importer{" "}
              {validMatches.length > 0 &&
                `${validMatches.length} match${validMatches.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </motion.section>
      )}
    </div>
  );
}

// ---- Small presentational helpers ------------------------------------------

function FormatHint({ columns, example }: { columns: string[]; example: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
      <p className="font-medium text-gray-700">Colonnes attendues (dans l&apos;ordre) :</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {columns.map((col, i) => (
          <span
            key={col}
            className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200"
          >
            <span className="text-gray-400">{i + 1}.</span>
            {col}
          </span>
        ))}
      </div>
      <p className="mt-2 truncate font-mono text-xs text-gray-400">ex : {example}</p>
    </div>
  );
}

function SectionControls({
  fileRef,
  onFile,
  skipHeader,
  onToggleHeader,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  skipHeader: boolean;
  onToggleHeader: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
        <FileUp size={15} />
        Charger un fichier
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={skipHeader}
          onChange={(e) => onToggleHeader(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        Première ligne = en-tête
      </label>
    </div>
  );
}

function PreviewSummary({ parts }: { parts: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-gray-700">Aperçu :</span>
      <span className="text-gray-600">{parts.join(" · ")}</span>
    </div>
  );
}
