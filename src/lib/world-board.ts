// Server-only. Les matchs du football mondial, dans la forme du tableau du
// Direct.
//
// Un seul appel sortant : `/matches` chez football-data.org rend les matchs
// du jour de TOUTES les compétitions du plan d'un coup (voir
// getTodayFootball). Interroger les treize compétitions une par une aurait
// coûté trente-neuf appels pour le même écran, très au-delà du quota gratuit.
//
// Les matchs sont rendus dans la forme d'un `CompMatch` et regroupés par
// compétition, comme les amicaux : le tableau ne connaît que ce format, et
// lui apprendre un second aurait dupliqué tout le rendu.

import { getTodayFootball } from "@/lib/football-data";
import type { CompMatch, Competition } from "@/types";
import { WORLD_COMP_PREFIX } from "@/lib/world-board-shared";

/** Une compétition mondiale telle que le tableau la regroupe. */
function worldCompetition(name: string, code: string | null, emblem: string | null): Competition {
  return {
    // Le code quand on l'a — il permet le lien vers la page de la
    // compétition. Sinon le nom, qui suffit à regrouper.
    id: `${WORLD_COMP_PREFIX}${code ?? name}`,
    name,
    slug: code ?? "",
    logoUrl: emblem,
    bannerUrl: null,
    status: "group_stage",
    organizerName: null,
    startDate: null,
    endDate: null,
    venueCity: null,
    updatedAt: "",
  } as Competition;
}

/** « 2026-08-19 » et « 19:00 » depuis un instant ISO en UTC. */
function splitDate(utc: string): { date: string | null; time: string | null } {
  const d = new Date(utc);
  if (Number.isNaN(d.getTime())) return { date: null, time: null };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export interface WorldGroup {
  competition: Competition;
  matches: CompMatch[];
}

/**
 * Les matchs du jour du football mondial, groupés par compétition.
 *
 * Dégrade en liste vide : quota atteint, jeton absent ou fournisseur muet, le
 * tableau se contente alors du football togolais.
 */
export async function getWorldBoard(): Promise<WorldGroup[]> {
  try {
    const { live, finished, upcoming } = await getTodayFootball();

    const byComp = new Map<string, WorldGroup>();

    const push = (
      m: (typeof live)[number],
      status: CompMatch["status"],
    ) => {
      const { date, time } = splitDate(m.utcDate);
      if (!date) return;

      const comp = worldCompetition(m.competition.name, m.competition.code, m.competition.emblem);
      const group = byComp.get(comp.id) ?? { competition: comp, matches: [] };

      group.matches.push({
        id: String(m.id),
        competitionId: comp.id,
        stage: "group",
        group: null,
        round: null,
        bracketSlot: null,
        homeSource: null,
        awaySource: null,
        homeTeamId: null,
        awayTeamId: null,
        homeTeamName: m.home.name,
        awayTeamName: m.away.name,
        homeTeamLogo: m.home.crest,
        awayTeamLogo: m.away.crest,
        bannerUrl: null,
        date,
        time,
        venueName: null,
        venueCity: null,
        status,
        scoreHome: m.scoreHome,
        scoreAway: m.scoreAway,
        penaltyHome: null,
        penaltyAway: null,
        winnerTeamId: null,
        forfeitByTeamId: null,
        feedsIntoMatchId: null,
        feedsIntoSlot: null,
        homeLineup: [],
        awayLineup: [],
        homeLineupReady: false,
        awayLineupReady: false,
        homeOnPitch: [],
        awayOnPitch: [],
        liveState: null,
        createdAt: "",
        updatedAt: "",
      } as CompMatch);

      byComp.set(comp.id, group);
    };

    for (const m of live) push(m, "live");
    for (const m of finished) push(m, "completed");
    for (const m of upcoming) push(m, "scheduled");

    return [...byComp.values()];
  } catch (err) {
    console.error("getWorldBoard failed:", err);
    return [];
  }
}
