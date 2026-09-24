// ============================================
// Le tableau du Direct, sans écran : filtrer, grouper, fondre le temps réel.
//
// Les règles sont celles de DirectHomeV2, et ses briques viennent de
// lib/direct-shared (minute, ordre, clé de tri) : l'application n'en invente
// aucune. Le filtre Favoris lit les compétitions suivies PAR LE COMPTE,
// comme le Direct du site une fois connecté.
// ============================================

import { kickoff, ordreDesCompetitions, type CompetitionFeed, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";

export type FiltreDirect = "tous" | "direct" | "favoris";

export interface GroupeDirect {
  competition: Competition;
  entries: Entry[];
}

export interface OptionsTableau {
  /** « 2026-09-24 », voir lib/dates. */
  jour: string;
  filtre: FiltreDirect;
  /** Les compétitions suivies par le compte. */
  suivies: ReadonlySet<string>;
}

export function entreesDuFlux(feed: CompetitionFeed[]): Entry[] {
  return feed.flatMap((f) => f.matches.map((match) => ({ match, competition: f.competition })));
}

/**
 * Les groupes à afficher.
 *
 * Le jour filtre, sauf deux exceptions reprises du site : UN MATCH EN COURS
 * ÉCHAPPE AU FILTRE DE JOUR (il se joue maintenant, quelle que soit la date
 * de sa fiche), et les favoris aussi (on suit une compétition sur toute sa
 * durée, un onglet vide un jour sans match ferait croire à une panne).
 */
export function groupesDuTableau(feed: CompetitionFeed[], { jour, filtre, suivies }: OptionsTableau): GroupeDirect[] {
  const toutes = entreesDuFlux(feed);
  let liste =
    filtre === "favoris"
      ? toutes.filter((e) => suivies.has(e.competition.id))
      : toutes.filter((e) => e.match.date === jour || e.match.status === "live");
  if (filtre === "direct") liste = liste.filter((e) => e.match.status === "live");
  liste = [...liste].sort((a, b) => kickoff(a).localeCompare(kickoff(b)));

  const parCompetition = new Map<string, GroupeDirect>();
  for (const e of liste) {
    const groupe = parCompetition.get(e.competition.id) ?? { competition: e.competition, entries: [] };
    groupe.entries.push(e);
    parCompetition.set(e.competition.id, groupe);
  }
  return [...parCompetition.values()].sort((a, b) => ordreDesCompetitions(a.entries, b.entries));
}

/**
 * Le jour joué le plus proche quand celui choisi est vide : un calendrier
 * amateur a des trous, et un tableau blanc a l'air cassé. Le prochain jour
 * l'emporte sur le dernier joué, comme sur le site.
 */
export function jourLePlusProche(feed: CompetitionFeed[], jour: string): string | null {
  const dates = [
    ...new Set(entreesDuFlux(feed).map((e) => e.match.date).filter((d): d is string => d != null)),
  ].sort();
  return dates.find((d) => d > jour) ?? [...dates].reverse().find((d) => d < jour) ?? null;
}

export function compterEnDirect(feed: CompetitionFeed[]): number {
  return entreesDuFlux(feed).filter((e) => e.match.status === "live").length;
}

/** Ce que l'écouteur d'une compétition vient de dire. */
export function remplacerMatchs(feed: CompetitionFeed[], cid: string, matches: CompMatch[]): CompetitionFeed[] {
  return feed.map((f) => (f.competition.id === cid ? { ...f, matches } : f));
}

/**
 * Les amicaux en cours, venus de l'écouteur. Ils vivent dans `matches`, pas
 * dans une sous-collection : l'écouteur par compétition ne les voit pas. On
 * remplace ceux dont il donne des nouvelles, on garde les autres (les amicaux
 * à venir de la réponse de l'API).
 */
export function fusionnerAmicaux(feed: CompetitionFeed[], frais: CompMatch[]): CompetitionFeed[] {
  const idsFrais = new Set(frais.map((m) => m.id));
  const groupe = feed.find((f) => f.competition.id === FRIENDLY_COMP_ID);
  const inchanges = (groupe?.matches ?? []).filter((m) => !idsFrais.has(m.id));
  const matches = [...frais, ...inchanges];
  if (matches.length === 0 || (frais.length === 0 && groupe)) return feed;
  return groupe
    ? feed.map((f) => (f.competition.id === FRIENDLY_COMP_ID ? { ...f, matches } : f))
    : [...feed, { competition: FRIENDLY_COMPETITION, matches }];
}

/**
 * La réponse de l'API, corrigée par ce que les écouteurs savent déjà.
 *
 * L'API est mise en cache 60 s ; un écouteur, lui, est à jour. Quand un
 * rafraîchissement revient APRÈS le premier instantané d'un écouteur (au
 * retour au premier plan, les deux partent ensemble), il écraserait un score
 * frais par un score vieux d'une minute — et l'écouteur ne redirait rien
 * avant le prochain but.
 */
export function appliquerEcoutes(
  board: CompetitionFeed[],
  parCompetition: ReadonlyMap<string, CompMatch[]>,
  amicaux: CompMatch[] | null,
): CompetitionFeed[] {
  const avecCompetitions = board.map((f) => {
    const matches = parCompetition.get(f.competition.id);
    return matches ? { ...f, matches } : f;
  });
  return amicaux ? fusionnerAmicaux(avecCompetitions, amicaux) : avecCompetitions;
}
