// ============================================
// Les buts et les passes qu'un match couvert en direct crédite à chacun.
//
// LA FIN D'UN AMICAL NE CRÉDITAIT QUE LES BUTS, et mal. Les buts venaient du
// fil du direct, chaque but y compris : celui que la VAR a refusé, et celui
// marqué contre son camp, compté à son auteur comme un but pour son équipe.
// Les passes, elles, venaient de la participation de chaque compte, que le
// direct n'écrit jamais : une passe saisie à la console n'atteignait jamais la
// carrière, ni d'un compte ni d'un joueur sans compte (constaté le 2026-11-04 :
// « 1 match, 2 buts et 0 passe » à la fusion d'un joueur qui avait fait
// marquer).
//
// MÊMES RÈGLES QUE LE CLASSEMENT (lib/classement) et les statistiques d'un
// joueur (lib/player-stats) : un but refusé par la VAR ne compte pas, ni sa
// passe ; un but contre son camp ne crédite ni son auteur ni personne ; on ne
// se fait pas la passe à soi-même.
//
// Pur : aucun SDK. Lit les événements tels que Firestore les range.
// ============================================

import { OWN_GOAL_DETAIL } from "@/lib/evenements";

export interface EvenementDuDirect {
  type?: string | null;
  player_id?: string | null;
  assist_player_id?: string | null;
  detail?: string | null;
  var_status?: string | null;
}

export interface ContributionsDuDirect {
  buts: Record<string, number>;
  passes: Record<string, number>;
}

export function contributionsDuDirect(events: EvenementDuDirect[] | null | undefined): ContributionsDuDirect {
  const buts: Record<string, number> = {};
  const passes: Record<string, number> = {};
  for (const e of events ?? []) {
    if (e.type !== "goal" || e.var_status === "cancelled" || e.detail === OWN_GOAL_DETAIL) continue;
    if (e.player_id) buts[e.player_id] = (buts[e.player_id] ?? 0) + 1;
    if (e.assist_player_id && e.assist_player_id !== e.player_id) {
      passes[e.assist_player_id] = (passes[e.assist_player_id] ?? 0) + 1;
    }
  }
  return { buts, passes };
}
