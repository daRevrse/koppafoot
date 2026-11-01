import { estLigneHorsPlateforme } from "@/lib/effectif-match";
import type { LineupEntry } from "@/types";

// ============================================
// Les dossards du jour : le numéro qu'un joueur porte sur la feuille d'UN match.
//
// DÉCIDÉ LE 2026-11-01 avec le propriétaire du produit : depuis la console, le
// scoreur change le numéro d'un joueur, avant le coup d'envoi sur l'écran des
// feuilles comme pendant le direct. LE NUMÉRO VAUT POUR CE MATCH SEULEMENT :
// un maillot prêté pour la journée ne change pas l'effectif de l'équipe. La
// feuille de match est un constat (voir `FirestoreLineupEntry.position`), elle
// garde le numéro porté ce jour-là.
//
// DEUX SORTES DE LIGNES N'ONT PAS DE NUMÉRO À CHANGER : un dossard de la
// feuille de secours (« N°9 », lib/dossards) et un « Joueur 9 » d'adversaire
// hors plateforme (lib/effectif-match). Leur numéro est tout ce qu'on sait
// d'eux, et leur nom le répète.
//
// Module pur : la console et scripts/test-numeros-du-jour.ts s'en servent.
// ============================================

/**
 * Ce que le scoreur a tapé, relu : `""` pour un joueur sans numéro, « 7 »
 * pour « 07 », `null` pour autre chose qu'un nombre de 0 à 99.
 */
export function lireNumero(brut: string): string | null {
  const s = brut.trim();
  if (s === "") return "";
  if (!/^\d{1,2}$/.test(s)) return null;
  return String(Number.parseInt(s, 10));
}

/** Le numéro de cette ligne peut-il changer ? Voir l'en-tête. */
export const numeroModifiable = (playerId: string): boolean => !estLigneHorsPlateforme(playerId);

/** Les numéros d'une feuille enregistrée, ligne par ligne. */
export function numerosDeLaFeuille(lineup: Pick<LineupEntry, "playerId" | "number">[]): Record<string, string> {
  const numeros: Record<string, string> = {};
  for (const e of lineup) numeros[e.playerId] = e.number ?? "";
  return numeros;
}

/**
 * La feuille portant les numéros du jour, ou `null` quand aucun ne change :
 * la console n'écrit alors rien. Une ligne dont le numéro ne se change pas
 * (voir `numeroModifiable`) garde le sien, quoi qu'on lui demande.
 */
export function appliquerNumeros<T extends Pick<LineupEntry, "playerId" | "number">>(
  lineup: T[],
  numeros: Record<string, string>,
): T[] | null {
  let change = false;
  const feuille = lineup.map((e) => {
    const n = numeros[e.playerId];
    if (n === undefined || !numeroModifiable(e.playerId) || n === (e.number ?? "")) return e;
    change = true;
    return { ...e, number: n };
  });
  return change ? feuille : null;
}

/**
 * Les numéros portés par plus d'un joueur. Un joueur sans numéro n'en est
 * pas un. La console le signale sans bloquer : c'est le scoreur qui voit les
 * maillots, et c'est lui qui tranche.
 */
export function numerosEnDouble(numeros: string[]): Set<string> {
  const vus = new Set<string>();
  const doubles = new Set<string>();
  for (const n of numeros) {
    if (!n) continue;
    if (vus.has(n)) doubles.add(n);
    vus.add(n);
  }
  return doubles;
}
