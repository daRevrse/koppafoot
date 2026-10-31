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

import { unstable_cache } from "next/cache";
import { getTodayFootball, type TodayFootball } from "@/lib/football-data";
import type { CompMatch, Competition } from "@/types";
import { WORLD_COMP_PREFIX } from "@/lib/world-board-shared";

/**
 * Le tableau gardé ne sert plus au-delà : ses matchs « en direct » seraient finis
 * depuis longtemps. Un jeton retiré ne doit pas figer le Direct pour toujours.
 */
const ANCIENNETE_MAX = 3 * 60 * 60 * 1000;

/** Une compétition mondiale telle que le tableau la regroupe. */
function worldCompetition(name: string, code: string | null, emblem: string | null): Competition {
  return {
    // Le code quand on l'a, il permet le lien vers la page de la
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

/** Les matchs reçus, groupés par compétition, dans la forme du tableau. */
function grouperParCompetition({ live, finished, upcoming }: TodayFootball): WorldGroup[] {
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
      venueId: null,
      venueBooking: null,
      status,
      scoreHome: m.scoreHome,
      scoreAway: m.scoreAway,
      penaltyHome: null,
      penaltyAway: null,
      winnerTeamId: null,
      journee: null,
      chaud: false,
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
}

/**
 * UNE PANNE NE SE MET PAS EN CACHE COMME UN RÉSULTAT. Quand la page ou /api/direct
 * se régénère, un `fetch` périmé est refait au premier plan : un 429 du fournisseur
 * (dix requêtes par minute, plan gratuit) donnait alors un tableau sans le monde,
 * gardé 60 s pour tout le monde, et l'écran disait « Aucun match ce jour-là ».
 *
 * `unstable_cache` garde le dernier résultat quand son calcul lève, et réessaie à la
 * lecture suivante. Le reste du Direct, lui, continue de se rafraîchir : lever depuis
 * la page aurait figé aussi le football togolais le temps de la panne. `use cache`
 * le remplace dans Next 16, mais demande Cache Components sur tout le site.
 */
const lireLeTableau = unstable_cache(
  async () => ({ groupes: grouperParCompetition(await getTodayFootball()), composeA: Date.now() }),
  ["tableau-du-monde"],
  { revalidate: 90 },
);

/**
 * Le football mondial du Direct, groupé par compétition : le dernier tableau reçu si
 * le fournisseur est en panne. Sans rien de gardé (jeton absent, fournisseur muet à
 * la construction du site), dégrade en liste vide : le tableau se contente alors du
 * football togolais.
 */
export async function getWorldBoard(): Promise<WorldGroup[]> {
  try {
    const { groupes, composeA } = await lireLeTableau();
    if (Date.now() - composeA <= ANCIENNETE_MAX) return groupes;
    console.warn("getWorldBoard: fournisseur en panne depuis trop longtemps, tableau retiré");
    return [];
  } catch (err) {
    console.error("getWorldBoard failed:", err);
    return [];
  }
}
