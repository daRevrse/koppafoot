import type { CompMatchRound } from "@/types";
import { textes } from "./textes";

// ============================================
// Le vocabulaire du football, dans les deux langues.
//
// Les mots que TOUS les écrans d'un match ou d'une compétition emploient :
// les tours, la poule, l'état d'un match. « Quart de finale » était recopié
// dans huit fichiers ; une traduction recopiée huit fois finit en huit
// traductions.
//
// Sans directive : le serveur (aperçus, fiches) le lit comme le navigateur.
// ============================================

const TOURS_FR: Record<CompMatchRound, [string, string]> = {
  round_of_16: ["8es de finale", "8es de finale"],
  quarter: ["Quart de finale", "Quarts de finale"],
  semi: ["Demi-finale", "Demi-finales"],
  final: ["Finale", "Finale"],
  third_place: ["Petite finale", "Petite finale"],
};

const TOURS_EN: Record<CompMatchRound, [string, string]> = {
  round_of_16: ["Round of 16", "Round of 16"],
  quarter: ["Quarter-final", "Quarter-finals"],
  semi: ["Semi-final", "Semi-finals"],
  final: ["Final", "Final"],
  third_place: ["Third-place play-off", "Third-place play-off"],
};

export const FOOT = textes(
  {
    /** « Quart de finale » : le tour d'UN match. */
    tour: (r: CompMatchRound) => TOURS_FR[r]?.[0] ?? "",
    /** « Quarts de finale » : la colonne d'un tableau. */
    tours: (r: CompMatchRound) => TOURS_FR[r]?.[1] ?? "",
    groupe: (g: string) => `Groupe ${g}`,
    enDirect: "En direct",
    termine: "Terminé",
    /** La colonne étroite d'une ligne de score. */
    fin: "Fin",
    aVenir: "À venir",
    miTemps: "Mi-temps",
    annule: "Annulé",
    reporte: "Reporté",
    aProgrammer: "À programmer",
    dateAVenir: "Date à venir",
    prochainMatch: "Prochain match",
    victoire: (equipe: string) => `Victoire ${equipe}`,
    nul: "Match nul",
    amicaux: "Matchs amicaux",
    buts: (n: number) => `${n} but${n > 1 ? "s" : ""}`,
    passes: (n: number) => `${n} passe${n > 1 ? "s" : ""}`,
    matchs: (n: number) => `${n} match${n > 1 ? "s" : ""}`,
  },
  {
    tour: (r: CompMatchRound) => TOURS_EN[r]?.[0] ?? "",
    tours: (r: CompMatchRound) => TOURS_EN[r]?.[1] ?? "",
    groupe: (g: string) => `Group ${g}`,
    enDirect: "Live",
    termine: "Full time",
    fin: "FT",
    aVenir: "Upcoming",
    miTemps: "Half-time",
    annule: "Cancelled",
    reporte: "Postponed",
    aProgrammer: "To be scheduled",
    dateAVenir: "Date to be set",
    prochainMatch: "Next match",
    victoire: (equipe: string) => `${equipe} win`,
    nul: "Draw",
    amicaux: "Friendlies",
    buts: (n: number) => `${n} goal${n === 1 ? "" : "s"}`,
    passes: (n: number) => `${n} assist${n === 1 ? "" : "s"}`,
    matchs: (n: number) => `${n} match${n === 1 ? "" : "es"}`,
  },
);

/**
 * Les colonnes d'un classement : l'abréviation, et ce qu'elle veut dire au
 * survol. Les mêmes pour une compétition locale, le football mondial et la
 * poule affichée sur la fiche d'un match.
 */
export const COLONNES_CLASSEMENT = textes(
  {
    equipe: "Équipe",
    j: "J", jTitre: "Joués",
    g: "G", gTitre: "Gagnés",
    n: "N", nTitre: "Nuls",
    p: "P", pTitre: "Perdus",
    bp: "BP", bpTitre: "Buts pour",
    bc: "BC", bcTitre: "Buts contre",
    diff: "Diff", diffTitre: "Différence de buts",
    pts: "Pts", ptsTitre: "Points",
  },
  {
    equipe: "Team",
    j: "P", jTitre: "Played",
    g: "W", gTitre: "Won",
    n: "D", nTitre: "Drawn",
    p: "L", pTitre: "Lost",
    bp: "GF", bpTitre: "Goals for",
    bc: "GA", bcTitre: "Goals against",
    diff: "GD", diffTitre: "Goal difference",
    pts: "Pts", ptsTitre: "Points",
  },
);
