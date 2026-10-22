// ============================================
// Le fil d'un match, sans écran : ce qu'il raconte et dans quel ordre.
//
// Sorti du composant MatchTimeline pour l'application mobile, qui dessine le
// même fil avec ses propres vues : deux copies de `composerFil`, c'est deux
// mi-temps posées à deux endroits différents le jour où l'une bouge.
//
// Module PARTAGÉ, sans SDK (ni firebase, ni next, ni React).
// ============================================

import {
  OWN_GOAL_DETAIL, PENALTY_FOUL_DETAIL, PENALTY_GOAL_DETAIL, RECITS_ISSUE_PENALTY, estStatistique, issuePenalty,
  penaltyDitParSonBut,
} from "@/lib/evenements";
import type { Langue } from "@/i18n/config";
import { textes } from "@/i18n/textes";
import type { Match } from "@/types";

export const TEXTES_FIL = textes(
  {
    butCsc: "But contre son camp",
    butPenalty: "But sur penalty",
    but: "But",
    jaune: "Carton jaune",
    expulsion2eJaune: "Expulsion (2e jaune)",
    rouge: "Carton rouge",
    changement: "Changement",
    arret: "Arrêt",
    fauteSur: (victime: string) => `Faute sur ${victime}`,
    faute: "Faute",
    fautePenalty: "Faute, penalty accordé",
    horsJeu: "Hors-jeu",
    sortie: "Sort, non remplacé",
    penalty: "Penalty",
    evenement: "Événement",
    changementSr: "Changement :",
    entre: "Entre",
    sort: "Sort",
    passeDe: (nom: string) => `passe de ${nom}`,
    retire: "Retiré",
    refuse: "Refusé",
    aTirer: "À tirer",
    coupDEnvoi: (heure: string | null) => (heure ? `Coup d'envoi ${heure}` : "Coup d'envoi"),
    miTemps: (score: string | null) => (score ? `Mi-temps ${score}` : "Mi-temps"),
    aucunFait: "Aucun fait de jeu enregistré",
    finDuMatch: (score: string, tab: string | null) => `Fin du match ${score}${tab ? ` (t.a.b. ${tab})` : ""}`,
    pasCommence: "Le match n'a pas encore commencé",
  },
  {
    butCsc: "Own goal",
    butPenalty: "Penalty goal",
    but: "Goal",
    jaune: "Yellow card",
    expulsion2eJaune: "Sent off (2nd yellow)",
    rouge: "Red card",
    changement: "Substitution",
    arret: "Save",
    fauteSur: (victime: string) => `Foul on ${victime}`,
    faute: "Foul",
    fautePenalty: "Foul, penalty awarded",
    horsJeu: "Offside",
    sortie: "Off, not replaced",
    penalty: "Penalty",
    evenement: "Event",
    changementSr: "Substitution:",
    entre: "On",
    sort: "Off",
    passeDe: (nom: string) => `assist by ${nom}`,
    retire: "Overturned",
    refuse: "Disallowed",
    aTirer: "To be taken",
    coupDEnvoi: (heure: string | null) => (heure ? `Kick-off ${heure}` : "Kick-off"),
    miTemps: (score: string | null) => (score ? `Half-time ${score}` : "Half-time"),
    aucunFait: "No match events recorded",
    finDuMatch: (score: string, tab: string | null) => `Full time ${score}${tab ? ` (pens ${tab})` : ""}`,
    pasCommence: "The match hasn't started yet",
  },
);

export type TextesFil = (typeof TEXTES_FIL)["fr"];

export type EvenementDuFil = NonNullable<Match["liveState"]>["events"][number];
type Evt = EvenementDuFil;

/** Le déroulé du match, d'où la timeline tire ses repères. */
export interface Deroule {
  /** Le match est lancé : en direct, ou terminé. */
  commence: boolean;
  termine: boolean;
  /** La période en cours : 1 première mi-temps, 2 pause, 3 seconde, 4 fin. */
  periode: number;
  /** L'heure prévue du coup d'envoi, « 18:00 ». */
  heure: string | null;
  /** Le score final, tel que le tableau d'affichage le porte. */
  score: { home: number; away: number } | null;
  /** La séance de tirs au but, s'il y en a eu une. */
  tab?: { home: number; away: number } | null;
  /**
   * La durée d'une mi-temps du format, pour écrire le temps additionnel
   * « 45+2' » et non « 47' ». Absente : quarante-cinq.
   */
  dureeMiTemps?: number;
  /** La durée d'une prolongation, pour écrire « 105+1' ». Absente : un tiers d'une mi-temps. */
  dureeProlongation?: number;
}

/** Ce qui n'appartient à aucun camp et se pose au centre. */
function estRepere(e: Evt): boolean {
  return e.type === "period_start" || e.type === "period_end";
}

export function libelleDuFait(e: Evt, t: TextesFil, langue: Langue): string {
  switch (e.type) {
    case "goal":
      if (e.detail === OWN_GOAL_DETAIL) return t.butCsc;
      // « Sur penalty » est la seule chose que la ligne du but ne pouvait pas
      // dire, et c'est ce qui la rend lisible seule : le penalty qui l'a
      // produit ne s'affiche plus, puisqu'il serait la même frappe deux fois.
      return e.detail === PENALTY_GOAL_DETAIL ? t.butPenalty : t.but;
    case "yellow_card":
      return t.jaune;
    case "red_card":
      return e.detail === "2e carton jaune" ? t.expulsion2eJaune : t.rouge;
    case "substitution":
      return t.changement;
    case "save":
      return t.arret;
    case "foul":
      // La faute se lit avec sa victime : « Faute sur Mensah » raconte
      // l'action, « Faute » ne dit que la moitié de ce qui s'est passé.
      // Celle qui a donne un penalty le dit : c'est elle qui l'explique.
      if (e.detail === PENALTY_FOUL_DETAIL) return t.fautePenalty;
      return e.victimPlayerName ? t.fauteSur(e.victimPlayerName) : t.faute;
    case "offside":
      return t.horsJeu;
    case "sortie":
      return t.sortie;
    case "penalty": {
      // Le seul des nouveaux qui reste dans le fil : un penalty accordé est
      // un moment du match, pas une ligne de compteur. Et ce qui intéresse
      // celui qui lit n'est pas qu'il ait été accordé, mais ce qu'il est
      // devenu — d'où l'issue, dès qu'elle est connue.
      const issue = issuePenalty(e.detail);
      return issue ? RECITS_ISSUE_PENALTY[langue][issue] : t.penalty;
    }
    default:
      return t.evenement;
  }
}

export type ElementDuFil =
  | { genre: "fait"; e: Evt }
  | { genre: "repere"; cle: string; texte: string }
  | { genre: "note"; texte: string };

/**
 * Le fil du plus ancien au plus récent, repères compris.
 *
 * LA MI-TEMPS SE POSE ENTRE LES DEUX PÉRIODES, donc il faut que les faits
 * disent la leur. Un résultat saisi après coup n'en porte pas (période 0) : on
 * ne saurait pas où la mettre, et elle n'apparaît pas. Son SCORE demande plus
 * encore — que chaque but dise sa période. Sinon le repère s'affiche sans
 * score, plutôt qu'avec un score faux.
 */
export function composerFil(
  events: Evt[],
  homeTeamId: string | null,
  d: Deroule | undefined,
  vide: string | undefined,
  t: TextesFil,
): ElementDuFil[] {
  // Les repères de période se posent tout seuls plus bas ; les comptables
  // (tir, corner, touche, coup franc) n'ont RIEN à faire ici. Ils existent
  // pour les compteurs de l'onglet Stats : vingt-cinq tirs et quarante touches
  // enterreraient l'unique but de la rencontre sous quatre écrans de
  // défilement. Voir `estStatistique` dans lib/evenements.
  const faits = events.filter(
    (e) => !estRepere(e) && !estStatistique(e.type) && !penaltyDitParSonBut(e),
  );
  const elements: ElementDuFil[] = [];

  if (d?.commence) {
    elements.push({ genre: "repere", cle: "coup-d-envoi", texte: t.coupDEnvoi(d.heure) });
  }

  const pauseAtteinte = !!d && (d.termine || d.periode >= 2);
  const poserLaMiTemps = pauseAtteinte && faits.some((e) => e.period >= 1);
  const scoreConnu = faits
    .filter((e) => e.type === "goal" && e.varStatus !== "cancelled")
    .every((e) => e.period >= 1);
  let domicile = 0;
  let exterieur = 0;
  let posee = false;
  const miTemps = (): ElementDuFil => ({
    genre: "repere",
    cle: "mi-temps",
    texte: t.miTemps(scoreConnu ? `${domicile}-${exterieur}` : null),
  });

  for (const e of faits) {
    if (poserLaMiTemps && !posee && e.period >= 2) {
      elements.push(miTemps());
      posee = true;
    }
    elements.push({ genre: "fait", e });
    // `team_id` désigne l'équipe créditée, but contre son camp compris.
    if (!posee && e.type === "goal" && e.varStatus !== "cancelled") {
      if (e.teamId === homeTeamId) domicile += 1;
      else exterieur += 1;
    }
  }
  // Pas encore de seconde période : la mi-temps ferme le fil.
  if (poserLaMiTemps && !posee) elements.push(miTemps());

  if (faits.length === 0 && d?.commence) {
    elements.push({ genre: "note", texte: vide ?? t.aucunFait });
  }

  if (d?.termine && d.score) {
    const tab = d.tab ? `${d.tab.home}-${d.tab.away}` : null;
    elements.push({ genre: "repere", cle: "fin", texte: t.finDuMatch(`${d.score.home}-${d.score.away}`, tab) });
  }
  return elements;
}
