// ============================================
// Le tableau du Direct, sans écran : filtrer, grouper, fondre le temps réel.
//
// Les règles sont celles de DirectHomeV2, et ses briques viennent de
// lib/direct-shared (minute, ordre, clé de tri) : l'application n'en invente
// aucune. Le filtre Favoris lit les compétitions suivies PAR LE COMPTE,
// comme le Direct du site une fois connecté.
// ============================================

import { cleDuJour, decalerDeJours, libelleDuJour } from "@/lib/dates";
import { kickoff, ordreDesCompetitions, type CompetitionFeed, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";
import type { Competition, CompMatch } from "@/types";

/**
 * Quand date le tableau qu'on montre faute de mieux. Passé aujourd'hui, le jour
 * aussi : l'heure seule ferait croire qu'il est de ce matin.
 */
export function libelleDeLaMiseAJour(majA: Date): string {
  const heure = `à ${majA.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
  const jour = cleDuJour(majA);
  const aujourdhui = cleDuJour(new Date());
  if (jour === aujourdhui) return heure;
  if (jour === decalerDeJours(aujourdhui, -1)) return `hier ${heure}`;
  return `le ${libelleDuJour(jour)} ${heure}`;
}

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

/** Une compétition du tableau, telle que la liste l'affiche : repliée ou non. */
export interface SectionDuDirect {
  key: string;
  competition: Competition;
  /** Les matchs affichés : aucun quand la compétition est repliée. */
  data: Entry[];
  /** Le nombre de matchs, replié ou non : l'en-tête l'affiche toujours. */
  nombre: number;
  repliee: boolean;
}

/**
 * Les sections de la liste. UNE COMPÉTITION REPLIÉE GARDE SON EN-TÊTE et son
 * nombre de matchs, comme sur le site (CompetitionGroup) : on replie ce qu'on
 * ne suit pas ce jour-là, on ne le perd pas.
 */
export function sectionsDuDirect(groupes: GroupeDirect[], replies: ReadonlySet<string>): SectionDuDirect[] {
  return groupes.map((g) => {
    const repliee = replies.has(g.competition.id);
    return {
      key: g.competition.id,
      competition: g.competition,
      data: repliee ? [] : g.entries,
      nombre: g.entries.length,
      repliee,
    };
  });
}

/** Le chevron d'un en-tête : replie une compétition ouverte, déplie une repliée. */
export function basculerRepli(replies: ReadonlySet<string>, cid: string): Set<string> {
  const suivantes = new Set(replies);
  if (suivantes.has(cid)) suivantes.delete(cid);
  else suivantes.add(cid);
  return suivantes;
}

/**
 * Le jour joué le plus proche quand celui choisi est vide : un calendrier
 * amateur a des trous, et un tableau blanc a l'air cassé. Le prochain jour
 * l'emporte sur le dernier joué, comme sur le site.
 */
export function jourLePlusProche(feed: CompetitionFeed[], jour: string): string | null {
  const dates = [...joursAvecMatchs(feed)].sort();
  return dates.find((d) => d > jour) ?? [...dates].reverse().find((d) => d < jour) ?? null;
}

/** Les jours qui ont au moins un match : un point sous leur case dans la frise. */
export function joursAvecMatchs(feed: CompetitionFeed[]): Set<string> {
  return new Set(entreesDuFlux(feed).map((e) => e.match.date).filter((d): d is string => d != null));
}

/**
 * Les cases de la frise : une semaine de part et d'autre d'aujourd'hui,
 * élargie jusqu'au jour choisi s'il en sort. « Voir mardi 30 » depuis un jour
 * vide doit tomber sur une case visible.
 *
 * Les clés « 2026-09-24 » se comparent comme des chaînes.
 */
export function joursDeLaFrise(aujourdhui: string, choisi: string, rayon = 7): string[] {
  let debut = decalerDeJours(aujourdhui, -rayon);
  let fin = decalerDeJours(aujourdhui, rayon);
  if (choisi < debut) debut = choisi;
  if (choisi > fin) fin = choisi;
  const jours: string[] = [];
  for (let j = debut; j <= fin; j = decalerDeJours(j, 1)) jours.push(j);
  return jours;
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
