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

type Evt = NonNullable<Match["liveState"]>["events"][number];

export interface Buteur {
  nom: string;
  /** Les minutes, « 29' », dans l'ordre. Vide quand on ne les connaît pas. */
  minutes: string[];
  /** Le nombre de buts : c'est lui qui parle quand les minutes manquent. */
  nombre: number;
  /** But contre son camp. */
  csc: boolean;
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
      buteur = { nom, minutes: [], nombre: 0, csc };
      liste.push(buteur);
    }
    buteur.nombre += 1;
    if (e.minute) buteur.minutes.push(`${e.minute}'`);
  }
  return camps;
}

/**
 * Un match RENSEIGNÉ n'a pas de direct : ses buteurs sont ceux que la saisie
 * a nommés, sans minutes, et tous du camp qui l'a saisi.
 */
export function buteursRenseignes(scorers: RecordedScorer[], camp: "home" | "away"): ButeursDuMatch {
  const liste: Buteur[] = scorers
    .filter((s) => s.buts > 0)
    .map((s) => ({ nom: s.nom, minutes: [], nombre: s.buts, csc: false }));
  return camp === "home" ? { home: liste, away: [] } : { home: [], away: liste };
}
