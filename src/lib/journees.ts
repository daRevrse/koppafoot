import type { CompMatchStage } from "@/types";

// ============================================
// Les journées d'une compétition.
//
// UNE JOURNÉE EST UN TOUR, PAS UNE DATE, décidé le 2026-10-22 : le tour où
// chaque équipe d'une poule joue une fois, même s'il s'étale sur trois
// dimanches. La journée 2, c'est le deuxième tour de toutes les poules à la
// fois. En aller-retour, la numérotation continue : une poule de quatre joue
// les journées 1 à 3 à l'aller, 4 à 6 au retour.
//
// Seuls les matchs de poule en ont une (`stage === "group"`) : la phase
// finale garde son tour, l'exhibition n'en a pas.
//
// Deux sources. Une poule générée reçoit ses journées de la méthode du cercle
// (`rencontresAvecJournee`), qui les connaît. Une poule générée avant les
// journées, ou importée, se voit PROPOSER une numérotation
// (`proposerJournees`), que l'organisateur accepte avant qu'elle s'écrive.
//
// Module pur : aucun SDK.
// ============================================

const EXEMPT = "__BYE__";

/**
 * Les tours de la méthode du cercle : la première équipe reste en place, les
 * autres tournent. Une poule impaire reçoit un exempt, retiré des tours : une
 * équipe s'y repose à chaque journée.
 */
export function toursDuCercle(equipes: string[]): [string, string][][] {
  const ids = [...equipes];
  if (ids.length % 2 !== 0) ids.push(EXEMPT);
  const n = ids.length;
  const tours: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const tour: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i], b = ids[n - 1 - i];
      if (a !== EXEMPT && b !== EXEMPT) tour.push([a, b]);
    }
    tours.push(tour);
    ids.splice(1, 0, ids.pop() as string);
  }
  return tours;
}

/** Les rencontres d'une poule à générer, chacune avec sa journée. Le retour inverse les camps. */
export function rencontresAvecJournee(
  equipes: string[],
  allerRetour: boolean,
): { home: string; away: string; journee: number }[] {
  const tours = toursDuCercle(equipes);
  const aller = tours.flatMap((tour, t) => tour.map(([home, away]) => ({ home, away, journee: t + 1 })));
  if (!allerRetour) return aller;
  return [...aller, ...aller.map((r) => ({ home: r.away, away: r.home, journee: r.journee + tours.length }))];
}

/** Combien de journées une poule doit compter : n − 1 pour n pair, n pour n impair (un exempt), le double en aller-retour. */
export function journeesAttendues(nEquipes: number, allerRetour: boolean): number {
  const tours = nEquipes % 2 === 0 ? nEquipes - 1 : nEquipes;
  return allerRetour ? 2 * tours : tours;
}

/** Ce qu'il faut d'un match pour le numéroter. */
export interface MatchANumeroter {
  id: string;
  stage: CompMatchStage;
  group: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  date: string | null;
  time: string | null;
  journee: number | null;
}

const paire = (m: MatchANumeroter) => [m.homeTeamId, m.awayTeamId].sort().join("|");
const cleDeTri = (m: MatchANumeroter) => `${m.date ?? "9999-99-99"}|${m.time || "99:99"}|${m.id}`;

/**
 * La numérotation proposée pour les matchs de poule qui n'ont pas encore de
 * journée.
 *
 * Poule par poule, dans l'ordre des dates (les matchs sans date à la fin),
 * chaque match va dans la plus petite journée où aucune de ses deux équipes
 * ne joue déjà. Les journées déjà posées comptent et ne bougent JAMAIS : la
 * proposition ne fait que compléter.
 *
 * En aller-retour (une paire qui se rencontre deux fois), la première
 * rencontre est l'aller, la seconde le retour : les allers d'abord, puis les
 * retours à partir de la journée qui suit le dernier aller de la poule.
 *
 * Sur une poule de quatre, il n'existe qu'une façon de former trois tours : la
 * proposition est forcément juste. Plus grande, une poule mal datée peut
 * demander plus de journées qu'il n'en faut : `depassement` le dit, pour que
 * l'organisateur le sache avant d'accepter.
 */
export function proposerJournees(matchs: MatchANumeroter[]): { journees: Map<string, number>; depassement: boolean } {
  const journees = new Map<string, number>();
  let depassement = false;

  const poules = new Map<string, MatchANumeroter[]>();
  for (const m of matchs) {
    if (m.stage !== "group" || !m.homeTeamId || !m.awayTeamId) continue;
    const cle = m.group ?? "";
    poules.set(cle, [...(poules.get(cle) ?? []), m]);
  }

  for (const poule of poules.values()) {
    const tries = [...poule].sort((a, b) => cleDeTri(a).localeCompare(cleDeTri(b)));

    // L'aller d'une paire est sa première rencontre dans l'ordre des dates.
    const vues = new Set<string>();
    const estAller = new Map<string, boolean>();
    for (const m of tries) {
      estAller.set(m.id, !vues.has(paire(m)));
      vues.add(paire(m));
    }
    const allerRetour = tries.some((m) => !estAller.get(m.id));

    // Qui joue déjà dans chaque journée, journées posées comprises.
    const occupees = new Map<number, Set<string>>();
    const occuper = (j: number, m: MatchANumeroter) => {
      const equipes = occupees.get(j) ?? new Set<string>();
      equipes.add(m.homeTeamId!).add(m.awayTeamId!);
      occupees.set(j, equipes);
    };
    for (const m of tries) if (m.journee != null) occuper(m.journee, m);

    const placer = (m: MatchANumeroter, plancher: number) => {
      let j = plancher;
      while (occupees.get(j)?.has(m.homeTeamId!) || occupees.get(j)?.has(m.awayTeamId!)) j++;
      journees.set(m.id, j);
      occuper(j, m);
    };

    for (const m of tries) if (m.journee == null && estAller.get(m.id)) placer(m, 1);

    const journeeDe = (m: MatchANumeroter) => m.journee ?? journees.get(m.id) ?? 0;
    const dernierAller = Math.max(0, ...tries.filter((m) => estAller.get(m.id)).map(journeeDe));
    for (const m of tries) if (m.journee == null && !estAller.get(m.id)) placer(m, dernierAller + 1);

    const equipes = new Set(tries.flatMap((m) => [m.homeTeamId!, m.awayTeamId!]));
    const plusGrande = Math.max(0, ...tries.map(journeeDe));
    if (plusGrande > journeesAttendues(equipes.size, allerRetour)) depassement = true;
  }

  return { journees, depassement };
}
