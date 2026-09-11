import type { CompMatch } from "@/types";

// ============================================
// La forme d'une équipe : ses derniers résultats, lus dans les matchs de la
// compétition que la fiche match charge déjà. Aucune lecture en plus.
//
// DU PLUS ANCIEN AU PLUS RÉCENT, le dernier à droite : le sens d'une frise,
// et celui de la forme du rail de compétition.
//
// AVANT LE MATCH REGARDÉ, pas avant aujourd'hui. Sur la fiche d'une
// rencontre jouée il y a trois semaines, la forme qui compte est celle avec
// laquelle les deux équipes y sont arrivées, pas les résultats qui ont
// suivi. Le match lui-même n'en fait pas partie : il est déjà sur la page.
// ============================================

/** Victoire, nul, défaite : le vocabulaire du rail et de la fiche équipe. */
export type Resultat = "V" | "N" | "D";

export interface ResultatDeForme {
  matchId: string;
  resultat: Resultat;
  /** L'adversaire de ce jour-là. */
  adversaire: { nom: string; logo: string | null };
  /** Le score du point de vue de l'équipe, « 3-1 ». */
  score: string;
}

export const MOT_RESULTAT: Record<Resultat, string> = {
  V: "Victoire",
  N: "Nul",
  D: "Défaite",
};

/** Un instant comparable en texte : « 2026-09-11T18:30 ». */
const instant = (m: { date: string | null; time: string | null }) => `${m.date ?? ""}T${m.time ?? ""}`;

export function derniersResultats(
  matches: CompMatch[],
  teamId: string | null,
  avant: Pick<CompMatch, "id" | "date" | "time">,
  combien = 5,
): ResultatDeForme[] {
  if (!teamId) return [];
  // Un match sans date n'a pas d'« avant » : tout ce qui est joué compte.
  const borne = avant.date ? instant(avant) : null;

  return matches
    .filter((m) =>
      m.id !== avant.id
      && m.status === "completed"
      && m.scoreHome != null && m.scoreAway != null
      && (m.homeTeamId === teamId || m.awayTeamId === teamId)
      && (borne === null || instant(m) < borne))
    .sort((a, b) => instant(a).localeCompare(instant(b)))
    .slice(-combien)
    .map((m) => {
      const aDomicile = m.homeTeamId === teamId;
      const pour = (aDomicile ? m.scoreHome : m.scoreAway) as number;
      const contre = (aDomicile ? m.scoreAway : m.scoreHome) as number;
      return {
        matchId: m.id,
        resultat: pour > contre ? "V" : pour < contre ? "D" : "N",
        adversaire: aDomicile
          ? { nom: m.awayTeamName, logo: m.awayTeamLogo }
          : { nom: m.homeTeamName, logo: m.homeTeamLogo },
        score: `${pour}-${contre}`,
      };
    });
}
