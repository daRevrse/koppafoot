import type { Href } from "expo-router";
import type { Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";

/**
 * L'écran natif d'un match du Direct, ou `null` quand il n'en a pas.
 *
 * Un match du monde n'a pas de fiche, sur le site non plus (voir `matchHref`
 * dans lib/direct-shared) : on n'a ni sa feuille, ni ses buteurs. Il ouvre la
 * page de sa compétition.
 */
export function routeDuMatch(e: Entry): Href | null {
  if (e.competition.id === FRIENDLY_COMP_ID) return { pathname: "/amical/[id]", params: { id: e.match.id } };
  if (isWorldComp(e.competition.id)) return null;
  return { pathname: "/match/[cid]/[mid]", params: { cid: e.competition.id, mid: e.match.id } };
}

/**
 * La page native d'une compétition, ou `null` quand elle n'en a pas : les
 * amicaux ne forment pas une compétition, et une compétition du monde n'a
 * que sa page du site (voir `competitionHref` dans lib/direct-shared).
 */
export function routeDeLaCompetition(c: { id: string }): Href | null {
  if (c.id === FRIENDLY_COMP_ID || isWorldComp(c.id)) return null;
  return { pathname: "/competition/[cid]", params: { cid: c.id } };
}
