// Server-only. Les matchs amicaux, pour le tableau du Direct.
//
// Pourquoi ici et pas via le SDK client : le Direct est rendu côté serveur
// pour le premier affichage et le partage. Les amicaux sont déjà en lecture
// publique dans firestore.rules (`match /matches/{matchId} { allow read: if
// true }`), donc les publier ne change rien à ce qui est visible, on change
// seulement l'endroit d'où on les lit.
//
// Ils sont rendus dans la forme d'un `CompMatch` et rattachés à une
// compétition synthétique. Le tableau du Direct groupe ses lignes par
// compétition ; sans ce rattachement il aurait fallu un second chemin de
// rendu pour une poignée de matchs qui s'affichent exactement pareil.

import { adminDb } from "@/lib/firebase-admin";
import type { CompMatch } from "@/types";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";

export { FRIENDLY_COMP_ID, FRIENDLY_COMPETITION } from "@/lib/friendlies-shared";

type Row = Record<string, unknown>;

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/**
 * Les statuts d'un amical et ceux d'un match de compétition ne portent pas
 * les mêmes mots : « upcoming » d'un côté, « scheduled » de l'autre. Le
 * tableau ne connaît que les seconds.
 */
function toCompStatus(v: unknown): CompMatch["status"] | null {
  switch (v) {
    case "live": return "live";
    case "completed": return "completed";
    case "cancelled": return "cancelled";
    case "upcoming": return "scheduled";
    // « challenge », « pending », « draft », « delayed » : un match qui n'est
    // pas encore accepté n'a rien à faire sur un tableau public.
    default: return null;
  }
}

/**
 * Les amicaux à afficher, dans la forme attendue par le tableau.
 *
 * Fenêtre volontairement large et filtrée en mémoire plutôt qu'en requête :
 * `date` est une chaîne et le statut vit dans un autre champ, donc filtrer
 * les deux en base demanderait un index composite pour une collection qui
 * tient en quelques centaines de documents.
 */
export async function getPublicFriendlies(max = 60): Promise<CompMatch[]> {
  try {
    const snap = await adminDb.collection("matches").get();

    const out: CompMatch[] = [];
    for (const doc of snap.docs) {
      const d = doc.data() as Row;
      const status = toCompStatus(d.status);
      if (!status) continue;

      const date = str(d.date);
      if (!date) continue;

      out.push({
        id: doc.id,
        competitionId: FRIENDLY_COMP_ID,
        stage: "group",
        group: null,
        round: null,
        bracketSlot: null,
        homeSource: null,
        awaySource: null,
        homeTeamId: str(d.home_team_id),
        awayTeamId: str(d.away_team_id),
        homeTeamName: str(d.home_team_name) ?? "Équipe",
        awayTeamName: str(d.away_team_name) ?? "Équipe",
        // Un amical n'a pas de blason dans le modèle de données.
        homeTeamLogo: null,
        awayTeamLogo: null,
        bannerUrl: null,
        date,
        time: str(d.time),
        venueName: str(d.venue_name),
        venueCity: str(d.venue_city),
        status,
        scoreHome: num(d.score_home),
        scoreAway: num(d.score_away),
        penaltyHome: null,
        penaltyAway: null,
        winnerTeamId: null,
        forfeitByTeamId: null,
        feedsIntoMatchId: null,
        feedsIntoSlot: null,
        homeLineup: [],
        awayLineup: [],
        homeLineupReady: false,
        awayLineupReady: false,
        homeOnPitch: [],
        awayOnPitch: [],
        liveState: null,
        createdAt: "",
        updatedAt: "",
      } as CompMatch);
    }

    return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, max);
  } catch (err) {
    console.error("getPublicFriendlies failed:", err);
    return [];
  }
}
