// ============================================
// La taille d'un match, lue dans son format, et ce qui en découle : le total
// de joueurs attendus, le quota de confirmés, l'onze d'un adversaire hors
// plateforme.
//
// Module pur, sans aucun SDK : le navigateur le lit par lib/firestore, qui le
// ré-exporte, et le serveur directement (voir lib/amical-admin-server).
// ============================================

import type { LineupEntry } from "@/types";

/**
 * LE NvN D'UN MATCH, LU DANS SON FORMAT, plutôt que cherché dans une table.
 *
 * Trois tables figées traduisaient « 5v5 », « 7v7 » et « 11v11 » — effectif,
 * total de joueurs, quota minimum — et retombaient sur onze pour tout le
 * reste. Or le formulaire de création laisse maintenant la main sur le N,
 * comme une compétition (voir TEAM_SIZE_OPTIONS) : un 6v6 comptait donc onze
 * titulaires côté fantôme et vingt-deux joueurs attendus.
 *
 * Le N est déjà écrit dans le format, il n'y a rien à mémoriser.
 */
export function tailleEffectif(format: string | undefined): number {
  const n = Number.parseInt(String(format ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 11;
}

/** Joueurs attendus sur la feuille, les deux camps réunis. */
export function totalJoueurs(format: string | undefined): number {
  return tailleEffectif(format) * 2;
}

/**
 * Confirmés minimum par équipe pour qu'un match se programme.
 *
 * La règle reproduit exactement les trois valeurs de l'ancienne table
 * (5v5 → 3, 7v7 → 5, 11v11 → 8) et sait répondre pour les autres formats :
 * il faut de quoi aligner une équipe, pas l'équipe entière.
 */
export function quotaMinimum(format: string | undefined): number {
  const n = tailleEffectif(format);
  return Math.max(2, n <= 7 ? n - 2 : n - 3);
}

/**
 * L'onze d'un adversaire hors plateforme, SANS RIEN ÉCRIRE EN BASE.
 *
 * Il existait un document `teams` pour chaque adversaire d'amical, avec sa
 * sous-collection de joueurs. C'était un mensonge commode : ces « équipes »
 * n'ont ni compte, ni membre, ni personne derrière, et elles s'accumulaient
 * dans une collection réservée aux vrais clubs — jusqu'à polluer l'annuaire de
 * l'administration, seul endroit qui les montrait encore.
 *
 * Tout ce dont on avait besoin d'elles vit déjà sur le match : le nom dans
 * `away_team_name`, l'onze dans `away_ghost_lineup`. Le document ne servait
 * plus qu'à porter des joueurs que personne ne relisait, la compo étant
 * dénormalisée depuis. On génère donc la feuille en mémoire, et le camp
 * adverse n'a plus d'identifiant d'équipe du tout.
 *
 * Les identifiants de joueurs sont locaux au match, ce qui suffit : ils ne
 * servent qu'à rattacher un but ou un carton à une ligne de cette feuille-là.
 */
export function ghostOpponentLineup(format: string, feminin = false): LineupEntry[] {
  const taille = tailleEffectif(format);
  const lignes: LineupEntry[] = [];
  for (let i = 1; i <= taille; i++) {
    const numero = String(i);
    lignes.push({
      // Suffixe aléatoire : deux matchs du même jour ne doivent pas partager
      // un identifiant de joueur, la timeline les confondrait.
      playerId: `ext-${Math.random().toString(36).slice(2, 8)}-${numero}`,
      name: `${feminin ? "Joueuse" : "Joueur"} ${numero}`,
      number: numero,
      role: "starter",
    });
  }
  return lignes;
}
