import { computeTopScorers, type TopScorer } from "@/lib/performances-competition";
import type { CompMatch } from "@/types";

// ============================================
// L'affiche des meilleurs buteurs d'une compétition, après une journée.
//
// Demande du propriétaire du produit, 2026-11-01 : sortir l'affiche des
// meilleurs buteurs après chaque journée. Le classement est celui de l'onglet
// Buteurs de la page publique (lib/performances-competition,
// `computeTopScorers`) : ni contre son camp, ni but annulé par la VAR, ni
// dossard sans nom, ni match d'exhibition. L'affiche et le site comptent pareil.
//
// DEUX CHOIX. Après la journée N : les matchs de poule des journées 1 à N (une
// journée n'existe qu'en phase de poules, voir lib/journees). À ce jour : tous
// les matchs, phase finale comprise — une fois les poules finies, c'est le
// classement qui compte.
//
// Module pur : la route, la fenêtre de l'organisateur et
// scripts/test-affiche-buteurs.ts s'en servent.
// ============================================

export type ChoixDesButeurs = { journee: number } | { aCeJour: true };

/** Dix buteurs au plus : au-delà, les lignes ne se lisent plus sur un téléphone. */
export const BUTEURS_PAR_AFFICHE = 10;

/**
 * Le choix lu dans l'adresse : `?journee=2` ou `?a-ce-jour=1`, jamais les
 * deux. `null` pour une adresse bricolée : la route répond 400.
 */
export function lireChoixDesButeurs(params: URLSearchParams): ChoixDesButeurs | null {
  const journee = params.get("journee");
  const aCeJour = params.get("a-ce-jour");
  if (journee != null && aCeJour != null) return null;
  if (aCeJour != null) return aCeJour === "1" ? { aCeJour: true } : null;
  if (journee == null || !/^\d{1,3}$/.test(journee)) return null;
  const n = Number(journee);
  return n >= 1 ? { journee: n } : null;
}

/** Les matchs que le choix compte. */
export function matchsDuChoix(matchs: CompMatch[], choix: ChoixDesButeurs): CompMatch[] {
  if ("aCeJour" in choix) return matchs;
  return matchs.filter((m) => m.stage === "group" && m.journee != null && m.journee <= choix.journee);
}

/**
 * Les journées qu'on peut choisir : celles dont au moins un match a été joué
 * ou se joue. Une journée qui n'a pas commencé n'a rien à ajouter à la
 * précédente.
 */
export function journeesJouees(matchs: CompMatch[]): number[] {
  const jouees = new Set<number>();
  for (const m of matchs) {
    if (m.stage !== "group" || m.journee == null) continue;
    if (m.status === "completed" || m.status === "live") jouees.add(m.journee);
  }
  return [...jouees].sort((a, b) => a - b);
}

export interface LigneDesButeurs extends TopScorer {
  /** Le rang, partagé par les ex aequo : 1, 1, 3. */
  rang: number;
}

/**
 * Le classement de l'affiche : les buteurs du choix, dix au plus, chacun avec
 * son rang. Deux joueurs à égalité de buts partagent le rang ; l'ordre entre
 * eux reste celui du nom, comme sur le site.
 */
export function classementDeLAffiche(
  matchs: CompMatch[],
  choix: ChoixDesButeurs,
  max = BUTEURS_PAR_AFFICHE,
): LigneDesButeurs[] {
  const buteurs = computeTopScorers(matchsDuChoix(matchs, choix));
  return buteurs.slice(0, max).map((b) => ({
    ...b,
    rang: 1 + buteurs.filter((x) => x.goals > b.goals).length,
  }));
}

/** Le surtitre : « APRÈS LA JOURNÉE 2 », ou « À CE JOUR ». */
export function momentDesButeurs(choix: ChoixDesButeurs): string {
  return "aCeJour" in choix ? "À CE JOUR" : `APRÈS LA JOURNÉE ${choix.journee}`;
}
