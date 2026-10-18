import { DETAIL_SECOND_JAUNE } from "@/lib/retrait-evenement";

// ============================================
// Les points de cartons d'une équipe, pour départager au classement.
//
// UN JAUNE VAUT 1, UN ROUGE 3, et l'équipe qui en a le moins passe devant.
// Le critère ne joue qu'à égalité parfaite — points, différence de buts,
// buts marqués — avant l'ordre alphabétique (voir lib/poules). C'est la règle
// de la compétition G2, qui départage ainsi ses troisièmes.
//
// UNE EXPULSION VAUT 3 EN TOUT, qu'elle vienne d'un rouge direct ou d'un
// second jaune. La console pose alors le second jaune ET un rouge marqué
// DETAIL_SECOND_JAUNE : compter 1 + 1 + 3 aurait puni deux jaunes plus
// durement qu'un rouge direct. Ce rouge-là n'ajoute donc que 1. La saisie
// après le match ne pose pas la marque : un rouge à un joueur qui a déjà
// deux jaunes dans le même match se lit de la même façon.
// ============================================

export const POINTS_JAUNE = 1;
export const POINTS_ROUGE = 3;

/** Ce qu'il faut d'un fait de match pour compter ses cartons. */
export interface FaitCarton {
  type: string;
  teamId: string;
  playerId?: string | null;
  playerName?: string | null;
  detail?: string | null;
}

/** Le même joueur d'un fait à l'autre : sa ligne d'effectif, sinon son nom. */
const cleJoueur = (f: FaitCarton) => f.playerId || (f.playerName ? `nom:${f.playerName.trim().toLowerCase()}` : "");

/** Les points de cartons de `teamId` sur les faits d'UN match. */
export function pointsDeCartons(faits: FaitCarton[], teamId: string): number {
  const siens = faits.filter((f) => f.teamId === teamId);
  const jaunes = new Map<string, number>();
  for (const f of siens) {
    if (f.type !== "yellow_card") continue;
    const k = cleJoueur(f);
    if (k) jaunes.set(k, (jaunes.get(k) ?? 0) + 1);
  }
  let points = 0;
  for (const f of siens) {
    if (f.type === "yellow_card") points += POINTS_JAUNE;
    else if (f.type === "red_card") {
      const surSecondJaune = f.detail === DETAIL_SECOND_JAUNE || (jaunes.get(cleJoueur(f)) ?? 0) >= 2;
      // Les deux jaunes comptent déjà 2 : l'expulsion complète à 3.
      points += surSecondJaune ? POINTS_ROUGE - 2 * POINTS_JAUNE : POINTS_ROUGE;
    }
  }
  return points;
}
