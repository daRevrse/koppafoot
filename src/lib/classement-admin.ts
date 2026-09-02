// ============================================
// Server-only. Le classement des joueurs : on le calcule, on le range, on le
// relit.
//
// POURQUOI UN DOCUMENT PLUTOT QU'UN CALCUL A LA LECTURE : le classement lit
// TOUS les matchs terminés de la plateforme et toutes leurs feuilles. Le
// refaire à chaque affichage de l'accueil coûterait cette lecture par
// visiteur, pour un résultat qui ne bouge qu'à la fin d'un match. On le
// calcule donc quand un match se termine, et on le sert tout fait.
//
// C'est aussi ce qui rend la FLÈCHE possible. « Mouvement dans le classement »
// suppose qu'on se souvienne du classement d'avant : sans document, il n'y a
// pas d'avant. Les clés du calcul précédent restent donc à côté du résultat.
// ============================================

import { adminDb } from "@/lib/firebase-admin";
import { getPublicCompetitions } from "@/lib/competition-admin";
import { toCompMatch } from "@/lib/competition-mappers";
import { calculerClassements, mouvements } from "@/lib/classement";
import type {
  ClassementsPublies, ContributionDirecte, LigneClassement, LigneGardien,
  LignePubliee, MatchAClasser,
} from "@/lib/classement";
import { normaliserPoste } from "@/lib/postes";
import type { FirestoreCompMatch, FirestoreMatch, LineupEntry } from "@/types";

const DOC = "rankings/top_players";

const VIDE: ClassementsPublies = {
  performances: [], gardiens: [], matchsRetenus: 0, calculeLe: null,
};

/**
 * Tous les matchs qui comptent : les compétitions de la plateforme, et les
 * amicaux.
 *
 * Pas le football mondial : le fournisseur externe ne donne pas le détail par
 * joueur, et ses matchs n'ont pas de feuille chez nous. Un classement de
 * joueurs togolais n'a de toute façon rien à voir avec la Ligue 1.
 */
async function matchsDeLaPlateforme(): Promise<MatchAClasser[]> {
  const matchs: MatchAClasser[] = [];

  const comps = await getPublicCompetitions();
  const parCompetition = await Promise.all(
    comps.map(async (c) => {
      const snap = await adminDb
        .collection("competitions").doc(c.id)
        .collection("comp_matches").where("status", "==", "completed").get();
      return snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));
    }),
  );
  for (const lot of parCompetition) matchs.push(...lot);

  // Les amicaux vivent dans `matches`, à plat, et portent depuis peu la même
  // feuille de match (voir lib/console-pilote).
  //
  // Convertis ICI, et pas par `toMatch` : ce mappeur-là vit dans lib/firestore,
  // qui importe le SDK CLIENT. L'appeler depuis une route serveur tirerait tout
  // le client Firebase avec lui. Le classement ne lit de toute façon qu'une
  // poignée de champs.
  const amicaux = await adminDb
    .collection("matches").where("status", "==", "completed").get();
  for (const d of amicaux.docs) {
    matchs.push(amicalEnCompMatch(d.id, d.data() as FirestoreMatch));
  }

  return matchs;
}

/** La feuille d'un camp, ou son héritage. Voir `FirestoreMatch.home_lineup`. */
function feuille(
  d: FirestoreMatch,
  cote: "home" | "away",
): LineupEntry[] {
  const lignes = cote === "home"
    ? (d.home_lineup ?? d.home_ghost_lineup ?? [])
    : (d.away_lineup ?? d.away_ghost_lineup ?? []);
  return lignes.map((e) => ({
    playerId: e.player_id,
    name: e.name,
    number: e.number,
    role: e.role,
    userId: e.user_id ?? null,
    position: normaliserPoste(e.position),
  }));
}

/**
 * Les buteurs d'un match renseigné après coup.
 *
 * Vide sur un match tenu à la console : celui-là a une feuille et des
 * événements, qui valent mieux.
 */
function contributionsDirectes(d: FirestoreMatch): ContributionDirecte[] {
  return (d.recorded_scorers ?? []).map((b) => ({
    playerId: b.player_id ?? "",
    nom: b.nom ?? "",
    // `sansCompte` dit exactement ce qu'il dit : l'identifiant n'est alors pas
    // un compte, et le classement retombera sur le nom.
    userId: b.sansCompte ? null : (b.player_id ?? null),
    buts: b.buts ?? 0,
    passes: b.passes ?? 0,
  }));
}

/** Un amical réduit à ce que le calcul du classement lit. */
function amicalEnCompMatch(id: string, d: FirestoreMatch): MatchAClasser {
  return {
    id,
    competitionId: "friendly",
    status: "completed",
    date: d.date ?? null,
    time: d.time ?? null,
    homeTeamId: d.home_team_id ?? null,
    awayTeamId: d.away_team_id ?? null,
    homeTeamName: d.home_team_name ?? "",
    awayTeamName: d.away_team_name ?? "",
    scoreHome: d.score_home ?? 0,
    scoreAway: d.score_away ?? 0,
    homeLineup: feuille(d, "home"),
    awayLineup: feuille(d, "away"),
    homeOnPitch: d.home_on_pitch ?? [],
    awayOnPitch: d.away_on_pitch ?? [],
    liveState: d.live_state
      ? {
          currentPeriod: d.live_state.current_period,
          timerStartAt: d.live_state.timer_start_at,
          timerOffset: d.live_state.timer_offset,
          isTimerRunning: d.live_state.is_timer_running,
          events: (d.live_state.events ?? []).map((e) => ({
            id: e.id,
            type: e.type,
            period: e.period,
            minute: e.minute,
            teamId: e.team_id,
            playerId: e.player_id,
            playerName: e.player_name,
            detail: e.detail,
            assistPlayerId: e.assist_player_id ?? null,
            assistPlayerName: e.assist_player_name ?? null,
            victimPlayerId: e.victim_player_id ?? null,
            victimPlayerName: e.victim_player_name ?? null,
            varStatus: e.var_status ?? null,
            createdAt: e.created_at,
          })),
        }
      : null,
    contributionsDirectes: contributionsDirectes(d),
  } as unknown as MatchAClasser;
}

/**
 * Recalcule et publie. Rendu : ce qui vient d'être écrit.
 *
 * Idempotent : deux appels de suite donnent le même classement. Le second
 * remet en revanche toutes les flèches à zéro, puisqu'il compare le résultat
 * à lui-même — c'est voulu, une flèche dit « depuis la dernière fois », pas
 * « depuis un moment ».
 */
export async function recalculerClassements(): Promise<ClassementsPublies> {
  const matchs = await matchsDeLaPlateforme();
  const { performances, gardiens, matchsRetenus } = calculerClassements(matchs);

  const ref = adminDb.doc(DOC);
  const avant = (await ref.get()).data() as
    | { cles_performances?: string[]; cles_gardiens?: string[] }
    | undefined;

  const mvtPerf = mouvements(performances, avant?.cles_performances ?? []);
  const mvtGk = mouvements(gardiens, avant?.cles_gardiens ?? []);

  const publie: ClassementsPublies = {
    performances: performances.map((l) => ({ ...l, mouvement: mvtPerf.get(l.cle) ?? null })),
    gardiens: gardiens.map((l) => ({ ...l, mouvement: mvtGk.get(l.cle) ?? null })),
    matchsRetenus,
    calculeLe: new Date().toISOString(),
  };

  await ref.set({
    performances: publie.performances,
    gardiens: publie.gardiens,
    matchs_retenus: matchsRetenus,
    // Les clés du calcul qu'on vient de faire : ce sont elles qui serviront de
    // « avant » au suivant.
    cles_performances: performances.map((l) => l.cle),
    cles_gardiens: gardiens.map((l) => l.cle),
    calcule_le: publie.calculeLe,
  });

  return publie;
}

/**
 * Le classement publié, pour l'affichage.
 *
 * Dégrade en classement vide plutôt que de lever : une page d'accueil ne doit
 * pas tomber parce qu'un classement manque. Le composant montre alors son
 * message d'attente.
 */
export async function lireClassements(): Promise<ClassementsPublies> {
  try {
    const snap = await adminDb.doc(DOC).get();
    if (!snap.exists) return VIDE;
    const d = snap.data() ?? {};
    return {
      performances: (d.performances ?? []) as LignePubliee<LigneClassement>[],
      gardiens: (d.gardiens ?? []) as LignePubliee<LigneGardien>[],
      matchsRetenus: (d.matchs_retenus ?? 0) as number,
      calculeLe: (d.calcule_le ?? null) as string | null,
    };
  } catch (err) {
    console.error("lireClassements failed:", err);
    return VIDE;
  }
}
