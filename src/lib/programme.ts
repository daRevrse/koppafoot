import type { JourDuCalendrier } from "@/lib/calendrier-competition";
import type { CompMatch } from "@/types";

// ============================================
// Le programme d'une affiche « Journée X » / « Matchs du jour » : ce que
// l'organisateur choisit, les matchs que ce choix retient, le titre, et le
// découpage en pages. Voir docs/superpowers/specs/
// 2026-10-22-journees-et-affiche-du-jour-design.md.
//
// DEUX CHOIX. Une journée (lib/journees) : ses matchs de poule, sur toutes
// leurs dates. Des dates : tout ce qui s'y joue, phase finale et exhibitions
// comprises. Les matchs annulés sortent plus tard, avec le calendrier
// (lib/calendrier-competition), comme dans le PDF.
//
// Module pur : aucun SDK.
// ============================================

export type ChoixDuProgramme = { journee: number } | { dates: string[] };

/** Douze matchs au plus sur une affiche : au-delà, les lignes ne se lisent plus. */
export const MATCHS_PAR_AFFICHE = 12;

/** Quatorze dates au plus : deux semaines, plus que tout ce qu'une affiche peut tenir. */
const DATES_MAX = 14;

const dateValide = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`))
  && new Date(`${d}T00:00:00Z`).toISOString().startsWith(d);

/**
 * Le choix lu dans l'adresse de l'affiche : `?journee=2` ou
 * `?dates=2026-10-25,2026-11-01`, jamais les deux. `null` pour une adresse
 * bricolée : la route répond 400 plutôt qu'une affiche vide.
 */
export function lireChoix(params: URLSearchParams): ChoixDuProgramme | null {
  const journee = params.get("journee");
  const dates = params.get("dates");
  if (journee != null && dates != null) return null;
  if (journee != null) {
    if (!/^\d+$/.test(journee)) return null;
    const n = Number(journee);
    return n >= 1 ? { journee: n } : null;
  }
  if (dates == null) return null;
  const liste = [...new Set(dates.split(",").map((d) => d.trim()).filter(Boolean))].sort();
  if (liste.length === 0 || liste.length > DATES_MAX || !liste.every(dateValide)) return null;
  return { dates: liste };
}

/** Les matchs que le choix retient. */
export function selectionnerProgramme(matchs: CompMatch[], choix: ChoixDuProgramme): CompMatch[] {
  if ("journee" in choix) return matchs.filter((m) => m.stage === "group" && m.journee === choix.journee);
  const dates = new Set(choix.dates);
  return matchs.filter((m) => m.date != null && dates.has(m.date));
}

/** Le titre fendu de l'affiche. */
export function titreDuProgramme(choix: ChoixDuProgramme): string {
  if ("journee" in choix) return `JOURNÉE ${choix.journee}`;
  return choix.dates.length === 1 ? "MATCHS DU JOUR" : "AU PROGRAMME";
}

/**
 * Chaque date a-t-elle son intertitre ? Oui dès que le choix peut couvrir
 * plusieurs dates — une journée, plusieurs dates —, même quand une page n'en
 * montre qu'une : sans lui, la page 2 d'une journée ne disait pas quel jour.
 * Une seule date est déjà dans le surtitre.
 */
export function intertitresVisibles(choix: ChoixDuProgramme): boolean {
  return "journee" in choix || choix.dates.length > 1;
}

const joues = (m: CompMatch) => m.status !== "cancelled";
const datesTriees = (matchs: CompMatch[]) =>
  [...new Set(matchs.map((m) => m.date).filter((d): d is string => !!d))].sort();

/** Les journées qui ont des matchs, avec les dates qu'elles couvrent : la liste que l'organisateur choisit. */
export function journeesDisponibles(matchs: CompMatch[]): { journee: number; dates: string[] }[] {
  const parJournee = new Map<number, CompMatch[]>();
  for (const m of matchs) {
    if (m.stage !== "group" || m.journee == null || !joues(m)) continue;
    parJournee.set(m.journee, [...(parJournee.get(m.journee) ?? []), m]);
  }
  return [...parJournee.entries()]
    .sort(([a], [b]) => a - b)
    .map(([journee, l]) => ({ journee, dates: datesTriees(l) }));
}

/** Les jours qui ont des matchs. */
export function datesDisponibles(matchs: CompMatch[]): string[] {
  return datesTriees(matchs.filter(joues));
}

/**
 * Les jours du calendrier, en pages de `max` lignes au plus.
 *
 * On coupe entre deux jours quand le jour suivant tient entier sur une page
 * neuve : une affiche par samedi plutôt qu'un samedi à cheval. Un jour trop
 * long pour une page neuve finit la page en cours, puis continue ; il est
 * répété en tête de la page suivante, pour que chaque affiche dise de quel
 * jour elle parle.
 */
export function paginer(jours: JourDuCalendrier[], max = MATCHS_PAR_AFFICHE): JourDuCalendrier[][] {
  const pages: JourDuCalendrier[][] = [];
  let page: JourDuCalendrier[] = [];
  let place = max;
  const nouvellePage = () => {
    if (page.length) pages.push(page);
    page = [];
    place = max;
  };

  for (const jour of jours) {
    let lignes = jour.lignes;
    if (lignes.length > place && lignes.length <= max) nouvellePage();
    while (lignes.length > 0) {
      if (place === 0) nouvellePage();
      const prises = lignes.slice(0, place);
      page.push({ ...jour, lignes: prises });
      place -= prises.length;
      lignes = lignes.slice(prises.length);
    }
  }
  nouvellePage();
  return pages;
}
