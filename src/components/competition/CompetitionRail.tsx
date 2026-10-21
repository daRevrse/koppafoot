"use client";

import { useMemo } from "react";
import {
  computeForm, computeTopAssisters, computeTopScorers, type ResultatDeForme as Result,
} from "@/lib/performances-competition";
import { matchsQuiComptent } from "@/lib/exhibition";
import type { CompMatch, CompTeam } from "@/types";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";

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

const DOT: Record<Result, string> = {
  W: "bg-emerald-600 text-white",
  D: "bg-gray-200 text-gray-600",
  L: "bg-red-500 text-white",
};

const T = textes(
  {
    buteurs: "Meilleurs buteurs",
    passeurs: "Meilleurs passeurs",
    forme: "Forme des équipes",
    resultat: (r: Result) => ({ W: "Victoire", D: "Nul", L: "Défaite" })[r],
    lettre: (r: Result) => ({ W: "V", D: "N", L: "D" })[r],
  },
  {
    buteurs: "Top scorers",
    passeurs: "Top assists",
    forme: "Team form",
    resultat: (r: Result) => ({ W: "Win", D: "Draw", L: "Loss" })[r],
    lettre: (r: Result) => r,
  },
);

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
  const t = useTextes(T);
  const teamName = useMemo(() => {
    const map = new Map<string, string>();
    for (const equipe of teams) map.set(equipe.id, equipe.name);
    return map;
  }, [teams]);

  // Un match d'exhibition ne fait ni buteur, ni passeur, ni forme (lib/exhibition).
  const officiels = useMemo(() => matchsQuiComptent(matches), [matches]);
  const scorers = useMemo(() => computeTopScorers(officiels).slice(0, 5), [officiels]);
  const assisters = useMemo(() => computeTopAssisters(officiels).slice(0, 5), [officiels]);
  const form = useMemo(() => computeForm(officiels, teams).slice(0, 5), [officiels, teams]);

  // Avant le premier match, les trois blocs seraient vides.
  if (scorers.length === 0 && assisters.length === 0 && form.length === 0) return null;

  return (
    <aside className="mt-6 border border-gray-200/70 bg-white p-5 lg:mt-0">
      <div className="space-y-8">
        {scorers.length > 0 && (
          <Block title={t.buteurs}>
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
          <Block title={t.passeurs}>
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
          <Block title={t.forme}>
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
                        title={t.resultat(r)}
                        className={`flex h-5 w-5 items-center justify-center text-[10px] font-black ${DOT[r]}`}
                      >
                        {t.lettre(r)}
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
