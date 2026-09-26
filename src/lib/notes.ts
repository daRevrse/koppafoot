// ============================================
// La note d'un joueur, calculee depuis ce que la console a saisi.
//
// POURQUOI CALCULEE, ET NON DONNEE. Il existait deja des notes dans le
// produit : `player_ratings`, ou un supporter note un joueur APRES le match.
// Deux problemes, tous les deux fatals au direct. La note arrive trop tard —
// elle ne dit rien pendant que le match se joue, qui est le seul moment ou on
// la regarde. Et elle repose sur des votants : l'audit de production comptait
// trente-deux comptes pour zero like, donc une moyenne qui tiendrait sur un ou
// deux avis, quand elle ne tiendrait sur aucun.
//
// Celle-ci ne demande rien a personne. Elle part de 6,0 — la note de celui qui
// a fait son match, sans plus — et elle bouge a chaque fait saisi. Elle est la
// contrepartie exacte du travail du scoreur : chaque arret, chaque tir cadre,
// chaque faute qu'il prend la peine de poser se voit immediatement quelque
// part. C'est aussi la reponse a ce que l'audit disait du reste — un modele
// pret, et une saisie qui n'a jamais eu lieu faute d'en voir l'effet.
//
// CE MODULE NE DESIGNE PAS D'HOMME DU MATCH. Il l'a fait un temps, en rendant
// la meilleure note des deux camps — mais le produit en a un vrai, choisi par
// le scoreur au coup de sifflet (voir lib/mvp). Une distinction decernee par
// un calcul a cote d'une distinction decernee par quelqu'un, ce sont deux
// verites concurrentes sur la meme ligne de fiche.
//
// ELLE NE PRETEND PAS MESURER UN MATCH DE FOOTBALL. Elle mesure ce qui a ete
// SAISI. Un milieu qui tient son couloir sans tirer ni faire faute finira a
// 6,0, et c'est honnete : personne n'a rien note de lui. D'ou le seuil de
// minutes plus bas, et d'ou le fait que la note s'affiche a cote du nombre de
// faits qui la fondent, jamais seule.
// ============================================

import { OWN_GOAL_DETAIL, type TypeEvenement } from "@/lib/evenements";
import { normaliserPoste } from "@/lib/postes";
import { computeMinutesPlayed, type MatchJoue } from "@/lib/player-stats";
import type { LineupEntry } from "@/types";

/** L'evenement tel que la console et la fiche publique le tiennent. */
export interface FaitDeMatch {
  type: TypeEvenement;
  minute: number;
  teamId: string;
  playerId?: string;
  detail?: string;
  assistPlayerId?: string | null;
  victimPlayerId?: string | null;
  outPlayerId?: string | null;
}

/** La note de depart : celui qui a joue, et dont on n'a rien note de plus. */
export const NOTE_DE_BASE = 6;

/**
 * En dessous, on n'affiche pas de note.
 *
 * Un remplacant entre a la 88e n'a pas eu le temps de meriter quoi que ce
 * soit : lui coller 6,0 le met au niveau de celui qui a tenu le match entier,
 * et lui coller moins le punit de son entree tardive. On se tait.
 */
export const MINUTES_MINIMUM = 15;

/**
 * Ce que chaque fait vaut.
 *
 * Les valeurs sont volontairement petites devant le but : une note se
 * construit sur la duree, et un seul geste ne doit pas la faire basculer —
 * sauf le but et l'expulsion, qui sont precisement les gestes qui decident
 * d'un match.
 */
const POIDS: Partial<Record<TypeEvenement, number>> = {
  goal: 1.2,
  save: 0.35,
  shot_on_target: 0.2,
  shot: 0.05,
  offside: -0.1,
  foul: -0.15,
  yellow_card: -0.5,
  red_card: -2,
};

/** La passe decisive, qui n'est pas un evenement mais un champ du but. */
const POIDS_PASSE = 0.8;
/** La faute subie : on l'a provoquee, ou on l'a prise. Presque rien, mais pas rien. */
const POIDS_FAUTE_SUBIE = 0.05;
/** Le but contre son camp, porte par le `detail` du but. */
const POIDS_CSC = -1.5;
/** Chaque but encaisse, pour le gardien seul. */
const POIDS_BUT_ENCAISSE = -0.35;
/** Le gardien qui finit sans encaisser, et qui a tenu assez longtemps. */
const PRIME_CLEAN_SHEET = 0.5;
const MINUTES_CLEAN_SHEET = 60;

export interface NoteJoueur {
  playerId: string;
  /** `null` quand il n'a pas assez joue pour qu'une note veuille dire quelque chose. */
  note: number | null;
  /** Les minutes retenues pour le calcul. */
  minutes: number;
  /** Combien de faits fondent la note. Zero fait = une note qui n'affirme rien. */
  faits: number;
}

/**
 * Les notes d'un camp.
 *
 * `teamId` sert a distinguer ce que le joueur a fait de ce qu'il a subi : une
 * faute portee par l'equipe d'en face et qui le designe comme victime le
 * credite, la meme faute portee par la sienne le penalise.
 */
export function notesDuCamp(
  /**
   * Le match, pour les minutes jouees.
   *
   * ELLES NE SE RECALCULENT PAS ICI. Une premiere version le faisait, et elle
   * etait fausse : elle ecrasait le compteur a chaque remplacement, donc un
   * joueur sorti puis revenu — ce qu'un amical autorise expressement — perdait
   * son premier passage. `computeMinutesPlayed` sait le faire, plus le carton
   * rouge, plus les remplacements ecrits avant que `out_player_id` existe. Une
   * seconde definition des minutes jouees aurait diverge de celle des
   * statistiques du joueur des le premier correctif.
   */
  match: MatchJoue,
  lineup: LineupEntry[],
  faits: FaitDeMatch[],
  teamId: string | null,
  dureeMatchMin?: number,
): Map<string, NoteJoueur> {
  const minutes = new Map<string, number>(
    lineup.map((e) => [
      e.playerId,
      teamId ? computeMinutesPlayed(match, teamId, e.playerId, dureeMatchMin) : 0,
    ]),
  );
  const gardien = lineup.find((e) => normaliserPoste(e.position) === "goalkeeper") ?? null;

  const notes = new Map<string, NoteJoueur>();
  for (const e of lineup) {
    notes.set(e.playerId, {
      playerId: e.playerId,
      note: NOTE_DE_BASE,
      minutes: minutes.get(e.playerId) ?? 0,
      faits: 0,
    });
  }

  const ajouter = (playerId: string | null | undefined, delta: number) => {
    if (!playerId) return;
    const n = notes.get(playerId);
    if (!n || n.note === null) return;
    n.note += delta;
    n.faits += 1;
  };

  let butsEncaisses = 0;

  for (const f of faits) {
    const aNous = f.teamId === teamId;

    // LE BUT ENCAISSE NE SE LIT PAS SUR SON PROPRE CAMP. Un but marque contre
    // son camp est porte par l'equipe qui le CONCEDE, pas par celle qui en
    // profite — la fiche match le rappelle ailleurs : on ne compte jamais le
    // score en additionnant les buts d'une equipe.
    if (f.type === "goal") {
      const csc = f.detail === OWN_GOAL_DETAIL;
      if ((aNous && csc) || (!aNous && !csc)) butsEncaisses += 1;
    }

    if (aNous) {
      if (f.type === "goal") {
        ajouter(f.playerId, f.detail === OWN_GOAL_DETAIL ? POIDS_CSC : POIDS.goal ?? 0);
        if (f.assistPlayerId) ajouter(f.assistPlayerId, POIDS_PASSE);
      } else {
        const poids = POIDS[f.type];
        if (poids !== undefined) ajouter(f.playerId, poids);
      }
    } else if (f.type === "foul") {
      // La faute d'en face, subie par l'un des notres.
      ajouter(f.victimPlayerId, POIDS_FAUTE_SUBIE);
    }
  }

  if (gardien) {
    const n = notes.get(gardien.playerId);
    if (n && n.note !== null) {
      if (butsEncaisses > 0) {
        n.note += butsEncaisses * POIDS_BUT_ENCAISSE;
        n.faits += butsEncaisses;
      } else if (n.minutes >= MINUTES_CLEAN_SHEET) {
        n.note += PRIME_CLEAN_SHEET;
        n.faits += 1;
      }
    }
  }

  for (const n of notes.values()) {
    if (n.minutes < MINUTES_MINIMUM) {
      n.note = null;
      continue;
    }
    // Bornee, puis arrondie au dixieme : une note a 10,4 ou a 0,2 ne veut rien
    // dire, et un flottant traine des 5,999999 qu'il faut couper quelque part.
    n.note = Math.round(Math.min(10, Math.max(1, n.note ?? NOTE_DE_BASE)) * 10) / 10;
  }

  return notes;
}

/**
 * La moyenne de plusieurs notes, LES PLUS RECENTES PESANT DAVANTAGE : la
 * derniere cinq fois ce que pese la cinquieme (poids 5, 4, 3, 2, 1). C'est
 * ce qu'on vaut maintenant, pas il y a un mois.
 *
 * Une seule definition pour l'etat de forme (lib/etat-de-forme) et le
 * classement de la plateforme (lib/classement) : un joueur doit lire le meme
 * chiffre sur sa pastille de forme et dans le classement.
 *
 * `notes` va du plus recent au plus ancien, sans les matchs non notes.
 * Arrondie au dixieme ; `null` sans aucune note.
 */
export function moyennePonderee(notes: number[], fenetre = 5): number | null {
  if (notes.length === 0) return null;
  let somme = 0;
  let poids = 0;
  notes.forEach((n, i) => {
    const p = Math.max(1, fenetre - i);
    somme += n * p;
    poids += p;
  });
  return Math.round((somme / poids) * 10) / 10;
}

/** « 7.4 » s'ecrit « 7,4 » ici, et une note absente ne s'ecrit pas. */
export function formaterNote(note: number | null): string {
  return note === null ? "–" : note.toFixed(1).replace(".", ",");
}

/**
 * La couleur d'une note, du rouge au vert.
 *
 * Les seuils sont ceux qu'un lecteur de football porte deja : en dessous de 6
 * on a rate son match, a 7 on l'a bien fait, a 8 on l'a gagne.
 */
export function tonNote(note: number | null): "absente" | "faible" | "moyenne" | "bonne" | "excellente" {
  if (note === null) return "absente";
  if (note < 5.5) return "faible";
  if (note < 6.5) return "moyenne";
  if (note < 7.5) return "bonne";
  return "excellente";
}
