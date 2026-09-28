import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import type { FirestoreMatch } from "@/types";

// ============================================
// Le crédit d'un match RENSEIGNÉ après coup (voir /api/matches/record).
//
// Sorti de sa route pour être appliqué d'un seul endroit : la contresignature
// de l'adversaire, la suppression, et désormais l'arbitrage d'un score
// contesté par l'administration (voir lib/admin-serveur). Trois appelants qui
// créditent chacun à leur façon, ce sont trois façons de doubler un compteur.
// ============================================

export interface Buteur {
  playerId: string;
  /** Un joueur sans compte vit sur `teams/{id}/ghost_players`, pas sur `users`. */
  sansCompte: boolean;
  nom: string;
  buts: number;
  passes: number;
}

/**
 * Le crédit d'un match renseigné, appliqué ou repris.
 *
 * Repris à hauteur DE CE QUI A ÉTÉ DONNÉ, et non de ce qu'on donnerait
 * aujourd'hui : la règle a changé en cours de route, voir `reprendreLesStats`.
 */
export function crediter(
  tx: Transaction,
  m: FirestoreMatch,
  matchId: string,
  buteurs: Buteur[],
  equipeReelle: string,
  sens: 1 | -1,
) {
  const scoreHome = m.score_home ?? 0;
  const scoreAway = m.score_away ?? 0;
  const resultatHome = scoreHome > scoreAway ? "win" : scoreHome < scoreAway ? "loss" : "draw";
  const resultatAway = resultatHome === "win" ? "loss" : resultatHome === "loss" ? "win" : "draw";

  const bilan = (r: "win" | "loss" | "draw") => ({
    matches_played: FieldValue.increment(sens),
    wins: FieldValue.increment(r === "win" ? sens : 0),
    losses: FieldValue.increment(r === "loss" ? sens : 0),
    draws: FieldValue.increment(r === "draw" ? sens : 0),
    updated_at: FieldValue.serverTimestamp(),
  });

  // Un identifiant vide, c'est le camp hors plateforme : il n'a pas de club.
  if (m.home_team_id) tx.update(adminDb.collection("teams").doc(m.home_team_id), bilan(resultatHome));
  if (m.away_team_id) tx.update(adminDb.collection("teams").doc(m.away_team_id), bilan(resultatAway));

  // ON NE CRÉDITE PLUS LES BUTS (voir l'en-tête), MAIS ON REND CE QU'ON A PRIS.
  // Les matchs renseignés avant ce changement ont bel et bien crédité buts et
  // passes ; les reprendre à la suppression demande de savoir ce qui a été
  // donné. Leur document ne porte pas `recorded_scorer_stats`, et cette absence
  // est la réponse : ancien régime. Un match crédité depuis le porte à `false`,
  // et sa reprise ne touche donc que la présence — symétrique, comme il faut.
  const reprendreLesStats = sens === -1 && m.recorded_scorer_stats !== false;

  for (const b of buteurs) {
    const compteurs = {
      matches_played: FieldValue.increment(sens),
      updated_at: FieldValue.serverTimestamp(),
      ...(reprendreLesStats
        ? {
          goals: FieldValue.increment(b.buts * sens),
          assists: FieldValue.increment(b.passes * sens),
        }
        : {}),
    };
    if (b.sansCompte) {
      tx.update(
        adminDb.collection("teams").doc(equipeReelle).collection("ghost_players").doc(b.playerId),
        compteurs,
      );
    } else {
      tx.update(adminDb.collection("users").doc(b.playerId), {
        ...compteurs,
        last_match_id: sens === 1 ? matchId : FieldValue.delete(),
      });
    }
  }
}
