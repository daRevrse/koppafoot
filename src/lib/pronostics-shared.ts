// ============================================
// Les pronostics d'un match, sans SDK : les issues, les comptes, et la part de
// chacune. Partagé avec l'application mobile ; lib/predictions (le client
// Firestore du site) le ré-exporte.
// ============================================

import { repartirCent } from "@/lib/repartition";

export type Pick = "home" | "draw" | "away";

export interface PredictionCounts {
  home: number;
  draw: number;
  away: number;
  total: number;
}

export const EMPTY_COUNTS: PredictionCounts = { home: 0, draw: 0, away: 0, total: 0 };

/**
 * Les pourcentages affiches, avec une voix d'office par issue.
 *
 * Sans elle, le premier votant envoie son camp a 100% et les deux autres a
 * 0%. Un match nul « impossible » parce qu'une personne a clique, ce n'est
 * pas un pronostic, c'est un artefact d'arrondi. Les trois voix de base
 * amortissent les tout premiers votes et disparaissent dans le bruit des
 * suivants.
 *
 * Elles ne comptent QUE pour les pourcentages : le nombre de pronostics
 * annonce reste le vrai, sans quoi on afficherait trois votes fantomes sur
 * un match que personne n'a encore joue.
 *
 * LES TROIS PARTS FONT CENT. Chacune etait arrondie de son cote, et trois
 * tiers donnaient 99 : la barre du pronostic prend sa largeur au pourcentage,
 * le point manquant s'y serait vu. Voir lib/repartition.
 */
export const VOIX_DE_BASE = 1;

export function pourcentages(counts: PredictionCounts): { home: number; draw: number; away: number } {
  return repartirCent({
    home: counts.home + VOIX_DE_BASE,
    draw: counts.draw + VOIX_DE_BASE,
    away: counts.away + VOIX_DE_BASE,
  });
}
