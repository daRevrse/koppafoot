// ============================================
// LE BILAN D'UN CLUB : joués, gagnés, nuls, perdus, buts.
//
// POURQUOI IL SE CALCULE, ET NE SE STOCKE PLUS.
//
// `teams` porte quatre compteurs — `matches_played`, `wins`, `draws`,
// `losses` — incrémentés au coup de sifflet final par /api/matches/complete.
// Un compteur n'est juste que si TOUT ce qui le fait bouger l'incrémente ET
// le décrémente. Ce n'était le cas d'aucune des trois choses qui le font
// bouger :
//
//   — SUPPRIMER UN MATCH ne retirait rien (`deleteMatch` efface le document
//     et les participations, et s'arrête là). Un match terminé puis supprimé
//     laissait sa victoire au palmarès, définitivement.
//   — CORRIGER UN SCORE après clôture ne rejouait pas le calcul : une défaite
//     redressée en victoire restait comptée comme une défaite.
//   — LE ROLLUP A LONGTEMPS TOURNÉ DANS LE NAVIGATEUR, sans aucun garde : un
//     double-clic comptait le match deux fois (voir le commentaire de
//     /api/matches/complete, qui a fermé cette porte-là depuis).
//
// Constaté en production : un club affichait 3 matchs joués et 1 victoire
// alors qu'il n'avait qu'UN match terminé, et un nul.
//
// L'addition qu'on évitait coûte une boucle sur des matchs que les pages
// chargent déjà. Le compteur, lui, coûtait trois occasions de mentir. La
// fiche d'équipe avait d'ailleurs déjà tranché dans ce sens pour ses buts
// pour/contre ; ce fichier généralise sa décision, et la rend partageable
// avec les routes publiques.
//
// SEUL UN MATCH TERMINÉ COMPTE. Un match à venir, en cours, reporté ou annulé
// n'a pas de résultat — et un score de 0-0 sur un match qui n'a pas commencé
// est un zéro d'attente, pas un nul.
// ============================================

/** Le minimum qu'on demande à un match pour en tirer un résultat. */
export interface MatchPourBilan {
  status: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
}

export interface BilanClub {
  joues: number;
  gagnes: number;
  nuls: number;
  perdus: number;
  butsPour: number;
  butsContre: number;
  /** Matchs terminés sans encaisser. */
  sansEncaisser: number;
}

export const BILAN_VIDE: BilanClub = {
  joues: 0, gagnes: 0, nuls: 0, perdus: 0,
  butsPour: 0, butsContre: 0, sansEncaisser: 0,
};

/**
 * Un match compte-t-il pour un bilan ?
 *
 * Exporté parce que la question se pose ailleurs — une forme, une série, un
 * classement — et qu'elle doit recevoir partout la même réponse.
 */
export function compteDansLeBilan(m: MatchPourBilan): boolean {
  return (
    m.status === "completed"
    && typeof m.scoreHome === "number"
    && typeof m.scoreAway === "number"
  );
}

/**
 * Le bilan d'une équipe sur les matchs fournis.
 *
 * L'appelant décide du périmètre — tous ses matchs, une saison, une
 * compétition. Ici on ne fait que compter, et seulement ce qui s'est joué.
 */
export function bilanDuClub(matchs: MatchPourBilan[], teamId: string): BilanClub {
  const b = { ...BILAN_VIDE };

  for (const m of matchs) {
    if (!compteDansLeBilan(m)) continue;

    const chezNous = m.homeTeamId === teamId;
    const chezEux = m.awayTeamId === teamId;
    // Ni l'un ni l'autre : ce match n'est pas le sien. Les deux : une équipe
    // contre elle-même, qu'on refuse de compter deux fois.
    if (chezNous === chezEux) continue;

    const pour = (chezNous ? m.scoreHome : m.scoreAway) as number;
    const contre = (chezNous ? m.scoreAway : m.scoreHome) as number;

    b.joues += 1;
    b.butsPour += pour;
    b.butsContre += contre;
    if (contre === 0) b.sansEncaisser += 1;
    if (pour > contre) b.gagnes += 1;
    else if (pour === contre) b.nuls += 1;
    else b.perdus += 1;
  }

  return b;
}
