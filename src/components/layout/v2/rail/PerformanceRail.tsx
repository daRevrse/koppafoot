"use client";

import { useEffect, useState } from "react";

// ============================================
// Les dernières performances d'un joueur ou d'une équipe, dans le rail de sa
// page publique.
//
// Un classement général dit qui est le meilleur ; cette carte dit ce que
// CETTE personne a fait récemment, ce qui est la question qu'on se pose en
// ouvrant sa fiche.
//
// Ne rend rien quand il n'y a rien à montrer, un joueur qui n'a pas encore
// marqué en compétition, une équipe qui n'a pas encore joué. Une carte
// « aucune performance » n'apprend rien et occupe une colonne.
// ============================================

interface PlayerGame {
  id: string;
  date: string | null;
  competition: string;
  opponent: string;
  goals: number;
  assists: number;
}

interface TeamGame {
  id: string;
  date: string | null;
  competition: string;
  opponent: string;
  scored: number;
  conceded: number;
  result: "W" | "D" | "L";
}

const RESULT_STYLE: Record<TeamGame["result"], string> = {
  W: "bg-emerald-600 text-white",
  D: "bg-gray-200 text-gray-600",
  L: "bg-red-500 text-white",
};

/** « 16 août », la date d'un match, sans l'année qui n'apprend rien ici. */
function shortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function PerformanceRail({ player, team }: {
  player?: string;
  team?: string;
}) {
  const [games, setGames] = useState<(PlayerGame | TeamGame)[] | null>(null);

  useEffect(() => {
    const q = player ? `player=${encodeURIComponent(player)}` : team ? `team=${encodeURIComponent(team)}` : null;
    // Ni joueur ni equipe : rien a demander. On sort sans toucher a l'etat,
    // un setState synchrone au montage relance un rendu pour rien.
    if (!q) return;

    let alive = true;
    fetch(`/api/public/performances?${q}`)
      .then((r) => (r.ok ? r.json() : { games: [] }))
      .then((d) => { if (alive) setGames(d.games ?? []); })
      .catch(() => { if (alive) setGames([]); });
    return () => { alive = false; };
  }, [player, team]);

  // Rien tant qu'on ne sait pas, rien s'il n'y a rien : ce rail accompagne
  // une fiche, il ne doit pas lui prendre 320px pour afficher un spinner
  // suivi d'un vide. La colonne apparait quand elle a quelque chose a dire.
  if (games === null || games.length === 0) return null;

  return (
    <section aria-labelledby="rail-performances">
      <h2
        id="rail-performances"
        className="border-b border-gray-200/70 pb-3 text-[11px] font-black uppercase tracking-[0.15em] text-gray-400"
      >
        Dernières performances
      </h2>

      <ul className="divide-y divide-gray-200/70">
          {games.map((g) => (
            <li key={g.id} className="py-3">
              <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                {g.competition}
                {g.date && <span className="text-gray-300"> · {shortDate(g.date)}</span>}
              </p>

              <div className="mt-1 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-900">
                  {g.opponent}
                </span>

                {"result" in g ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-display text-sm font-black tabular-nums text-gray-900">
                      {g.scored} – {g.conceded}
                    </span>
                    <span
                      title={g.result === "W" ? "Victoire" : g.result === "D" ? "Nul" : "Défaite"}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-black ${RESULT_STYLE[g.result]}`}
                    >
                      {g.result === "W" ? "V" : g.result === "D" ? "N" : "D"}
                    </span>
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em]">
                    {g.goals > 0 && (
                      <span className="text-emerald-700">{g.goals} but{g.goals > 1 ? "s" : ""}</span>
                    )}
                    {g.assists > 0 && (
                      <span className="text-gray-500">{g.assists} passe{g.assists > 1 ? "s" : ""}</span>
                    )}
                  </span>
                )}
              </div>
            </li>
          ))}
      </ul>
    </section>
  );
}
