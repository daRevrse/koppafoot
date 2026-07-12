"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowLeft, Upload, Users, Shield, Calendar, Loader2, FileUp, AlertTriangle, Check,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  onCompetition,
  onCompTeams,
  parseDelimited,
  importTeams,
  setTeamRoster,
  importMatches,
  type ImportTeamRow,
  type ImportRosterRow,
  type ImportMatchRow,
} from "@/lib/competition-firestore";
import type { Competition, CompTeam } from "@/types";
import toast from "react-hot-toast";

type TabKey = "teams" | "players" | "matches";

// ---- Parsing helpers --------------------------------------------------------

interface ParsedTeam {
  row: ImportTeamRow;
  valid: boolean; // false when name is missing
}

interface ParsedRosterPlayer {
  row: ImportRosterRow;
  valid: boolean; // false when name is missing
}

interface ParsedMatch {
  row: ImportMatchRow;
  valid: boolean;
  unknownHome: boolean;
  unknownAway: boolean;
}

/** Drop the header row when requested, after parsing. */
function bodyRows(text: string, skipHeader: boolean): string[][] {
  const parsed = parseDelimited(text);
  return skipHeader ? parsed.slice(1) : parsed;
}

function parseTeams(text: string, skipHeader: boolean): ParsedTeam[] {
  return bodyRows(text, skipHeader).map((cells) => {
    const name = (cells[0] ?? "").trim();
    const shortName = (cells[1] ?? "").trim();
    const group = (cells[2] ?? "").trim();
    const color = (cells[3] ?? "").trim();
    const row: ImportTeamRow = {
      name,
      ...(shortName ? { shortName } : {}),
      ...(group ? { group } : {}),
      ...(color ? { color } : {}),
    };
    return { row, valid: Boolean(name) };
  });
}

function parseRoster(text: string, skipHeader: boolean): ParsedRosterPlayer[] {
  return bodyRows(text, skipHeader).map((cells) => {
    const name = (cells[0] ?? "").trim();
    const number = (cells[1] ?? "").trim();
    const position = (cells[2] ?? "").trim();
    const row: ImportRosterRow = {
      name,
      number,
      ...(position ? { position } : {}),
    };
    return { row, valid: Boolean(name) };
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
  const [teamsText, setTeamsText] = useState("");
  const [teamsSkipHeader, setTeamsSkipHeader] = useState(false);
  const [rosterText, setRosterText] = useState("");
  const [rosterSkipHeader, setRosterSkipHeader] = useState(false);
  const [rosterTeamId, setRosterTeamId] = useState("");
  const [matchesText, setMatchesText] = useState("");
  const [matchesSkipHeader, setMatchesSkipHeader] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const teamsFileRef = useRef<HTMLInputElement>(null);
  const rosterFileRef = useRef<HTMLInputElement>(null);
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

  const parsedTeams = useMemo(
    () => parseTeams(teamsText, teamsSkipHeader),
    [teamsText, teamsSkipHeader],
  );
  const parsedRoster = useMemo(
    () => parseRoster(rosterText, rosterSkipHeader),
    [rosterText, rosterSkipHeader],
  );
  const parsedMatches = useMemo(
    () => parseMatches(matchesText, matchesSkipHeader, knownTeamNames),
    [matchesText, matchesSkipHeader, knownTeamNames],
  );

  const validTeams = useMemo(() => parsedTeams.filter((t) => t.valid), [parsedTeams]);
  const validRoster = useMemo(() => parsedRoster.filter((p) => p.valid), [parsedRoster]);
  const validMatches = useMemo(() => parsedMatches.filter((m) => m.valid), [parsedMatches]);
  const unknownMatchCount = useMemo(
    () => validMatches.filter((m) => m.unknownHome || m.unknownAway).length,
    [validMatches],
  );

  const selectedTeam = teams.find((t) => t.id === rosterTeamId) ?? null;

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

  const handleImportTeams = async () => {
    if (validTeams.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await importTeams(cid, validTeams.map((t) => t.row));
      toast.success(
        `${result.created} équipe${result.created !== 1 ? "s" : ""} créée${
          result.created !== 1 ? "s" : ""
        } · ${result.updated} mise${result.updated !== 1 ? "s" : ""} à jour`,
      );
      setTeamsText("");
      if (teamsFileRef.current) teamsFileRef.current.value = "";
    } catch (err) {
      console.error("Error importing teams:", err);
      toast.error("L'import a échoué");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportRoster = async () => {
    if (!rosterTeamId || validRoster.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await setTeamRoster(cid, rosterTeamId, validRoster.map((p) => p.row));
      toast.success(
        `${result.players} joueur${result.players !== 1 ? "s" : ""} pour ${selectedTeam?.name ?? "l'équipe"}`,
      );
      setRosterText("");
      if (rosterFileRef.current) rosterFileRef.current.value = "";
    } catch (err) {
      console.error("Error importing roster:", err);
      toast.error("L'import a échoué");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportMatches = async () => {
    if (validMatches.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const result = await importMatches(cid, validMatches.map((m) => m.row));
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

  const TABS: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: "teams", label: "Équipes", icon: Shield },
    { key: "players", label: "Joueurs", icon: Users },
    { key: "matches", label: "Matchs", icon: Calendar },
  ];

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
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key
                ? "bg-white text-primary-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ---- Teams section ---- */}
      {tab === "teams" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
        >
          <FormatHint
            columns={["Équipe", "Sigle (optionnel)", "Poule (optionnel)", "Couleur (optionnel)"]}
            example="Mali	MLI	A	#0CB04A"
          />

          <textarea
            value={teamsText}
            onChange={(e) => setTeamsText(e.target.value)}
            rows={6}
            placeholder={"Mali\tMLI\tA\t#0CB04A\nGuinée\tGUI\tA\t#CE1126"}
            className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
          />

          <SectionControls
            fileRef={teamsFileRef}
            onFile={(file) => readFileIntoState(file, setTeamsText)}
            skipHeader={teamsSkipHeader}
            onToggleHeader={setTeamsSkipHeader}
          />

          {parsedTeams.length > 0 && (
            <>
              <PreviewSummary
                parts={[
                  `${validTeams.length} équipe${validTeams.length !== 1 ? "s" : ""}`,
                  ...(parsedTeams.length - validTeams.length > 0
                    ? [`${parsedTeams.length - validTeams.length} ligne(s) invalide(s)`]
                    : []),
                ]}
              />
              <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Équipe</th>
                      <th className="px-3 py-2 font-semibold">Sigle</th>
                      <th className="px-3 py-2 font-semibold">Poule</th>
                      <th className="px-3 py-2 font-semibold">Couleur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedTeams.map((t, i) => (
                      <tr key={i} className={t.valid ? "" : "bg-red-50/60 text-red-700"}>
                        <td className="px-3 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            {!t.valid && <AlertTriangle size={13} className="shrink-0" />}
                            {t.row.name || "—"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-500">{t.row.shortName ?? "—"}</td>
                        <td className="px-3 py-1.5 text-gray-500">{t.row.group ?? "—"}</td>
                        <td className="px-3 py-1.5 text-gray-500">{t.row.color ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <ImportButton
              onClick={handleImportTeams}
              disabled={validTeams.length === 0 || submitting}
              submitting={submitting}
              label={validTeams.length > 0 ? `Importer ${validTeams.length} équipe${validTeams.length !== 1 ? "s" : ""}` : "Importer"}
            />
          </div>
        </motion.section>
      )}

      {/* ---- Players (roster per team) section ---- */}
      {tab === "players" && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6"
        >
          {/* Team selector first */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-gray-700">
              Équipe à compléter
            </label>
            {teams.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Aucune équipe pour l&apos;instant. Importez d&apos;abord les équipes (onglet Équipes).
              </p>
            ) : (
              <select
                value={rosterTeamId}
                onChange={(e) => setRosterTeamId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
              >
                <option value="">— Choisir une équipe —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.group ? ` (Poule ${t.group})` : ""}
                    {t.players.length > 0 ? ` · ${t.players.length} joueur${t.players.length !== 1 ? "s" : ""}` : ""}
                  </option>
                ))}
              </select>
            )}
            {selectedTeam && selectedTeam.players.length > 0 && (
              <p className="mt-1.5 text-xs text-gray-500">
                L&apos;effectif actuel ({selectedTeam.players.length} joueur
                {selectedTeam.players.length !== 1 ? "s" : ""}) sera remplacé.
              </p>
            )}
          </div>

          <FormatHint
            columns={["Nom", "Dossard", "Poste (optionnel)"]}
            example="Kossi Mensah	9	Attaquant"
          />

          <textarea
            value={rosterText}
            onChange={(e) => setRosterText(e.target.value)}
            rows={6}
            disabled={!rosterTeamId}
            placeholder={"Kossi Mensah\t9\tAttaquant\nAmin Diallo\t1\tGardien"}
            className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm text-gray-700 focus:border-primary-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50"
          />

          <SectionControls
            fileRef={rosterFileRef}
            onFile={(file) => readFileIntoState(file, setRosterText)}
            skipHeader={rosterSkipHeader}
            onToggleHeader={setRosterSkipHeader}
            disabled={!rosterTeamId}
          />

          {parsedRoster.length > 0 && (
            <>
              <PreviewSummary
                parts={[
                  `${validRoster.length} joueur${validRoster.length !== 1 ? "s" : ""}`,
                  ...(parsedRoster.length - validRoster.length > 0
                    ? [`${parsedRoster.length - validRoster.length} ligne(s) invalide(s)`]
                    : []),
                ]}
              />
              <div className="max-h-72 overflow-auto rounded-xl border border-gray-100">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Nom</th>
                      <th className="px-3 py-2 font-semibold">Dossard</th>
                      <th className="px-3 py-2 font-semibold">Poste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRoster.map((p, i) => (
                      <tr key={i} className={p.valid ? "" : "bg-red-50/60 text-red-700"}>
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

          <div className="flex justify-end">
            <ImportButton
              onClick={handleImportRoster}
              disabled={!rosterTeamId || validRoster.length === 0 || submitting}
              submitting={submitting}
              label={validRoster.length > 0 ? `Importer ${validRoster.length} joueur${validRoster.length !== 1 ? "s" : ""}` : "Importer"}
            />
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
            example="Mali	Guinée	2026-07-24	20:00	Haady Parc	A"
          />

          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Les équipes doivent déjà exister dans la compétition (importez-les d&apos;abord). Les
            rencontres dont une équipe est introuvable seront ignorées.
          </p>

          <textarea
            value={matchesText}
            onChange={(e) => setMatchesText(e.target.value)}
            rows={6}
            placeholder={"Mali\tGuinée\t2026-07-24\t20:00\tHaady Parc\tA"}
            className="w-full resize-y rounded-xl border border-gray-300 px-4 py-3 font-mono text-sm text-gray-700 focus:border-primary-500 focus:outline-none"
          />

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
                    ? [`${unknownMatchCount} équipe(s) introuvable(s)`]
                    : []),
                  ...(parsedMatches.length - validMatches.length > 0
                    ? [`${parsedMatches.length - validMatches.length} ligne(s) invalide(s)`]
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

          <div className="flex justify-end">
            <ImportButton
              onClick={handleImportMatches}
              disabled={validMatches.length === 0 || submitting}
              submitting={submitting}
              label={validMatches.length > 0 ? `Importer ${validMatches.length} match${validMatches.length !== 1 ? "s" : ""}` : "Importer"}
            />
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
  disabled = false,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  skipHeader: boolean;
  onToggleHeader: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <label
        className={`inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-gray-50"
        }`}
      >
        <FileUp size={15} />
        Charger un fichier
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt"
          disabled={disabled}
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

function ImportButton({
  onClick,
  disabled,
  submitting,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  submitting: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary-200 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      {label}
    </button>
  );
}
