// ============================================
// La possession de balle : une duree, pas un evenement.
//
// TOUT LE RESTE DE LA CONSOLE EST EVENEMENTIEL — un but, un carton, un tir se
// posent a un instant et s'empilent dans `live_state.events`. La possession
// n'a pas cette forme : elle ne se compte pas, elle se CHRONOMETRE, et un
// match en fait un seul chiffre qui bouge en continu. La stocker en
// evenements aurait ecrit trois cents lignes par match pour une donnee que
// personne ne relit ligne a ligne.
//
// D'ou ce modele minuscule, pose a cote des evenements : deux compteurs
// arretes, plus le segment en cours. Le segment en cours n'est pas stocke —
// il se DEDUIT du camp qui tient le ballon et de l'heure ou il l'a pris. La
// console n'ecrit donc que sur bascule, et celui qui regarde voit quand meme
// la barre avancer entre deux ecritures : il refait le meme calcul, a la
// seconde pres, sans rien demander au serveur.
//
// LE CHRONO DU MATCH FAIT AUTORITE. Une possession ne court que pendant le
// jeu : a la mi-temps, sur une blessure, apres le coup de sifflet final, le
// segment en cours est clos et rien ne s'accumule. Sans cette regle, une
// console laissee ouverte sur une table aurait donne 98 % a l'equipe qui
// touchait le ballon au coup de sifflet.
// ============================================

/** Ce que `live_state.possession` porte, tel qu'il est ecrit en base. */
export interface PossessionStockee {
  /** Les segments CLOS, en millisecondes. Le segment en cours n'y est pas. */
  home_ms: number;
  away_ms: number;
  /** Le camp qui tient le ballon, `null` quand personne ne le tient. */
  side: "home" | "away" | null;
  /**
   * Depuis quand il le tient, en ISO. `null` des que l'horloge s'arrete :
   * c'est ce qui empeche la possession de courir a la mi-temps.
   */
  since: string | null;
}

/** La meme chose, dans le vocabulaire du reste de l'application. */
export interface Possession {
  homeMs: number;
  awayMs: number;
  side: "home" | "away" | null;
  since: string | null;
}

export const POSSESSION_VIDE: Possession = {
  homeMs: 0, awayMs: 0, side: null, since: null,
};

export function versPossession(d: PossessionStockee | null | undefined): Possession {
  if (!d) return POSSESSION_VIDE;
  return {
    homeMs: d.home_ms ?? 0,
    awayMs: d.away_ms ?? 0,
    side: d.side ?? null,
    since: d.since ?? null,
  };
}

export function versStockage(p: Possession): PossessionStockee {
  return {
    home_ms: Math.round(p.homeMs),
    away_ms: Math.round(p.awayMs),
    side: p.side,
    since: p.since,
  };
}

/**
 * Les deux totaux a cet instant, segment en cours compris.
 *
 * `chronoTourne` vient du match, pas d'ici : si l'horloge est arretee, le
 * segment en cours ne compte pas, meme quand `since` est encore pose. Les
 * deux peuvent diverger une fraction de seconde, le temps qu'une ecriture
 * revienne — et c'est le chrono qui a raison.
 */
export function totauxPossession(
  p: Possession,
  chronoTourne: boolean,
  maintenant: number = Date.now(),
): { homeMs: number; awayMs: number } {
  const totaux = { homeMs: p.homeMs, awayMs: p.awayMs };
  if (!chronoTourne || !p.side || !p.since) return totaux;

  const debut = new Date(p.since).getTime();
  if (!Number.isFinite(debut)) return totaux;
  // Une horloge de telephone en retard sur celle du serveur donnerait un
  // segment negatif, qui retirerait du temps deja acquis.
  const encours = Math.max(0, maintenant - debut);

  return p.side === "home"
    ? { homeMs: totaux.homeMs + encours, awayMs: totaux.awayMs }
    : { homeMs: totaux.homeMs, awayMs: totaux.awayMs + encours };
}

/**
 * Le temps minimum avant qu'une part veuille dire quelque chose, EN PUBLIC.
 *
 * Un appui malheureux sur la bascule ne doit pas publier « 100 % – 0 % » sur
 * la fiche du match. Dix secondes de jeu suffisent a distinguer la mesure de
 * l'accident.
 */
export const SEUIL_PUBLIC_MS = 10_000;

/**
 * La part de chacun, en pour cent entier.
 *
 * `null` tant que la mesure est trop courte pour vouloir dire quelque chose :
 * une barre a 50/50 sur un match ou personne n'a touche la bascule affirmerait
 * un equilibre parfait, ce qui est une invention.
 *
 * LE SEUIL NE VAUT PAS POUR LE SCOREUR. Lui vient d'appuyer, il sait ce qu'il
 * a fait, et il attend que son geste se voie : dix secondes de tiret apres un
 * appui se lisent comme un bouton casse. La console passe donc `seuilMs` a
 * zero ; la fiche publique garde le seuil par defaut.
 */
export function partPossession(
  p: Possession,
  chronoTourne: boolean,
  maintenant: number = Date.now(),
  seuilMs: number = SEUIL_PUBLIC_MS,
): { home: number; away: number } | null {
  const { homeMs, awayMs } = totauxPossession(p, chronoTourne, maintenant);
  const total = homeMs + awayMs;
  if (total <= 0 || total < seuilMs) return null;
  const home = Math.round((homeMs / total) * 100);
  return { home, away: 100 - home };
}

/**
 * Le ballon passe a `side` (ou personne, avec `null`).
 *
 * Le segment en cours est clos et verse a son proprietaire, puis le nouveau
 * commence. Rebasculer sur le camp qui tient deja le ballon ne fait rien :
 * c'est un appui en trop, pas une information.
 */
export function basculer(
  p: Possession,
  side: "home" | "away" | null,
  chronoTourne: boolean,
  maintenant: number = Date.now(),
): Possession {
  if (side === p.side) return p;
  const { homeMs, awayMs } = totauxPossession(p, chronoTourne, maintenant);
  return {
    homeMs,
    awayMs,
    side,
    // Un camp prend le ballon alors que le jeu est arrete : on retient qui
    // l'a, sans rien compter avant la reprise.
    since: side && chronoTourne ? new Date(maintenant).toISOString() : null,
  };
}

/** L'horloge s'arrete : le segment en cours est clos, le camp est retenu. */
export function suspendre(p: Possession, maintenant: number = Date.now()): Possession {
  const { homeMs, awayMs } = totauxPossession(p, true, maintenant);
  return { homeMs, awayMs, side: p.side, since: null };
}

/** L'horloge repart : le camp retenu reprend son decompte. */
export function reprendre(p: Possession, maintenant: number = Date.now()): Possession {
  if (!p.side) return { ...p, since: null };
  return { ...p, since: new Date(maintenant).toISOString() };
}
