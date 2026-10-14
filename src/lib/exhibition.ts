import type { CompMatchStage } from "@/types";

// ============================================
// Le match d'exhibition : joué dans la compétition, compté nulle part.
//
// Un match de gala avant la finale, une équipe de partenaires contre les
// anciens : on le couvre en direct comme les autres, avec ses feuilles, sa
// console et sa fiche. Mais il ne fait pas la compétition. Ni classement de
// poule, ni tableau, ni buteurs, ni statistiques d'un joueur, ni bilan d'un
// club, ni classement de la plateforme.
//
// LA RÈGLE VIT ICI, et chaque calcul la demande : un buteur de match de gala
// qui remonterait au classement des buteurs, c'est un trophée volé à
// quelqu'un qui a joué le tournoi.
//
// Les classements de poule et le tableau n'ont rien à demander : ils ne
// retiennent déjà que leurs propres étapes (`group`, `knockout`).
//
// Module pur : le navigateur et le serveur le partagent.
// ============================================

/** Ce qui suffit pour juger un match : son étape, quand il en a une. */
interface AvecEtape {
  stage?: CompMatchStage | null;
}

/** Un match d'exhibition ? Un amical, qui n'a pas d'étape, n'en est pas un. */
export function estExhibition(match: AvecEtape): boolean {
  return match.stage === "exhibition";
}

/** Les matchs qui comptent : tous, sauf ceux d'exhibition. */
export function matchsQuiComptent<T extends AvecEtape>(matchs: T[]): T[] {
  return matchs.filter((m) => !estExhibition(m));
}
