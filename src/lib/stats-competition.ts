// ============================================
// Les statistiques de jeu d'une competition : les compteurs des fiches de
// match, additionnes, et le match qui detient chaque record.
//
// LES MEMES CHIFFRES QUE LES FICHES. Chaque match passe par lignesStats
// (lib/stats-match), exactement comme sa fiche publique et la console : un
// organisateur qui lit « 55 fautes » ici et additionne les fiches de ses matchs
// doit retomber sur 55. Un second calcul aurait diverge des le premier
// compteur ajoute.
//
// SUR COMBIEN DE MATCHS ON COMPTE, et c'est tout le sujet. Le score est saisi
// pour chaque match joue ; le reste ne l'est que sur les matchs tenus a la
// console, et pas tous les gestes sur tous ces matchs. D'ou quatre bases :
//   — les buts, sur tous les matchs joues, au tableau d'affichage ;
//   — les tirs, sur les seuls matchs ou quelqu'un a saisi un tir ou un arret.
//     Un but compte comme un tir cadre sur sa fiche (voir lignesStats) : sans
//     cette garde, une competition ou l'on n'a saisi que les buts affichait
//     autant de tirs que de buts, ce qui n'arrive dans aucun match ;
//   — les passes, sur les matchs ou elles ont ete comptees ;
//   — tout le reste, sur les matchs suivis en direct.
// La moyenne par match se calcule sur la meme base que le total.
//
// CE QUI NE COMPTE PAS : les matchs d'exhibition, qui ne font pas partie du
// tournoi (comme au classement des buteurs, voir lib/exhibition), et les
// forfaits, dont le score est attribue et non joue. La possession non plus :
// des pourcentages ne s'additionnent pas.
// ============================================

import { estExhibition } from "@/lib/exhibition";
import { lignesStats } from "@/lib/stats-match";
import type { CompMatch } from "@/types";

/** Ce qu'il faut d'un match pour le compter. */
export type MatchDeJeu = Pick<
  CompMatch,
  | "id" | "status" | "stage" | "forfeitByTeamId" | "date" | "time"
  | "homeTeamId" | "awayTeamId" | "homeTeamName" | "awayTeamName"
  | "scoreHome" | "scoreAway" | "liveState"
>;

export interface TotalDeJeu {
  cle: string;
  label: string;
  total: number;
  /** Les matchs sur lesquels ce total est compte. Voir l'en-tete. */
  matchs: number;
  parMatch: number;
}

export interface RecordDeJeu {
  cle: string;
  label: string;
  /** Les deux camps ensemble. */
  n: number;
  matchId: string;
  /** « Cameroun 7–3 Nigeria ». */
  affiche: string;
}

export interface StatsDeJeu {
  /** Les matchs joues qui comptent : ni exhibition, ni forfait. */
  joues: number;
  /** Ceux d'entre eux ou la console a saisi au moins un fait. */
  suivis: number;
  totaux: TotalDeJeu[];
  records: RecordDeJeu[];
}

/**
 * Un record d'un seul fait n'en est pas un : « le plus de cartons : 1 » dit
 * seulement qu'il y en a eu un.
 */
export const RECORD_MIN = 2;

/**
 * L'ordre des fiches de match (lib/stats-match), du plus decisif au plus
 * anecdotique. Un compteur que cette liste ne connait pas encore se range a la
 * fin plutot que de disparaitre.
 */
const ORDRE = [
  "buts", "tirs", "cadres", "arrets", "passes", "corners", "penaltys",
  "coups_francs", "touches", "fautes", "hors_jeu", "jaunes", "rouges", "changements",
];
const rang = (cle: string) => {
  const i = ORDRE.indexOf(cle);
  return i === -1 ? ORDRE.length : i;
};

const TIRS = new Set(["tirs", "cadres"]);
const FAITS_DE_TIR = new Set(["shot", "shot_on_target", "save"]);

export const afficheDuMatch = (m: MatchDeJeu) =>
  `${m.homeTeamName} ${m.scoreHome ?? 0}–${m.scoreAway ?? 0} ${m.awayTeamName}`;

/** Plus tard d'abord ; un match sans date est le plus ancien. */
const plusRecent = (a: MatchDeJeu, b: MatchDeJeu) =>
  `${a.date ?? ""} ${a.time ?? ""}` > `${b.date ?? ""} ${b.time ?? ""}`;

export function statsDeJeu(matchs: MatchDeJeu[]): StatsDeJeu {
  const joues = matchs.filter(
    (m) => m.status === "completed" && !estExhibition(m) && !m.forfeitByTeamId,
  );
  const suivis = joues.filter((m) =>
    (m.liveState?.events ?? []).some((e) => e.type !== "period_start" && e.type !== "period_end"),
  );

  const parCle = new Map<string, {
    label: string;
    total: number;
    matchs: number;
    record: { n: number; match: MatchDeJeu } | null;
  }>();
  const compter = (cle: string, label: string, n: number, m: MatchDeJeu) => {
    const c = parCle.get(cle) ?? { label, total: 0, matchs: 0, record: null };
    c.total += n;
    if (n >= RECORD_MIN && (!c.record || n > c.record.n || (n === c.record.n && plusRecent(m, c.record.match)))) {
      c.record = { n, match: m };
    }
    parCle.set(cle, c);
  };
  // Les buts, au tableau d'affichage de chaque match joue. JAMAIS la somme des
  // buts saisis : un score se corrige sans que la console y soit pour rien.
  for (const m of joues) compter("buts", "Buts", (m.scoreHome ?? 0) + (m.scoreAway ?? 0), m);

  let matchsAvecTirs = 0;
  let matchsAvecPasses = 0;
  for (const m of suivis) {
    const faits = m.liveState?.events ?? [];
    const tirsSaisis = faits.some((e) => FAITS_DE_TIR.has(e.type));
    if (tirsSaisis) matchsAvecTirs += 1;
    const lignes = lignesStats(
      faits,
      m.homeTeamId,
      m.awayTeamId,
      { home: m.scoreHome ?? 0, away: m.scoreAway ?? 0 },
      m.liveState?.possession ?? null,
      false,
    );
    for (const l of lignes) {
      if (l.cle === "buts" || l.pourcent) continue;
      if (TIRS.has(l.cle) && !tirsSaisis) continue;
      if (l.cle === "passes") matchsAvecPasses += 1;
      compter(l.cle, l.label, l.home + l.away, m);
    }
  }

  const totaux: TotalDeJeu[] = [];
  const records: RecordDeJeu[] = [];
  for (const [cle, c] of parCle) {
    // Les matchs sur lesquels ce compteur se compte. Voir l'en-tete.
    const base = cle === "buts" ? joues.length
      : TIRS.has(cle) ? matchsAvecTirs
      : cle === "passes" ? matchsAvecPasses
      : suivis.length;
    if (base === 0) continue;
    totaux.push({ cle, label: c.label, total: c.total, matchs: base, parMatch: c.total / base });
    if (c.record) {
      records.push({
        cle, label: c.label, n: c.record.n, matchId: c.record.match.id, affiche: afficheDuMatch(c.record.match),
      });
    }
  }
  totaux.sort((a, b) => rang(a.cle) - rang(b.cle));
  records.sort((a, b) => rang(a.cle) - rang(b.cle));

  return { joues: joues.length, suivis: suivis.length, totaux, records };
}

/**
 * Sur combien de matchs on compte, en une phrase. LA MEME A L'ECRAN ET DANS LE
 * RAPPORT : « 55 fautes » ne veut rien dire tant qu'on ne sait pas sur
 * combien de matchs on les a comptees.
 */
export function couvertureLisible(s: StatsDeJeu): string {
  const joues = `${s.joues} ${s.joues > 1 ? "matchs joués" : "match joué"}`;
  if (s.suivis === 0) return `${joues}, aucun suivi en direct : seuls les buts sont comptés.`;
  if (s.suivis === s.joues) return s.joues > 1 ? `${joues}, tous suivis en direct.` : `${joues}, suivi en direct.`;
  return `${joues}, dont ${s.suivis} ${s.suivis > 1 ? "suivis" : "suivi"} en direct : les buts comptent tous les matchs, le reste les seuls matchs suivis.`;
}

/** « Le plus de buts », « Le plus d'arrets ». */
export const titreDuRecord = (label: string) =>
  /^[aeiouyàâéèêîôû]/i.test(label) ? `Le plus d'${label.toLocaleLowerCase("fr-FR")}` : `Le plus de ${label.toLocaleLowerCase("fr-FR")}`;

/** « 4,9 » : une decimale, a la francaise. */
export const parMatchLisible = (x: number) =>
  x.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
