import { rangerLesMatchs, resultatDuMatch, statutPublicCompetition, type MatchDuClub } from "@/lib/fiche-club";
import { computeStandings } from "@/lib/poules";
import type { CompMatch, CompTeam, Competition } from "@/types";
import { etiquetteDuMatch } from "~/lib/page-competition";

// La page d'une équipe dans sa compétition (app/(app)/c/[slug]/teams/[tid]
// du site) : ses matchs vus de son côté, son bilan, sa place dans la poule.

/**
 * Les matchs de l'équipe, vus d'elle (la forme `MatchDuClub` de la fiche d'un
 * club) : l'adversaire, le score pour et contre, domicile ou extérieur. Un
 * match annulé n'y est pas.
 */
export function matchsDeLEquipe(
  matchs: CompMatch[],
  equipeId: string,
  competition: Pick<Competition, "name" | "slug">,
): MatchDuClub[] {
  return matchs.flatMap((m) => {
    if (m.homeTeamId !== equipeId && m.awayTeamId !== equipeId) return [];
    const statut = statutPublicCompetition(m.status);
    if (!statut) return [];
    const domicile = m.homeTeamId === equipeId;
    return [{
      id: m.id,
      lien: `/c/${competition.slug}/matches/${m.id}`,
      competition: { nom: competition.name, lien: `/c/${competition.slug}` },
      etape: etiquetteDuMatch(m),
      groupe: m.group ?? null,
      tour: m.round ?? null,
      date: m.date,
      heure: m.time,
      statut,
      domicile,
      adversaire: domicile
        ? { nom: m.awayTeamName, logo: m.awayTeamLogo }
        : { nom: m.homeTeamName, logo: m.homeTeamLogo },
      pour: domicile ? m.scoreHome : m.scoreAway,
      contre: domicile ? m.scoreAway : m.scoreHome,
      lieu: m.venueName ?? null,
    }];
  });
}

/** Le bilan dans la compétition, et la forme des cinq derniers, du plus ancien au plus récent. */
export function bilanDeLEquipe(matchs: MatchDuClub[]): {
  joues: number; gagnes: number; nuls: number; perdus: number; pour: number; contre: number; forme: ("V" | "N" | "D")[];
} {
  const termines = rangerLesMatchs(matchs).joues.filter((m) => resultatDuMatch(m) !== null);
  const compter = (r: "V" | "N" | "D") => termines.filter((m) => resultatDuMatch(m) === r).length;
  return {
    joues: termines.length,
    gagnes: compter("V"),
    nuls: compter("N"),
    perdus: compter("D"),
    pour: termines.reduce((n, m) => n + (m.pour ?? 0), 0),
    contre: termines.reduce((n, m) => n + (m.contre ?? 0), 0),
    forme: termines.slice(0, 5).map((m) => resultatDuMatch(m) as "V" | "N" | "D").reverse(),
  };
}

/** Le rang et les points de l'équipe dans sa poule ; `null` sans poule ou sans classement. */
export function placeDansLaPoule(
  competition: Pick<Competition, "format">,
  matchs: CompMatch[],
  equipes: CompTeam[],
  equipe: CompTeam,
): { rang: number; points: number } | null {
  if (equipe.group == null) return null;
  const poule = computeStandings(matchs, equipes, competition.format).find((p) => p.group === equipe.group);
  const i = poule?.rows.findIndex((r) => r.team.id === equipe.id) ?? -1;
  return poule && i >= 0 ? { rang: i + 1, points: poule.rows[i].points } : null;
}

/** « 1ᵉʳ », « 2ᵉ ». */
export const rangLisible = (n: number) => (n === 1 ? "1ᵉʳ" : `${n}ᵉ`);
