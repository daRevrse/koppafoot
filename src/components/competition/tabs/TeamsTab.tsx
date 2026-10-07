"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { computeSquadStats } from "@/lib/player-stats";
import { matchDuration } from "@/lib/competition-format";
import { versHex } from "@/lib/couleurs-equipe";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";
import { usePhotosDesLignes } from "@/hooks/usePhotosDesComptes";
import type { Competition, CompMatch, CompTeam } from "@/types";

// ============================================
// L'onglet « Équipes » d'une compétition : chaque équipe inscrite, et ses
// joueurs avec leurs chiffres dans la compétition.
//
// TOUTES LES ÉQUIPES, qu'un manager les dirige ou non : une équipe saisie
// par l'organisateur a son effectif et ses matchs comme les autres, et c'est
// souvent la majorité dans un tournoi de quartier.
//
// LE MINIMUM : la liste, et sous chaque équipe ses joueurs avec matchs
// joués, buts et cartons — les mêmes chiffres que l'écran du manager (voir
// computeSquadStats). Le détail reste sur la fiche de l'équipe.
// ============================================

const T = textes(
  {
    aucune: "Aucune équipe inscrite.",
    joueurs: (n: number, feminin: boolean) =>
      `${n} ${feminin ? "joueuse" : "joueur"}${n > 1 ? "s" : ""}`,
    groupe: (g: string) => `Groupe ${g}`,
    disqualifiee: "Disqualifiée",
    effectifNonCommunique: "Effectif non communiqué.",
    fiche: "Fiche de l'équipe",
    joueur: (feminin: boolean) => (feminin ? "Joueuse" : "Joueur"),
    mj: "MJ",
    mjLong: "Matchs joués",
    buts: "Buts",
    jaunes: "Cartons jaunes",
    rouges: "Cartons rouges",
  },
  {
    aucune: "No team registered.",
    joueurs: (n: number) => `${n} player${n === 1 ? "" : "s"}`,
    groupe: (g: string) => `Group ${g}`,
    disqualifiee: "Disqualified",
    effectifNonCommunique: "Squad not provided.",
    fiche: "Team page",
    joueur: () => "Player",
    mj: "MP",
    mjLong: "Matches played",
    buts: "Goals",
    jaunes: "Yellow cards",
    rouges: "Red cards",
  },
);

/** Un carton, dessiné : les émojis changent d'un téléphone à l'autre. */
function Carton({ couleur, titre }: { couleur: "jaune" | "rouge"; titre: string }) {
  return (
    <span
      title={titre}
      aria-label={titre}
      className={`inline-block h-3 w-2.5 rounded-[1px] ${couleur === "jaune" ? "bg-amber-400" : "bg-red-600"}`}
    />
  );
}

function Ecusson({ team }: { team: CompTeam }) {
  const fond = versHex(team.color) ?? "#111827";
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden border border-gray-200/70 text-sm font-black text-white"
      style={team.logoUrl ? undefined : { backgroundColor: fond }}
    >
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={team.logoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        team.name?.[0]?.toUpperCase() || "?"
      )}
    </span>
  );
}

/** Les joueurs d'une équipe et leurs chiffres. Monté seulement quand l'équipe est ouverte. */
function EffectifChiffre({ competition, team, matches, feminin }: {
  competition: Competition;
  team: CompTeam;
  matches: CompMatch[];
  feminin: boolean;
}) {
  const t = useTextes(T);
  const lignes = useMemo(
    () => computeSquadStats(matches, team.id, team.players, matchDuration(competition.format)),
    [matches, team, competition.format],
  );
  const photos = usePhotosDesLignes(team.players, team.claimedByTeamId);

  return (
    <div className="border-t border-gray-200/70 bg-gray-50/60 px-4 py-3">
      {lignes.length === 0 ? (
        <p className="py-3 text-center text-xs font-bold text-gray-400">{t.effectifNonCommunique}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
              <th className="pb-2 text-left font-black">{t.joueur(feminin)}</th>
              <th className="w-10 pb-2 text-center font-black" title={t.mjLong}>{t.mj}</th>
              <th className="w-12 pb-2 text-center font-black">{t.buts}</th>
              <th className="w-8 pb-2 text-center"><Carton couleur="jaune" titre={t.jaunes} /></th>
              <th className="w-8 pb-2 text-center"><Carton couleur="rouge" titre={t.rouges} /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200/60">
            {lignes.map(({ player, stats }) => (
              <tr key={player.id}>
                <td className="py-2 pr-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PlayerAvatar name={player.name} photo={photos[player.id]} size={28} />
                    <span className="min-w-0 truncate font-bold text-gray-900">
                      {player.user_id ? (
                        <Link href={`/profile/${player.user_id}`} className="hover:text-emerald-700 hover:underline">
                          {player.name}
                        </Link>
                      ) : (
                        player.name
                      )}
                    </span>
                    {player.number && (
                      <span className="shrink-0 text-xs font-bold tabular-nums text-gray-400">#{player.number}</span>
                    )}
                  </span>
                </td>
                <td className="py-2 text-center tabular-nums text-gray-600">{stats.matchesPlayed}</td>
                <td className={`py-2 text-center font-black tabular-nums ${stats.goals ? "text-emerald-600" : "text-gray-300"}`}>
                  {stats.goals}
                </td>
                <td className={`py-2 text-center tabular-nums ${stats.yellowCards ? "text-gray-700" : "text-gray-300"}`}>
                  {stats.yellowCards}
                </td>
                <td className={`py-2 text-center tabular-nums ${stats.redCards ? "text-gray-700" : "text-gray-300"}`}>
                  {stats.redCards}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Link
        href={`/c/${competition.slug}/teams/${team.id}`}
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 hover:underline"
      >
        {t.fiche} <ChevronRight size={13} />
      </Link>
    </div>
  );
}

export default function TeamsTab({ competition, matches, teams }: {
  competition: Competition;
  matches: CompMatch[];
  teams: CompTeam[];
}) {
  const t = useTextes(T);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const feminin = competition.category === "women";

  // Par groupe, puis par nom. Le groupe ne s'affiche que s'il y en a
  // plusieurs : « Groupe A » sur toutes les lignes d'un championnat ne dit rien.
  const rangees = useMemo(
    () => [...teams].sort((a, b) =>
      (a.group ?? "").localeCompare(b.group ?? "") || a.name.localeCompare(b.name)),
    [teams],
  );
  const plusieursGroupes = new Set(teams.map((e) => e.group).filter(Boolean)).size > 1;

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Users size={26} strokeWidth={1.3} className="text-gray-300" />
        <p className="text-sm font-bold text-gray-400">{t.aucune}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-200/70 border border-gray-200/70">
      {rangees.map((team) => {
        const ouvert = ouverte === team.id;
        return (
          <li key={team.id}>
            <button
              type="button"
              onClick={() => setOuverte(ouvert ? null : team.id)}
              aria-expanded={ouvert}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50"
            >
              <Ecusson team={team} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-base font-black tracking-tight text-gray-900">
                  {team.name}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] font-bold text-gray-400">
                  {plusieursGroupes && team.group && <span>{t.groupe(team.group)}</span>}
                  <span>{t.joueurs(team.players.length, feminin)}</span>
                  {team.disqualified && (
                    <span className="bg-red-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-red-600">
                      {t.disqualifiee}
                    </span>
                  )}
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-gray-400 transition-transform ${ouvert ? "rotate-180" : ""}`}
              />
            </button>
            {ouvert && <EffectifChiffre competition={competition} team={team} matches={matches} feminin={feminin} />}
          </li>
        );
      })}
    </ul>
  );
}
