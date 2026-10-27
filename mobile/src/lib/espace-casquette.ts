import { seChevauchent } from "@/lib/terrains";
import type { Booking, CompMatch, Competition, Match } from "@/types";

// L'onglet Espace casquette : ce qu'un compte a à faire avec ses casquettes
// (lib/hats du site). Les filtres sont ceux des pages du site qu'il résume,
// /live-ops et /mes-terrains, pour que les deux disent la même chose.

const parDateEtHeure = (a: { date: string | null; time: string | null }, b: { date: string | null; time: string | null }) =>
  `${a.date ?? ""}${a.time ?? "99:99"}`.localeCompare(`${b.date ?? ""}${b.time ?? "99:99"}`);

/**
 * Les matchs confiés un par un qui ont encore une console à tenir : un match
 * terminé se consulte depuis sa fiche, pas depuis un poste de commande (le
 * filtre de /live-ops).
 */
export function matchsConfiesATenir(matchs: Match[]): Match[] {
  return matchs.filter((m) => m.status !== "completed" && m.status !== "cancelled").sort(parDateEtHeure);
}

/** « Scoreur de Koffi · « Les Sifflets » » : un arbitre de son corps arbitral nous a confié sa console. */
export function confiePar(m: Match, uid: string): string | null {
  if (m.equipeArbitrale?.scoreur?.uid !== uid || !m.refereeName) return null;
  const corps = m.equipeArbitrale.corpsNom;
  return `Scoreur de ${m.refereeName}${corps ? ` · « ${corps} »` : ""}`;
}

/** Les amicaux à venir que personne ne couvre, le plus proche d'abord (onAmicauxSansScoreur). */
export function amicauxACouvrir(matchs: Match[]): Match[] {
  return matchs.filter((m) => (m.moderatorIds ?? []).length === 0).sort(parDateEtHeure);
}

/**
 * Plusieurs listes de compétitions en une : chacune une fois, à la place de
 * sa première apparition, sans les bacs à sable de la console (de
 * l'entraînement, pas du travail).
 */
export function competitionsSansDoublon(listes: Competition[][]): Competition[] {
  const vues = new Set<string>();
  const out: Competition[] = [];
  for (const c of listes.flat()) {
    if (c.isSandbox || vues.has(c.id)) continue;
    vues.add(c.id);
    out.push(c);
  }
  return out;
}

/**
 * Les matchs d'une compétition ce jour-là, par heure. Un match terminé reste :
 * c'est la journée qu'on tient ; un match annulé, non.
 */
export function matchsDuJour(matchs: CompMatch[], jour: string): CompMatch[] {
  return matchs.filter((m) => m.date === jour && m.status !== "cancelled").sort(parDateEtHeure);
}

/**
 * Ce qu'un propriétaire a à traiter. À répondre : les demandes en attente pour
 * aujourd'hui ou plus tard (un créneau passé n'appelle plus de réponse), à
 * commencer par qui attend depuis le plus longtemps. Du jour : les
 * réservations confirmées d'aujourd'hui, par heure ; un créneau que le
 * propriétaire a bloqué lui-même n'est la réservation de personne.
 */
export function reservationsATraiter(resas: Booking[], jour: string): { aRepondre: Booking[]; duJour: Booking[] } {
  return {
    aRepondre: resas
      .filter((b) => b.status === "pending" && b.date >= jour)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    duJour: resas
      .filter((b) => b.status === "confirmed" && b.kind !== "blocage" && b.date === jour)
      .sort(parDateEtHeure),
  };
}

/**
 * Le créneau déjà pris (confirmé ou bloqué) qu'une demande recouvre sur le
 * même terrain, battement compris (`conflits` de /mes-terrains/reservations).
 * On ne l'interdit pas : le propriétaire connaît son terrain, il peut avoir
 * deux surfaces ; on le lui dit avant qu'il confirme.
 */
export function conflitDe(demande: Booking, resas: Booking[], battements: Record<string, number>): Booking | null {
  const battement = battements[demande.venueId] ?? 0;
  return (
    resas.find(
      (c) => c.id !== demande.id && c.status === "confirmed" && c.venueId === demande.venueId
        && seChevauchent(c, demande, battement),
    ) ?? null
  );
}

/** Qui demande : l'équipe quand la demande en porte une, sinon le compte. */
export const demandeur = (b: Booking) => b.teamName ?? b.userName;

export interface Sections {
  aTenir: boolean;
  competitions: boolean;
  terrains: boolean;
  sansCasquette: boolean;
}

/**
 * Les sections de l'onglet. Aucune section vide pour une casquette qu'on n'a
 * pas ; les matchs à tenir ne sont pas une casquette (n'importe quel compte
 * peut être nommé modérateur), mais un scoreur les voit toujours : les
 * amicaux à prendre et l'entraînement l'attendent. Sans rien de tout ça, la
 * présentation des casquettes.
 */
export function sectionsDeLEspace(e: {
  scoreur: boolean;
  organisateur: boolean;
  proprietaire: boolean;
  /** Matchs confiés et matchs du jour des compétitions tenues. */
  aTenir: number;
  /** Compétitions organisées ou modérées. */
  competitions: number;
}): Sections {
  const aTenir = e.aTenir > 0 || e.scoreur;
  const competitions = e.organisateur || e.competitions > 0;
  const terrains = e.proprietaire;
  return { aTenir, competitions, terrains, sansCasquette: !aTenir && !competitions && !terrains };
}

/** Les pages du site où l'on agit : la console, l'espace organisateur, les terrains, les candidatures. */
export const PAGES_DU_SITE = {
  console: "/live-ops",
  entrainement: "/live-ops/entrainement",
  consoleAmical: (id: string) => `/matches/${id}/manage`,
  consoleMatch: (cid: string, mid: string) => `/live-ops/${cid}/matches/${mid}/live`,
  gerer: (cid: string) => `/organizer/competitions/${cid}`,
  creer: "/organizer/competitions/new",
  terrains: "/mes-terrains",
  reservations: "/mes-terrains/reservations",
  candidatureOrganisateur: "/organisateurs/candidature",
  candidatureScoreur: "/scoreurs/candidature",
  candidatureTerrain: "/terrains/candidature",
} as const;
