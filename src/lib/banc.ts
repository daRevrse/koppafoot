// ============================================
// La feuille pendant le match : qui est sur la pelouse, qui peut entrer, qui
// est déjà averti, et combien de changements un camp a faits.
//
// Ces règles vivaient dans la console live, mêlées à son rendu. Elles valent
// pour toute console qui tient un match — celle du site, et celle que
// l'application mobile aura —, et se vérifient sans base : voir
// scripts/test-banc.ts.
//
// Module pur, sans SDK.
// ============================================

import type { CompMatch, LineupEntry } from "@/types";

/** Un fait du match, tel que la console le lit dans `live_state.events`. */
type Fait = NonNullable<CompMatch["liveState"]>["events"][number];

/** Les lignes de la feuille qui sont sur la pelouse, dans l'ordre de la feuille. */
export function surLaPelouse(feuille: LineupEntry[], pelouse: string[]): LineupEntry[] {
  const presents = new Set(pelouse);
  return feuille.filter((e) => presents.has(e.playerId));
}

/**
 * Le banc : qui peut entrer.
 *
 * En competition, les remplacants de la feuille et eux seuls — un titulaire
 * sorti ne revient pas, et le banc ne le reproposait donc jamais. SUR UN
 * AMICAL C'EST L'INVERSE : la sortie n'y est pas definitive, donc tout ce
 * qui est sur la feuille sans etre sur la pelouse peut entrer, un titulaire
 * parti souffler compris. La regle vient du pilote (`retourAutorise`).
 *
 * Un exclu ne revient dans aucun des deux cas : un carton rouge est un
 * carton rouge, meme entre copains.
 */
export function leBanc(
  feuille: LineupEntry[],
  pelouse: string[],
  faits: Fait[],
  retourAutorise: boolean,
): LineupEntry[] {
  const presents = new Set(pelouse);
  const exclus = new Set(
    faits.filter((e) => e.type === "red_card" && e.playerId).map((e) => e.playerId as string),
  );
  // SANS RETOUR, CELUI QUI EST SORTI NE REVIENT PAS — remplaçant compris. Le
  // banc reproposait un remplaçant entré puis ressorti, seul le titulaire
  // était écarté. Une sortie sans remplaçant vaut sortie.
  const sortis = new Set(
    faits
      .map((e) => (e.type === "substitution" ? e.outPlayerId : e.type === "sortie" ? e.playerId : null))
      .filter((id): id is string => !!id),
  );
  return feuille.filter(
    (e) => !presents.has(e.playerId)
      && !exclus.has(e.playerId)
      && (retourAutorise || (e.role === "substitute" && !sortis.has(e.playerId))),
  );
}

/** Les joueurs qui ont déjà un jaune : le choix d'un joueur les marque. */
export function avertis(faits: Fait[]): Set<string> {
  return new Set(
    faits.filter((e) => e.type === "yellow_card" && e.playerId).map((e) => e.playerId as string),
  );
}

/**
 * Le plafond de changements est-il atteint pour ce camp ?
 *
 * `max` à `null` : aucun plafond, c'est le cas d'un amical. Le compte n'est
 * même pas fait — il n'y a rien à comparer.
 */
export function remplacementsEpuises(faits: Fait[], teamId: string, max: number | null): boolean {
  if (max === null) return false;
  return faits.filter((e) => e.type === "substitution" && e.teamId === teamId).length >= max;
}
