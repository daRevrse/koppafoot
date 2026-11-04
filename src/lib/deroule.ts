// ============================================
// Le déroulé du match tel que la console le pilote : ce que les deux camps
// attendent ballon mort, le seul bouton que le bandeau propose à l'instant,
// et ce que devient la fin du temps de jeu.
//
// L'état du jeu (lib/etat-du-jeu) dit où en est le ballon. Ce module en tire
// ce que le scoreur doit faire ensuite. Il vivait dans le rendu de la console
// du site ; sorti, il se vérifie sans base (scripts/test-deroule.ts) et la
// console de l'application pourra le reprendre tel quel.
//
// Module pur, sans SDK.
// ============================================

import type { Cote, Jeu } from "@/lib/etat-du-jeu";

/**
 * Les périodes où l'on joue : les deux mi-temps (1, 3) et les deux
 * prolongations (6, 8). Ni l'avant-match, ni les pauses, ni la séance.
 */
export function estUnePeriodeDeJeu(periode: number | null | undefined): boolean {
  return [1, 3, 6, 8].includes(periode ?? 0);
}

/**
 * CE QUE LES PASTILLES DES DEUX CAMPS ATTENDENT, ballon mort : qui engage,
 * ou qui repart. Le camp désigné clignote ; quand personne n'est désigné
 * (le coup d'envoi, un arrêt de jeu), les deux attendent.
 */
export function attenteDesCamps(jeu: Jeu): { cotes: Cote[]; libelle: "Repart" | "Engage" } | null {
  if (jeu.balle === "en_jeu" || jeu.raison === "interruption" || jeu.raison === "penalty") return null;
  if (jeu.raison === "arret") return { cotes: ["home", "away"], libelle: "Repart" };
  return { cotes: jeu.engage ? [jeu.engage] : ["home", "away"], libelle: "Engage" };
}

export const CONSIGNE_ENGAGEMENT = "Qui engage ? Touche son équipe";
export const CONSIGNE_REPRISE = "Reprise : touche une équipe";

/** Le bouton du bandeau, ce qu'il fait ; la console le dessine. */
export type BoutonDuDeroule =
  /** Ballon en jeu, en période : déclarer un arrêt de jeu. */
  | { type: "arret_de_jeu" }
  /**
   * Avant le coup d'envoi : la consigne d'engagement, l'inversion des côtés,
   * et le retour aux feuilles tant que rien n'est arrivé.
   */
  | { type: "avant"; feuilles: boolean }
  /** Le camp qui engage est connu : l'engagement, d'un appui. */
  | { type: "engagement"; camp: Cote }
  /** Le ballon a un camp après un arrêt de jeu : la reprise, d'un appui. */
  | { type: "reprise"; camp: Cote }
  /** Un penalty attend son issue : rouvrir la question. */
  | { type: "penalty" }
  /** Le match est interrompu : le reprendre. */
  | { type: "reprendre_le_match" }
  /** Rien à appuyer, seulement quoi faire : toucher une équipe. */
  | { type: "consigne"; texte: string };

/**
 * LE BOUTON DU DÉROULÉ, un seul à la fois : ce que l'état du jeu attend.
 * Ballon en jeu, c'est « Arrêt de jeu » — l'ancien « Arrêter », qui
 * arrêtait le chrono, n'existe plus : la montre de l'arbitre ne s'arrête
 * pas sur une blessure.
 */
export function boutonDuDeroule(e: {
  jeu: Jeu;
  periode: number | null | undefined;
  /** Le camp qui a le ballon, ou `null`. */
  ballon: Cote | null;
  /** Un penalty accordé dont personne n'a encore dit l'issue. */
  penaltyEnAttente: boolean;
  /** Rien n'est encore arrivé : chrono jamais parti, aucun fait. */
  feuillesRouvrables: boolean;
}): BoutonDuDeroule | null {
  const { jeu } = e;
  if (jeu.balle === "en_jeu") return estUnePeriodeDeJeu(e.periode) ? { type: "arret_de_jeu" } : null;
  switch (jeu.raison) {
    case "avant":
      return { type: "avant", feuilles: e.feuillesRouvrables };
    case "but":
    case "mi_temps":
    case "pause":
      return jeu.engage ? { type: "engagement", camp: jeu.engage } : { type: "consigne", texte: CONSIGNE_ENGAGEMENT };
    case "arret":
      return e.ballon ? { type: "reprise", camp: e.ballon } : { type: "consigne", texte: CONSIGNE_REPRISE };
    case "penalty":
      return e.penaltyEnAttente ? { type: "penalty" } : { type: "consigne", texte: CONSIGNE_REPRISE };
    case "interruption":
      return { type: "reprendre_le_match" };
    default:
      return null;
  }
}

/**
 * LA FIN DU TEMPS DE JEU, à la 90e ou après les prolongations.
 *
 * À égalité en élimination directe, le match ne s'arrête pas : il part en
 * prolongations si le règlement en prévoit et qu'on sort de la seconde
 * mi-temps, sinon en tirs au but. Partout ailleurs, c'est la fin.
 */
export function apresLeTempsDeJeu(m: {
  stage: string | null | undefined;
  scoreHome: number;
  scoreAway: number;
  periode: number;
  /** La durée d'une prolongation, `null` ou 0 quand le règlement n'en prévoit pas. */
  prolongationMin: number | null | undefined;
}): "fin" | "prolongations" | "tirs_au_but" {
  if (m.stage !== "knockout" || m.scoreHome !== m.scoreAway) return "fin";
  if (m.periode === 3 && m.prolongationMin) return "prolongations";
  return "tirs_au_but";
}
