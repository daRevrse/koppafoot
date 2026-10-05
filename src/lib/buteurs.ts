import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import type { Match, RecordedScorer } from "@/types";

// ============================================
// Les buteurs d'un match, pour le tableau d'affichage.
//
// GROUPÉS PAR JOUEUR, SES MINUTES À LA SUITE : « Mastantuono 29', 30' ». Un
// doublé se lit d'un coup d'œil, là où deux lignes identiques obligeaient à
// comparer des noms.
//
// UN BUT CONTRE SON CAMP SE RANGE DU CÔTÉ QU'IL A FAIT MARQUER, et se
// signale. C'est la convention des événements : `team_id` désigne l'équipe
// créditée, le nom celui qui a trompé son propre gardien (voir
// setCompMatchResult).
//
// Un but refusé par la VAR n'y figure pas : il n'est pas au tableau. Un but
// sans nom de buteur non plus — « Inconnu 23' » n'apprend rien que le score
// ne dise déjà.
// ============================================

/**
 * Ce que le calcul lit d'un événement, et rien de plus : le flyer le nourrit
 * depuis le serveur, avec des événements lus bruts dans Firestore, sans passer
 * par le convertisseur complet du client (voir match-public).
 */
type Evt = Pick<
  NonNullable<Match["liveState"]>["events"][number],
  "type" | "minute" | "teamId" | "playerName" | "detail" | "varStatus"
> & { assistPlayerName?: string | null };

export interface Buteur {
  nom: string;
  /** Les minutes, « 29' », dans l'ordre. Vide quand on ne les connaît pas. */
  minutes: string[];
  /** Le nombre de buts : c'est lui qui parle quand les minutes manquent. */
  nombre: number;
  /** But contre son camp. */
  csc: boolean;
  /**
   * Ceux qui lui ont donné ses buts, dans l'ordre et sans doublon. La console
   * les nomme ; un but saisi avant qu'elle le fasse n'en a pas.
   */
  passeurs: string[];
}

export interface ButeursDuMatch {
  home: Buteur[];
  away: Buteur[];
}

export function buteursDuMatch(
  events: Evt[],
  homeTeamId: string | null,
  /** Le nom à afficher, quand la page le sait mieux que l'événement. */
  nomDe?: (e: Evt) => string,
): ButeursDuMatch {
  const camps: ButeursDuMatch = { home: [], away: [] };
  const buts = events
    .filter((e) => e.type === "goal" && e.varStatus !== "cancelled")
    // Une minute inconnue (0) passe en dernier : elle ne précède rien.
    .sort((a, b) => (a.minute || Infinity) - (b.minute || Infinity));

  for (const e of buts) {
    const nom = (nomDe ? nomDe(e) : e.playerName ?? "").trim();
    if (!nom) continue;
    const csc = e.detail === OWN_GOAL_DETAIL;
    const liste = e.teamId === homeTeamId ? camps.home : camps.away;
    let buteur = liste.find((b) => b.nom === nom && b.csc === csc);
    if (!buteur) {
      buteur = { nom, minutes: [], nombre: 0, csc, passeurs: [] };
      liste.push(buteur);
    }
    buteur.nombre += 1;
    if (e.minute) buteur.minutes.push(`${e.minute}'`);
    const passeur = e.assistPlayerName?.trim();
    if (passeur && !csc && !buteur.passeurs.includes(passeur)) buteur.passeurs.push(passeur);
  }
  return camps;
}

/**
 * Les buteurs d'un match renseigné, tels que `recorded_scorers` les garde.
 *
 * UN SEUL LECTEUR, PARCE QUE QUATRE SE TROMPAIENT. La route qui renseigne un
 * match (api/matches/record) écrit ses lignes telles quelles, en camelCase :
 * `playerId`. Les lecteurs — fiche de match, fiche du club, classement —
 * lisaient `player_id`, qui n'a jamais existé. La fiche du club écartait donc
 * TOUS les buteurs des matchs renseignés, et le classement ne savait à quel
 * compte rendre leurs buts.
 *
 * `player_id` reste lu en second, par prudence : un document écrit à la main
 * ou par un outil d'import ne doit pas perdre ses buteurs pour une casse.
 * Une ligne sans identifiant est écartée : on ne sait à qui la rendre.
 */
export function lireButeursRenseignes(brut: unknown): RecordedScorer[] {
  if (!Array.isArray(brut)) return [];
  const lignes: RecordedScorer[] = [];
  for (const r of brut) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, unknown>;
    const id = typeof x.playerId === "string" && x.playerId
      ? x.playerId
      : typeof x.player_id === "string" && x.player_id ? x.player_id : null;
    if (!id) continue;
    lignes.push({
      playerId: id,
      sansCompte: x.sansCompte === true,
      nom: typeof x.nom === "string" ? x.nom : "",
      buts: typeof x.buts === "number" && x.buts > 0 ? x.buts : 0,
      passes: typeof x.passes === "number" && x.passes > 0 ? x.passes : 0,
    });
  }
  return lignes;
}

/**
 * Un match RENSEIGNÉ n'a pas de direct : ses buteurs sont ceux que la saisie
 * a nommés, sans minutes, et tous du camp qui l'a saisi.
 */
export function buteursRenseignes(scorers: RecordedScorer[], camp: "home" | "away"): ButeursDuMatch {
  const liste: Buteur[] = scorers
    .filter((s) => s.buts > 0)
    .map((s) => ({ nom: s.nom, minutes: [], nombre: s.buts, csc: false, passeurs: [] }));
  return camp === "home" ? { home: liste, away: [] } : { home: [], away: liste };
}
