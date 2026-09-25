import { adminDb } from "@/lib/firebase-admin";
import {
  bilanDuClub, compteDansLeBilan, type BilanClub, type MatchPourBilan,
} from "@/lib/bilan-club";

// ============================================
// LE BILAN COMPLET D'UN CLUB : ses amicaux ET ses matchs de compétition.
//
// lib/bilan-club compte ; ce fichier dit QUOI compter, côté serveur.
//
// Le bilan d'un club ne lisait que `matches`, c'est-à-dire les amicaux. Un
// club inscrit à un tournoi y gagnait ses matchs sans que sa fiche en garde
// la moindre trace, alors que la fiche de ses joueurs, elle, les comptait
// (voir lib/bilan-public). Même match, deux récits.
//
// LE LIEN CLUB → COMPÉTITION est `comp_teams.claimed_by_team_id`, posé à
// l'acceptation d'une inscription et à l'import d'un effectif. Un match de
// compétition nomme des `comp_teams`, pas des clubs : on le réécrit au nom
// du club avant de le compter.
//
// POURQUOI UNE BOUCLE SUR LES COMPÉTITIONS, et pas un `collectionGroup` sur
// `claimed_by_team_id` : ce dernier demande un index de groupe de
// collections qui n'existe pas en production. La boucle coûte une requête
// par compétition — trois en septembre 2026 — et les routes qui l'appellent
// revalident toutes les cinq minutes. Le jour où les compétitions se
// comptent par dizaines, l'index remplacera la boucle.
//
// LES BACS À SABLE NE COMPTENT PAS : une compétition d'essai n'est pas un
// palmarès.
// ============================================

/** Un match pour le bilan, plus de quoi le ranger dans le temps. */
export type MatchDate = MatchPourBilan & {
  /** « AAAA-MM-JJHH:MM » : se trie comme une chaîne. */
  quand: string;
};

export type Resultat = "V" | "N" | "D";

export type BilanComplet = BilanClub & {
  /** Les cinq derniers résultats, du plus récent au plus ancien. */
  forme: Resultat[];
};

function versBilan(m: FirebaseFirestore.DocumentData): MatchDate {
  return {
    quand: `${m.date ?? ""}${m.time ?? ""}`,
    status: String(m.status ?? ""),
    homeTeamId: (m.home_team_id as string) ?? null,
    awayTeamId: (m.away_team_id as string) ?? null,
    scoreHome: typeof m.score_home === "number" ? m.score_home : null,
    scoreAway: typeof m.score_away === "number" ? m.score_away : null,
  };
}

/** Les amicaux : deux requêtes, un match nomme ses équipes dans deux champs. */
async function amicaux(teamId: string): Promise<MatchDate[]> {
  const [chezNous, chezEux] = await Promise.all([
    adminDb.collection("matches").where("home_team_id", "==", teamId).get(),
    adminDb.collection("matches").where("away_team_id", "==", teamId).get(),
  ]);
  const parId = new Map<string, FirebaseFirestore.DocumentData>();
  for (const d of [...chezNous.docs, ...chezEux.docs]) parId.set(d.id, d.data());
  return [...parId.values()].map(versBilan);
}

/**
 * Réécrit des matchs de compétition au nom du club : ses inscriptions
 * (`nous`) deviennent `teamId`, les matchs où il n'est pas sont écartés.
 * Exporté pour être vérifiable sans base.
 */
export function auNomDuClub<T extends MatchPourBilan>(
  matchs: T[],
  nous: Set<string>,
  teamId: string,
): T[] {
  return matchs.flatMap((m) => {
    const chezNous = !!m.homeTeamId && nous.has(m.homeTeamId);
    const chezEux = !!m.awayTeamId && nous.has(m.awayTeamId);
    if (!chezNous && !chezEux) return [];
    // L'adversaire garde son identifiant de compétition, préfixé : il ne
    // doit jamais se confondre avec le club qu'on compte.
    return [{
      ...m,
      homeTeamId: chezNous ? teamId : `comp:${m.homeTeamId}`,
      awayTeamId: chezEux ? teamId : `comp:${m.awayTeamId}`,
    }];
  });
}

/** Les matchs de compétition terminés, réécrits au nom du club. */
async function enCompetition(teamId: string): Promise<MatchDate[]> {
  const competitions = await adminDb.collection("competitions").get();
  const parts = await Promise.all(
    competitions.docs
      .filter((c) => !c.data().is_sandbox)
      .map(async (c) => {
        const inscriptions = await c.ref
          .collection("comp_teams")
          .where("claimed_by_team_id", "==", teamId)
          .get();
        if (inscriptions.empty) return [];
        const nous = new Set(inscriptions.docs.map((d) => d.id));

        const termines = await c.ref
          .collection("comp_matches")
          .where("status", "==", "completed")
          .get();
        return auNomDuClub(termines.docs.map((d) => versBilan(d.data())), nous, teamId);
      }),
  );
  return parts.flat();
}

/**
 * La forme : les `n` derniers matchs comptés, du plus récent au plus ancien.
 * Même filtre que le bilan (voir compteDansLeBilan), pour que la forme ne
 * raconte jamais un match que le bilan ignore.
 */
export function formeDuClub(matchs: MatchDate[], teamId: string, n = 5): Resultat[] {
  return matchs
    .filter((m) => compteDansLeBilan(m) && (m.homeTeamId === teamId) !== (m.awayTeamId === teamId))
    .sort((a, b) => b.quand.localeCompare(a.quand))
    .slice(0, n)
    .map((m) => {
      const chezNous = m.homeTeamId === teamId;
      const pour = (chezNous ? m.scoreHome : m.scoreAway) as number;
      const contre = (chezNous ? m.scoreAway : m.scoreHome) as number;
      return pour > contre ? "V" : pour < contre ? "D" : "N";
    });
}

/**
 * Amicaux + compétitions. Ne jette pas pour une compétition illisible : sa
 * part manque, le reste du bilan tient — et le journal dit laquelle.
 */
export async function bilanCompletDuClub(teamId: string): Promise<BilanComplet> {
  const [a, c] = await Promise.all([
    amicaux(teamId),
    enCompetition(teamId).catch((err) => {
      console.error(`bilanCompletDuClub(${teamId}) : compétitions illisibles`, err);
      return [] as MatchDate[];
    }),
  ]);
  const tous = [...a, ...c];
  return { ...bilanDuClub(tous, teamId), forme: formeDuClub(tous, teamId) };
}
