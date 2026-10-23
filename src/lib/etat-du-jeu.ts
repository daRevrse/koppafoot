// ============================================
// L'etat du jeu : le ballon est-il en jeu, et sinon pourquoi.
//
// LA CONSOLE NE CONNAISSAIT QUE LE CHRONO. Il tournait ou non, et devait donc
// porter a lui seul trois choses que le terrain separe : la montre de
// l'arbitre (qui ne s'arrete presque jamais), le ballon en jeu ou mort (qui
// s'arrete cent fois), et ce qui peut encore se produire. Faute d'etat
// « ballon mort », la console devinait par des minuteurs — quinze secondes de
// verrou apres un but, soixante sur le bouton But — qui se levaient ballon
// encore mort, et laissaient la possession courir au profit du marqueur
// pendant toute la celebration.
//
// LE CHRONO SUIT LA MONTRE DE L'ARBITRE : il tourne du coup d'envoi au sifflet,
// ballon mort compris. Ce module dit le reste — ballon en jeu ou mort, pour
// quelle raison, et qui le remettra en jeu. Seuls les LONGS arrets mettent le
// ballon mort : le but jusqu'a l'engagement, le penalty jusqu'a son issue,
// l'arret de jeu declare par le scoreur, la mi-temps, l'interruption. Une
// touche ou un corner ne coupent rien ; la saisie donne juste le ballon au bon
// camp (voir `balleApres`).
//
// Module pur, sans SDK : la console l'ecrit dans `live_state.jeu`, le serveur
// et l'application mobile le relisent tel quel.
// ============================================

import type { IssuePenalty, TypeEvenement } from "@/lib/evenements";
import type { Seance } from "@/lib/tirs-au-but";

export type Cote = "home" | "away";

/** Pourquoi le ballon est mort. */
export type RaisonBalleMorte =
  /** Le direct est ouvert, le coup d'envoi n'a pas eu lieu. */
  | "avant"
  /** Un but : on attend l'engagement de l'equipe qui a encaisse. */
  | "but"
  /** Un penalty accorde : on attend son issue. */
  | "penalty"
  /** Un arret de jeu declare par le scoreur : blessure, bagarre, VAR... */
  | "arret"
  | "mi_temps"
  /** La pause avant les prolongations, ou entre les deux. */
  | "pause"
  /** La seance de tirs au but : le jeu est fini, la console tient la seance. */
  | "tirs_au_but"
  /** Orage, incident : le seul etat ou le chrono s'arrete aussi. */
  | "interruption";

/** Ce que `live_state.jeu` porte. La meme forme en base et dans l'application. */
export interface Jeu {
  balle: "en_jeu" | "morte";
  /** `null` ballon en jeu. */
  raison: RaisonBalleMorte | null;
  /** Le camp attendu pour remettre le ballon en jeu, quand on le sait. */
  engage: Cote | null;
  /** Qui a donne le coup d'envoi du match : l'autre engage la seconde periode. */
  premier: Cote | null;
}

export const JEU_AVANT: Jeu = { balle: "morte", raison: "avant", engage: null, premier: null };

export function autre(c: Cote): Cote {
  return c === "home" ? "away" : "home";
}

/** Ce que `lireJeu` lit d'un match : son statut et son horloge. */
interface MatchAvecHorloge {
  status: string;
  liveState?: {
    currentPeriod?: number | null;
    isTimerRunning?: boolean | null;
    timerOffset?: number | null;
    jeu?: Jeu | null;
  } | null;
}

/**
 * L'etat du jeu d'un match en direct.
 *
 * UN MATCH LANCE AVANT CE MODULE N'EN A PAS, et la console doit pourtant
 * pouvoir le reprendre en cours de route. On le deduit alors de l'horloge :
 * jamais lancee, c'est l'avant-match ; a la pause, la mi-temps ; arretee en
 * pleine periode — l'ancien bouton « Arreter » —, un arret de jeu.
 */
export function lireJeu(m: MatchAvecHorloge): Jeu {
  const ls = m.liveState;
  if (ls?.jeu) return ls.jeu;
  if (!ls) return JEU_AVANT;
  if (ls.currentPeriod === 2) return { balle: "morte", raison: "mi_temps", engage: null, premier: null };
  if (ls.currentPeriod === 5 || ls.currentPeriod === 7) {
    return { balle: "morte", raison: "pause", engage: null, premier: null };
  }
  if (ls.currentPeriod === 9) return { balle: "morte", raison: "tirs_au_but", engage: null, premier: null };
  if (ls.isTimerRunning) return { balle: "en_jeu", raison: null, engage: null, premier: null };
  if (!ls.timerOffset) return JEU_AVANT;
  return { balle: "morte", raison: "arret", engage: null, premier: null };
}

const EN_JEU = (j: Jeu): Jeu => ({ balle: "en_jeu", raison: null, engage: null, premier: j.premier });

/** Un but : le ballon revient au centre, l'equipe qui a encaisse engage. */
export function apresBut(j: Jeu, marqueur: Cote): Jeu {
  return { balle: "morte", raison: "but", engage: autre(marqueur), premier: j.premier };
}

/** Un penalty accorde : le jeu attend le tir. */
export function apresPenaltyAccorde(j: Jeu): Jeu {
  return { balle: "morte", raison: "penalty", engage: null, premier: j.premier };
}

/**
 * Ce que l'issue d'un penalty fait du jeu.
 *
 * Marque, c'est un but, que le jeu ait repris entre-temps ou non. Rate,
 * arrete ou retire, le ballon revient en jeu — mais seulement si le jeu
 * attendait encore ce penalty : le scoreur qui a deja relance en touchant une
 * pelouse ne doit pas voir son arret de jeu suivant efface.
 */
export function apresIssuePenalty(j: Jeu, issue: IssuePenalty, tireur: Cote): Jeu {
  if (issue === "marque") return apresBut(j, tireur);
  return j.raison === "penalty" ? EN_JEU(j) : j;
}

/** Le scoreur declare un arret de jeu. */
export function arretDeJeu(j: Jeu): Jeu {
  return { balle: "morte", raison: "arret", engage: null, premier: j.premier };
}

/** Le match est interrompu : le chrono s'arrete aussi. */
export function interrompre(j: Jeu): Jeu {
  return { balle: "morte", raison: "interruption", engage: null, premier: j.premier };
}

/** Le match reprend apres une interruption. */
export function reprendreLeMatch(j: Jeu): Jeu {
  return EN_JEU(j);
}

/** La mi-temps : l'equipe qui n'a pas donne le coup d'envoi engagera. */
export function miTemps(j: Jeu): Jeu {
  return {
    balle: "morte", raison: "mi_temps", engage: j.premier ? autre(j.premier) : null, premier: j.premier,
  };
}

/**
 * Une pause des prolongations. Avant la premiere, un nouveau tirage au sort
 * decide qui engage (`engage` nul) ; entre les deux, c'est l'autre equipe.
 */
export function pause(j: Jeu, engage: Cote | null): Jeu {
  return { balle: "morte", raison: "pause", engage, premier: j.premier };
}

/** Le jeu est fini, la seance de tirs au but commence. */
export function seanceDeTirs(j: Jeu): Jeu {
  return { balle: "morte", raison: "tirs_au_but", engage: null, premier: j.premier };
}

/**
 * Le ballon est remis en jeu par `cote` — un appui sur sa pelouse, ou sur le
 * bouton central de reprise.
 *
 * Au coup d'envoi, on retient qui a engage. Une interruption ne se leve pas
 * ainsi : elle a arrete le chrono, et ne se reprend que par son propre bouton.
 */
export function relancer(j: Jeu, cote: Cote): Jeu {
  if (j.balle === "en_jeu" || j.raison === "interruption" || j.raison === "tirs_au_but") return j;
  // Un coup d'envoi tire au sort — celui du match, ou celui des prolongations :
  // l'equipe qui engage est retenue, l'autre engagera la periode suivante.
  if (j.raison === "avant" || (j.raison === "pause" && !j.engage)) {
    return { balle: "en_jeu", raison: null, engage: null, premier: cote };
  }
  return EN_JEU(j);
}

/**
 * Le but qui avait mis le ballon mort est retire.
 *
 * LA CONSOLE NE DEVINE PAS ce qui s'est vraiment passe — un tir pris pour un
 * but, un but refuse : elle passe en arret de jeu, et c'est le scoreur qui dit
 * qui repart. Si le jeu avait deja repris, rien ne change.
 */
export function apresRetraitDuBut(j: Jeu): Jeu {
  return j.raison === "but" ? arretDeJeu(j) : j;
}

const VERROUS: Record<RaisonBalleMorte, string> = {
  avant: "Avant-match",
  but: "But · engagement",
  penalty: "Penalty",
  arret: "Arrêt de jeu",
  mi_temps: "Mi-temps",
  pause: "Pause",
  tirs_au_but: "Tirs au but",
  interruption: "Match interrompu",
};

/**
 * Pourquoi les actions de jeu sont fermees, ou `null` quand elles sont
 * ouvertes. Les cartons et les changements ne le sont jamais : ce sont
 * justement les gestes des arrets de jeu.
 */
export function verrou(j: Jeu): string | null {
  return j.balle === "en_jeu" || !j.raison ? null : VERROUS[j.raison];
}

/**
 * Le camp qui a le ballon apres une saisie, ou `null` quand elle n'en dit rien.
 *
 * `cote` est celui de l'evenement : le camp qui obtient le corner, celui du
 * joueur qui commet la faute ou tire. Un tir, cadre ou non, rend le ballon a
 * l'adversaire — six metres, ou ballon capte ; parti en corner, le scoreur
 * saisit le corner, qui le rend a l'attaque.
 */
export function balleApres(type: TypeEvenement, cote: Cote): Cote | null {
  switch (type) {
    case "corner":
    case "throw_in":
    case "free_kick":
    case "penalty":
    case "save":
    case "ball_won":
      return cote;
    case "foul":
    case "offside":
    case "shot":
    case "shot_on_target":
    case "ball_lost":
      return autre(cote);
    default:
      return null;
  }
}

/**
 * Le geste de ballon qu'on propose a un joueur de `cote`, selon le camp qui a
 * le ballon : le perdre s'il est a son equipe, le gagner sinon.
 *
 * QUAND PERSONNE N'A LE BALLON, ON NE PEUT QUE LE GAGNER. Une perte suppose
 * qu'on l'avait, et le scoreur n'a encore rien dit de qui l'a.
 *
 * Un ballon, une saisie : apres la perte d'un joueur, le ballon passe en face
 * (voir `balleApres`), et ceux d'en face n'ont plus que « Perte ». Le
 * proprietaire l'a choisi, contre un rattrapage qui aurait laisse saisir les
 * deux bouts de la meme interception.
 */
export function actionDeBallon(cote: Cote, ballon: Cote | null): "ball_won" | "ball_lost" {
  return ballon === cote ? "ball_lost" : "ball_won";
}

/**
 * Les camps passes sous le minimum de joueurs : le match ne peut plus
 * continuer pour eux (sept a onze, a proportion du format — voir minPlayers).
 */
export function campsSousLeMinimum(surLeTerrain: Record<Cote, number>, minimum: number): Cote[] {
  return (["home", "away"] as const).filter((c) => surLeTerrain[c] < minimum);
}

/**
 * Le score d'un match arrete par le forfait de `forfaitDe` : trois a zero pour
 * l'adversaire, ou le score du moment s'il lui est plus favorable.
 */
export function scoreDeForfait(
  score: { home: number; away: number },
  forfaitDe: Cote,
): { home: number; away: number } {
  const adverse = autre(forfaitDe);
  if (score[adverse] - score[forfaitDe] >= 3) return score;
  return forfaitDe === "home" ? { home: 0, away: 3 } : { home: 3, away: 0 };
}

/** Ce qu'un geste de la console change a la fois. */
export interface Transition {
  jeu?: Jeu;
  /** La seance de tirs au but, ecrite tir apres tir. Voir lib/tirs-au-but. */
  tirsAuBut?: Seance;
  periode?: number;
  chrono?:
    /**
     * Le chrono part (ou repart) d'ou il etait — ou de `depuis`, quand on
     * annule une mi-temps sifflee trop tot : il reprend comme s'il ne
     * s'etait jamais arrete.
     */
    | { demarrer: true; depuis?: number }
    /** Le chrono s'arrete, sur cette valeur. */
    | { arreterA: number }
    /** Le chrono est recale, sans changer de marche. */
    | { decalage: number };
}

/**
 * Les champs a ecrire pour une transition, EN UNE SEULE ECRITURE.
 *
 * La reprise de la seconde periode partait en deux ecritures — le chrono, puis
 * la periode — et un spectateur voyait entre les deux une seconde mi-temps au
 * chrono arrete. Le geste et son effet partent desormais ensemble.
 */
export function champsDeTransition(t: Transition, maintenant: number = Date.now()): Record<string, unknown> {
  const champs: Record<string, unknown> = {};
  if (t.jeu) champs["live_state.jeu"] = t.jeu;
  if (t.tirsAuBut) champs["live_state.tirs_au_but"] = t.tirsAuBut;
  if (t.periode !== undefined) champs["live_state.current_period"] = t.periode;
  if (t.chrono && "demarrer" in t.chrono) {
    champs["live_state.is_timer_running"] = true;
    champs["live_state.timer_start_at"] = new Date(maintenant).toISOString();
    if (t.chrono.depuis !== undefined) champs["live_state.timer_offset"] = t.chrono.depuis;
  } else if (t.chrono && "arreterA" in t.chrono) {
    champs["live_state.is_timer_running"] = false;
    champs["live_state.timer_start_at"] = null;
    champs["live_state.timer_offset"] = t.chrono.arreterA;
  } else if (t.chrono && "decalage" in t.chrono) {
    champs["live_state.timer_offset"] = t.chrono.decalage;
  }
  return champs;
}
