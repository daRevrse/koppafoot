"use client";

import { useMemo } from "react";
import { computeTopScorers } from "@/lib/competition-firestore";
import type { CompMatch, CompTeam } from "@/types";

// ============================================
// Le rail d'une page compétition : les performances.
//
// Trois lectures qui ne se répètent pas : qui marque, qui fait marquer, et
// quelles équipes tiennent la forme. Les deux premières parlent de joueurs,
// la troisième d'équipes, d'où le choix de la forme plutôt qu'un troisième
// classement individuel, qui aurait redit la même chose une fois de plus.
//
// Tout se calcule à partir des matchs déjà chargés par la page : aucune
// lecture supplémentaire, et le rail se met à jour en même temps que le
// tableau quand un but tombe.
//
// Ne rend rien quand les trois blocs sont vides : une carte blanche sans
// contenu n'est pas un rail, c'est un trou.
// ============================================

interface Assister {
  playerName: string;
  teamId: string;
  assists: number;
}

/**
 * Les passeurs, comptés sur les mêmes événements que les buteurs.
 *
 * Réserve honnête : la passe décisive est une donnée récente de la console.
 * Un but saisi avant qu'elle existe n'en porte pas, ce classement est donc
 * partiel par construction, et le restera pour les compétitions passées.
 */
function computeTopAssisters(matches: CompMatch[]): Assister[] {
  const byKey = new Map<string, Assister>();

  for (const match of matches) {
    for (const event of match.liveState?.events ?? []) {
      if (event.type !== "goal") continue;
      // Un but annulé par la vidéo n'a jamais eu lieu, passe comprise.
      if (event.varStatus === "cancelled") continue;
      const name = event.assistPlayerName?.trim();
      if (!name) continue;

      const key = `${name.toLowerCase()}::${event.teamId}`;
      const row = byKey.get(key);
      if (row) row.assists += 1;
      else byKey.set(key, { playerName: name, teamId: event.teamId, assists: 1 });
    }
  }

  return [...byKey.values()].sort(
    (a, b) => b.assists - a.assists || a.playerName.localeCompare(b.playerName),
  );
}

type Result = "W" | "D" | "L";

interface Form {
  team: CompTeam;
  results: Result[];
}

/** Les cinq derniers résultats de chaque équipe, le plus récent à droite. */
function computeForm(matches: CompMatch[], teams: CompTeam[]): Form[] {
  const played = matches
    .filter((m) => m.status === "completed" && m.scoreHome !== null && m.scoreAway !== null)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

  const byTeam = new Map<string, Result[]>();
  for (const m of played) {
    const hs = m.scoreHome as number;
    const as = m.scoreAway as number;
    const push = (id: string | null, own: number, other: number) => {
      if (!id) return;
      const list = byTeam.get(id) ?? [];
      list.push(own > other ? "W" : own < other ? "L" : "D");
      byTeam.set(id, list);
    };
    push(m.homeTeamId, hs, as);
    push(m.awayTeamId, as, hs);
  }

  return teams
    .map((team) => ({ team, results: (byTeam.get(team.id) ?? []).slice(-5) }))
    .filter((f) => f.results.length > 0)
    // Le plus en forme d'abord : trois points la victoire, un le nul.
    .sort((a, b) => score(b.results) - score(a.results) || b.results.length - a.results.length);
}

const score = (rs: Result[]) => rs.reduce((n, r) => n + (r === "W" ? 3 : r === "D" ? 1 : 0), 0);

const DOT: Record<Result, string> = {
  W: "bg-emerald-600 text-white",
  D: "bg-gray-200 text-gray-600",
  L: "bg-red-500 text-white",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PlayerRow({ rank, name, teamName, value }: {
  rank: number; name: string; teamName: string | null; value: number;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="w-4 shrink-0 text-right text-[11px] font-black tabular-nums text-gray-400">{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-gray-900">{name}</span>
        {teamName && (
          <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
            {teamName}
          </span>
        )}
      </span>
      <span className="shrink-0 font-display text-base font-black tabular-nums text-gray-900">{value}</span>
    </li>
  );
}

export default function CompetitionRail({ matches, teams }: {
  matches: CompMatch[];
  teams: CompTeam[];
}) {
  const teamName = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  const scorers = useMemo(() => computeTopScorers(matches).slice(0, 5), [matches]);
  const assisters = useMemo(() => computeTopAssisters(matches).slice(0, 5), [matches]);
  const form = useMemo(() => computeForm(matches, teams).slice(0, 5), [matches, teams]);

  // Avant le premier match, les trois blocs seraient vides.
  if (scorers.length === 0 && assisters.length === 0 && form.length === 0) return null;

  return (
    <aside className="mt-6 border border-gray-200/70 bg-white p-5 lg:mt-0">
      <div className="space-y-8">
        {scorers.length > 0 && (
          <Block title="Meilleurs buteurs">
            <ul className="divide-y divide-gray-200/70">
              {scorers.map((s, i) => (
                <PlayerRow
                  key={`${s.playerName}-${s.teamId}`}
                  rank={i + 1}
                  name={s.playerName}
                  teamName={teamName.get(s.teamId) ?? null}
                  value={s.goals}
                />
              ))}
            </ul>
          </Block>
        )}

        {assisters.length > 0 && (
          <Block title="Meilleurs passeurs">
            <ul className="divide-y divide-gray-200/70">
              {assisters.map((a, i) => (
                <PlayerRow
                  key={`${a.playerName}-${a.teamId}`}
                  rank={i + 1}
                  name={a.playerName}
                  teamName={teamName.get(a.teamId) ?? null}
                  value={a.assists}
                />
              ))}
            </ul>
          </Block>
        )}

        {form.length > 0 && (
          <Block title="Forme des équipes">
            <ul className="divide-y divide-gray-200/70">
              {form.map((f) => (
                <li key={f.team.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                    {f.team.name}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {f.results.map((r, i) => (
                      <span
                        key={i}
                        title={r === "W" ? "Victoire" : r === "D" ? "Nul" : "Défaite"}
                        className={`flex h-5 w-5 items-center justify-center text-[10px] font-black ${DOT[r]}`}
                      >
                        {r === "W" ? "V" : r === "D" ? "N" : "D"}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </Block>
        )}
      </div>
    </aside>
  );
}
