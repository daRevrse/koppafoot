import { derniersResultats } from "@/lib/forme";
import type { CompMatch } from "@/types";

// ============================================
// Les matchs « chauds » : ceux qu'un organisateur met en tête des matchs mis
// en avant de l'accueil Direct (lib/direct-shared, `chaudsEnTete`). Voir
// docs/superpowers/specs/2026-10-22-matchs-chauds-design.md.
//
// L'ORGANISATEUR DÉCIDE, LA MACHINE SUGGÈRE. Les suggestions sont les matchs
// à venir où les deux équipes arrivent le plus en forme : la forme d'une
// équipe, c'est sa moyenne de points (3 la victoire, 1 le nul) sur ses cinq
// derniers matchs de la compétition avant celui-là (lib/forme), et une
// rencontre vaut la PLUS FAIBLE des deux — un choc oppose deux équipes en
// forme, pas une équipe en feu à la lanterne rouge.
//
// DEUX MATCHS CHAUDS À VENIR AU PLUS PAR COMPÉTITION : sans limite, un seul
// tournoi occuperait toutes les places de l'accueil.
//
// Module pur : aucun SDK.
// ============================================

export const CHAUDS_PAR_COMPETITION = 2;

/** Combien de matchs en suggestion. */
export const SUGGESTIONS = 3;

/** Une forme ne dit rien avant deux matchs joués : pas de suggestion. */
const JOUES_MIN = 2;

/** Un match qui peut encore être chaud : à venir ou en direct. */
export function estAVenir(m: Pick<CompMatch, "status">): boolean {
  return m.status === "scheduled" || m.status === "live";
}

/** Les matchs chauds qui comptent : à venir ou en direct. */
export function chaudsAVenir(matchs: CompMatch[]): CompMatch[] {
  return matchs.filter((m) => m.chaud && estAVenir(m));
}

/**
 * La flamme de ce match est-elle disponible ? Toujours pour l'éteindre ; pour
 * l'allumer, seulement sur un match à venir, et tant que la compétition n'a
 * pas déjà ses deux matchs chauds.
 */
export function peutMarquerChaud(matchs: CompMatch[], match: CompMatch): boolean {
  if (match.chaud) return true;
  return estAVenir(match) && chaudsAVenir(matchs).length < CHAUDS_PAR_COMPETITION;
}

/** La forme d'une équipe avant ce match : sa moyenne de points, et sur combien de matchs. */
export function formeDe(matchs: CompMatch[], equipe: string, avant: CompMatch): { moyenne: number; joues: number } {
  const r = derniersResultats(matchs, equipe, avant);
  if (r.length === 0) return { moyenne: 0, joues: 0 };
  const points = r.reduce((s, x) => s + (x.resultat === "V" ? 3 : x.resultat === "N" ? 1 : 0), 0);
  return { moyenne: points / r.length, joues: r.length };
}

const cleDeTemps = (m: CompMatch) => `${m.date ?? "9999-99-99"}T${m.time || "99:99"}`;

/**
 * Les matchs à venir à proposer comme chauds, les plus chauds d'abord : la
 * forme de la rencontre (la plus faible des deux), puis le plus proche dans
 * le temps, les matchs sans date à la fin. Ni un match déjà chaud, ni un
 * match d'une date passée, ni une place encore à déterminer, ni une équipe qui
 * n'a pas joué deux matchs.
 */
export function suggererChocs(
  matchs: CompMatch[],
  aujourdhui: string,
  combien = SUGGESTIONS,
): { match: CompMatch; forme: number }[] {
  return matchs
    .filter((m) => m.status === "scheduled" && !m.chaud && m.homeTeamId && m.awayTeamId
      && (m.date == null || m.date >= aujourdhui))
    .map((m) => {
      const dom = formeDe(matchs, m.homeTeamId!, m);
      const ext = formeDe(matchs, m.awayTeamId!, m);
      return { match: m, forme: Math.min(dom.moyenne, ext.moyenne), assez: dom.joues >= JOUES_MIN && ext.joues >= JOUES_MIN };
    })
    .filter((s) => s.assez)
    .sort((a, b) => b.forme - a.forme || cleDeTemps(a.match).localeCompare(cleDeTemps(b.match)))
    .slice(0, combien)
    .map(({ match, forme }) => ({ match, forme }));
}
