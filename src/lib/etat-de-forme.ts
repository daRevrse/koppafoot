// ============================================
// L'état de forme d'un joueur : ce qu'il DÉCLARE, et ce que ses matchs DISENT.
//
// DEUX FAITS DIFFÉRENTS, ET ILS NE SE REMPLACENT PAS. Un attaquant qui vient
// d'enchaîner trois matchs à but peut s'être tordu la cheville à
// l'entraînement : sa forme est excellente et il ne jouera pas samedi. À
// l'inverse, un joueur apte peut sortir de cinq matchs ternes. Le manager qui
// compose a besoin des deux, côte à côte, et aucun ne peut se déduire de
// l'autre.
//
//  - LA CONDITION se déclare. Apte, incertain, blessé, suspendu,
//    indisponible : personne d'autre que le joueur ne sait qu'il a mal au
//    genou. Elle vit sur son document `users` (et sur la fiche d'un joueur
//    sans compte, que son manager tient à sa place).
//
//  - LA FORME se calcule. Elle part des notes que la console calcule déjà
//    pendant le direct (voir lib/notes), sur les cinq derniers matchs du
//    joueur — la même fenêtre que le classement de la plateforme (voir
//    lib/classement). Elle ne demande rien à personne, et elle ne mesure que
//    ce qui a été saisi : c'est la limite de la note, elle en hérite.
//
// Module pur : aucun SDK, aucun réseau. Le serveur s'en sert pour publier les
// formes à la fin de chaque match (voir lib/classement-admin), le navigateur
// pour les afficher et pour lire une condition.
// ============================================

import { cleDuJour } from "@/lib/dates";
import { OWN_GOAL_DETAIL } from "@/lib/evenements";
import { FENETRE } from "@/lib/classement";
import { moyennePonderee, notesDuCamp } from "@/lib/notes";
import { DUREE_MATCH_DEFAUT, type MatchJoue } from "@/lib/player-stats";
import type { LineupEntry } from "@/types";

// ---- La condition déclarée ---------------------------------------------------

export const STATUTS_CONDITION = ["apte", "incertain", "blesse", "suspendu", "indisponible"] as const;
export type StatutCondition = (typeof STATUTS_CONDITION)[number];

/** La condition telle que Firestore la range, sur `users` comme sur `ghost_players`. */
export interface FirestoreConditionJoueur {
  statut: StatutCondition;
  /**
   * Le jour du retour annoncé, « AAAA-MM-JJ ». Ce jour-là, le joueur est de
   * nouveau disponible : la condition cesse d'elle-même, voir
   * `conditionEnVigueur`. Null quand personne ne sait.
   */
  retour_prevu: string | null;
  /** Un mot pour le manager : « entorse cheville », « en voyage jusqu'au 12 ». */
  note: string | null;
  /** ISO. Dit depuis quand elle tient — une déclaration vieille d'un mois se relit. */
  declaree_le: string;
}

export interface ConditionJoueur {
  statut: StatutCondition;
  retourPrevu: string | null;
  note: string | null;
  declareeLe: string;
}

export const LIBELLE_CONDITION: Record<StatutCondition, string> = {
  apte: "Apte",
  incertain: "Incertain",
  blesse: "Blessé",
  suspendu: "Suspendu",
  indisponible: "Indisponible",
};

/** Ce que le statut veut dire, pour celui qui le choisit. */
export const AIDE_CONDITION: Record<StatutCondition, string> = {
  apte: "Prêt à jouer",
  incertain: "Une gêne : à voir le jour du match",
  blesse: "Ne peut pas jouer",
  suspendu: "Sous le coup d'une sanction",
  indisponible: "Absent : travail, voyage, examens…",
};

/**
 * Peut-il figurer sur une feuille ?
 *
 * INCERTAIN L'EST : c'est au manager de trancher, et c'est tout l'intérêt de
 * le lui dire. Le reste ne l'est pas — mais rien ne l'INTERDIT pour autant.
 * La feuille avertit, elle ne bloque pas : une déclaration oubliée ne doit
 * pas empêcher un manager de faire jouer quelqu'un qui est bel et bien là.
 */
export const JOUABLE: Record<StatutCondition, boolean> = {
  apte: true,
  incertain: true,
  blesse: false,
  suspendu: false,
  indisponible: false,
};

/** La longueur d'un mot au manager. Au-delà, ce n'est plus un mot. */
export const NOTE_CONDITION_MAX = 140;

const JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Lit une condition en base, sans lui faire confiance.
 *
 * Le document `users` s'écrit depuis le client (voir firestore.rules), donc
 * rien ne garantit la forme de ce qui s'y trouve : un statut inconnu vaut
 * « pas de condition », une date illisible vaut « pas de date ». On n'affiche
 * jamais une valeur qu'on ne sait pas nommer.
 */
export function lireCondition(brut: unknown): ConditionJoueur | null {
  if (!brut || typeof brut !== "object") return null;
  const d = brut as Record<string, unknown>;
  const statut = d.statut;
  if (typeof statut !== "string" || !(STATUTS_CONDITION as readonly string[]).includes(statut)) {
    return null;
  }
  const retour = typeof d.retour_prevu === "string" && JOUR.test(d.retour_prevu) ? d.retour_prevu : null;
  const note = typeof d.note === "string" && d.note.trim() !== ""
    ? d.note.trim().slice(0, NOTE_CONDITION_MAX)
    : null;
  return {
    statut: statut as StatutCondition,
    retourPrevu: statut === "apte" ? null : retour,
    note,
    declareeLe: typeof d.declaree_le === "string" ? d.declaree_le : "",
  };
}

/** Ce qu'on écrit. Un joueur apte n'a pas de date de retour : il est là. */
export function versFirestoreCondition(
  c: { statut: StatutCondition; retourPrevu?: string | null; note?: string | null },
  maintenant: Date = new Date(),
): FirestoreConditionJoueur {
  const note = c.note?.trim().slice(0, NOTE_CONDITION_MAX) ?? "";
  return {
    statut: c.statut,
    retour_prevu: c.statut !== "apte" && c.retourPrevu && JOUR.test(c.retourPrevu) ? c.retourPrevu : null,
    note: note === "" ? null : note,
    declaree_le: maintenant.toISOString(),
  };
}

/**
 * La condition qui tient AUJOURD'HUI.
 *
 * LE JOUR DU RETOUR, ELLE S'EFFACE. Un joueur blessé « jusqu'au 12 » est
 * disponible le 12, et personne ne pensera à revenir le dire : sans cette
 * règle, l'effectif afficherait des blessés guéris depuis des semaines, et le
 * manager apprendrait vite à ne plus croire la pastille.
 *
 * Sans date de retour, elle tient jusqu'à ce qu'on la change — d'où la date de
 * déclaration, que l'affichage montre.
 */
export function conditionEnVigueur(
  c: ConditionJoueur | null | undefined,
  aujourdHui: string = cleDuJour(new Date()),
): ConditionJoueur | null {
  if (!c) return null;
  if (c.retourPrevu && c.retourPrevu <= aujourdHui) return null;
  return c;
}

/** Une condition qui mérite qu'on la signale : tout sauf « apte », et seulement en vigueur. */
export function conditionASignaler(
  c: ConditionJoueur | null | undefined,
  aujourdHui?: string,
): ConditionJoueur | null {
  const enVigueur = conditionEnVigueur(c, aujourdHui);
  return enVigueur && enVigueur.statut !== "apte" ? enVigueur : null;
}

// ---- La forme calculée -------------------------------------------------------

/** La fenêtre : les cinq derniers matchs, comme le classement. */
export const FENETRE_FORME = FENETRE;

/**
 * En dessous, pas de niveau.
 *
 * Une note seule est un match, pas une forme. Deux, c'est déjà une direction.
 * Les matchs sans note — un remplaçant entré trop tard pour en mériter une,
 * voir `MINUTES_MINIMUM` — occupent leur place dans la fenêtre mais ne
 * comptent pas ici.
 */
export const MATCHS_NOTES_MINIMUM = 2;

/**
 * Au-delà, une forme publiée n'est plus une forme.
 *
 * Elle dit comment le joueur allait il y a quatre mois, ce qui ne renseigne
 * personne sur samedi prochain. Le serveur ne la publie plus (c'est aussi ce
 * qui borne la taille du document), l'affichage la grise avant.
 */
export const JOURS_FORME_PUBLIEE = 120;
/** À partir de là, l'affichage prévient : il n'a pas joué depuis un moment. */
export const JOURS_SANS_MATCH = 30;

export type NiveauForme = "excellente" | "bonne" | "moyenne" | "faible";
export type Tendance = "hausse" | "stable" | "baisse";
export type Resultat = "V" | "N" | "D";

export const LIBELLE_FORME: Record<NiveauForme, string> = {
  excellente: "En pleine forme",
  bonne: "En forme",
  moyenne: "Forme moyenne",
  faible: "En méforme",
};

/** Un match de la fenêtre, du point de vue du joueur. */
export interface MatchDeForme {
  matchId: string;
  /** La fiche du match. Null quand on ne sait pas où elle vit. */
  lien: string | null;
  /** « AAAA-MM-JJ ». */
  date: string | null;
  adversaire: string;
  resultat: Resultat;
  /** Le score de son camp d'abord : « 3-1 ». */
  score: string;
  /** Voir lib/notes. Null : pas assez joué pour être noté. */
  note: number | null;
  minutes: number;
  /** Combien de faits fondent la note. Zéro fait = une note qui n'affirme rien. */
  faits: number;
  buts: number;
  passes: number;
}

export interface FormeJoueur {
  /** Null tant qu'il n'y a pas `MATCHS_NOTES_MINIMUM` matchs notés. */
  niveau: NiveauForme | null;
  /** La moyenne pondérée des notes, au dixième. Null avec le niveau. */
  indice: number | null;
  /** Null sous trois matchs notés : deux points ne font pas une pente. */
  tendance: Tendance | null;
  /** La fenêtre, le plus récent d'abord. */
  matchs: MatchDeForme[];
  /** Le jour du dernier match de la fenêtre. */
  dernierMatch: string | null;
}

export const FORME_VIDE: FormeJoueur = {
  niveau: null, indice: null, tendance: null, matchs: [], dernierMatch: null,
};

/**
 * Le niveau d'une moyenne.
 *
 * LES SEUILS SONT CEUX DE LA NOTE, un peu resserrés. Une moyenne sur cinq
 * matchs revient vers 6 bien plus qu'une note isolée — il faut marquer à
 * chaque sortie pour tenir 7,2 — et les seuils de `tonNote` appliqués tels
 * quels rangeraient presque tout le monde en « moyenne ». Repères : un but
 * tous les deux matchs donne à peu près « en forme », un but par match « en
 * pleine forme », un carton par match « en méforme ».
 */
export function niveauDeForme(indice: number): NiveauForme {
  if (indice >= 7.2) return "excellente";
  if (indice >= 6.5) return "bonne";
  if (indice >= 5.6) return "moyenne";
  return "faible";
}

const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * La forme, depuis la fenêtre (le plus récent d'abord).
 *
 * PONDÉRÉE VERS LE RÉCENT. La forme, c'est ce qu'on vaut maintenant : le
 * dernier match pèse cinq fois ce que pèse le cinquième. Une moyenne plate
 * laisserait un doublé d'il y a un mois masquer trois matchs ratés depuis.
 */
export function formeDepuisMatchs(fenetre: MatchDeForme[]): FormeJoueur {
  const matchs = fenetre.slice(0, FENETRE_FORME);
  const notes = matchs.map((m) => m.note).filter((n): n is number => n !== null);
  const dernierMatch = matchs[0]?.date ?? null;

  if (notes.length < MATCHS_NOTES_MINIMUM) {
    return { niveau: null, indice: null, tendance: null, matchs, dernierMatch };
  }

  // Voir `moyennePonderee` : la même que celle du classement.
  const indice = moyennePonderee(notes, FENETRE_FORME) as number;

  // LA PENTE : les deux derniers matchs notés contre ceux d'avant. Un seul
  // match contre le reste ferait basculer la flèche sur un penalty manqué.
  let tendance: Tendance | null = null;
  if (notes.length >= 3) {
    const ecart = moyenne(notes.slice(0, 2)) - moyenne(notes.slice(2));
    tendance = ecart >= 0.4 ? "hausse" : ecart <= -0.4 ? "baisse" : "stable";
  }

  return { niveau: niveauDeForme(indice), indice, tendance, matchs, dernierMatch };
}

/** Combien de jours depuis ce jour-là. Null sans date. */
export function joursDepuis(date: string | null, aujourdHui: string = cleDuJour(new Date())): number | null {
  if (!date || !JOUR.test(date)) return null;
  const ms = new Date(`${aujourdHui}T00:00:00`).getTime() - new Date(`${date}T00:00:00`).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

// ---- Les clés ------------------------------------------------------------------
//
// L'IDENTITÉ EST LE COMPTE, comme au classement : `player_id` désigne une
// ligne d'effectif, propre à une équipe dans une compétition, et le même
// joueur en porte une par club. `user_id`, recopié sur la feuille, les
// rassemble. Le classement retombe ensuite sur le nom ; la forme, non — deux
// homonymes qui partagent une forme, c'est une forme fausse affichée à un
// manager qui compose. Une ligne sans compte garde donc sa forme à elle,
// rangée sous son équipe : c'est exactement le cas du joueur sans compte d'un
// club, dont la ligne sur les amicaux est l'identifiant de sa fiche.

/** La forme d'un compte. */
export const cleFormeCompte = (uid: string) => `uid:${uid}`;
/** La forme d'une ligne sans compte, d'un joueur sans compte en particulier. */
export const cleFormeLigne = (teamId: string, playerId: string) => `ligne:${teamId}:${playerId}`;

/**
 * Les lignes d'un adversaire hors plateforme : des « Joueur 1 », « Joueur 2 »
 * générés à la création du match, avec un identifiant neuf à chaque fois
 * (voir `ghostOpponentLineup`). Personne derrière, et aucune forme à suivre.
 */
const LIGNE_HORS_PLATEFORME = "ext-";

/**
 * La clé d'une ligne de feuille, ou `null` quand sa forme ne se publie pas.
 *
 * UNE LIGNE SANS COMPTE NE SE SUIT QUE SUR UN AMICAL. Là, c'est un joueur
 * sans compte du club, dont la fiche affiche la forme. En compétition, une
 * ligne jamais revendiquée n'a aucune page où la montrer, et elles se
 * comptent par centaines : les publier ferait grossir le document des formes
 * (voir lib/formes-admin) pour rien.
 */
function cleDe(
  entry: Pick<LineupEntry, "userId" | "playerId">,
  teamId: string | null,
  amical: boolean,
): string | null {
  if (entry.userId) return cleFormeCompte(entry.userId);
  if (!amical || !teamId || !entry.playerId || entry.playerId.startsWith(LIGNE_HORS_PLATEFORME)) return null;
  return cleFormeLigne(teamId, entry.playerId);
}

// ---- Le calcul sur toute la plateforme ----------------------------------------

/**
 * Un match terminé, avec ce que le calcul ne peut pas deviner.
 *
 * `dureeMatchMin` vient du format de la compétition : un 7v7 en deux fois
 * vingt minutes ne dure pas quatre-vingt-dix, et les notes en dépendent (voir
 * `MINUTES_MINIMUM`). `lien` dit où lire la fiche. `amical` dit qu'il vient
 * de la collection `matches` — voir `cleDe` pour ce que ça change.
 */
export type MatchPourForme = MatchJoue & {
  dureeMatchMin?: number;
  lien?: string | null;
  amical?: boolean;
};

const quand = (m: { date: string | null; time: string | null }) => `${m.date ?? ""}T${m.time ?? ""}`;

/**
 * La forme de chaque joueur de la plateforme.
 *
 * Même parcours que le classement : les matchs du plus récent au plus ancien,
 * chaque joueur consomme sa fenêtre de cinq et n'en prend pas davantage.
 *
 * LE BUT ANNULÉ PAR LA VAR NE COMPTE PAS. La console, elle, le passe encore à
 * sa note pendant le direct ; ici on regarde en arrière, et une réalisation
 * effacée du tableau d'affichage n'a rien à faire dans une forme. Le
 * classement et le bilan appliquent déjà la même règle.
 *
 * Un match renseigné après coup n'a ni feuille ni faits : il n'entre pas.
 * On ne note pas ce qu'on n'a pas vu.
 */
export function calculerFormes(matchs: MatchPourForme[]): Map<string, FormeJoueur> {
  const termines = matchs
    .filter((m) => m.status === "completed" && m.scoreHome != null && m.scoreAway != null)
    .sort((a, b) => quand(b).localeCompare(quand(a)));

  const fenetres = new Map<string, MatchDeForme[]>();

  for (const match of termines) {
    const faits = (match.liveState?.events ?? []).filter((e) => e.varStatus !== "cancelled");
    const camps = [
      { lineup: match.homeLineup, teamId: match.homeTeamId, pour: match.scoreHome!, contre: match.scoreAway!, adversaire: match.awayTeamName },
      { lineup: match.awayLineup, teamId: match.awayTeamId, pour: match.scoreAway!, contre: match.scoreHome!, adversaire: match.homeTeamName },
    ];

    for (const camp of camps) {
      // Qui, sur cette feuille, a encore de la place dans sa fenêtre.
      // La première ligne fait foi si un effectif a été saisi de travers.
      const vus = new Set<string>();
      const retenus: { cle: string; entry: LineupEntry }[] = [];
      for (const entry of camp.lineup) {
        const cle = cleDe(entry, camp.teamId, match.amical === true);
        if (!cle || vus.has(cle)) continue;
        vus.add(cle);
        if ((fenetres.get(cle)?.length ?? 0) >= FENETRE_FORME) continue;
        retenus.push({ cle, entry });
      }
      if (retenus.length === 0) continue;

      // Les notes du camp, une fois : elles se calculent ensemble (le but
      // encaissé du gardien dépend du match entier).
      const notes = notesDuCamp(
        match, camp.lineup, faits, camp.teamId, match.dureeMatchMin ?? DUREE_MATCH_DEFAUT,
      );
      const resultat: Resultat = camp.pour > camp.contre ? "V" : camp.pour < camp.contre ? "D" : "N";

      for (const { cle, entry } of retenus) {
        const n = notes.get(entry.playerId);
        const siens = faits.filter((f) => f.teamId === camp.teamId);
        const ligne: MatchDeForme = {
          matchId: match.id,
          // `?? null` partout où la base peut ne rien avoir : cette ligne part
          // telle quelle dans un document Firestore, qui refuse `undefined`.
          lien: match.lien ?? null,
          date: match.date ?? null,
          adversaire: camp.adversaire ?? "",
          resultat,
          score: `${camp.pour}-${camp.contre}`,
          note: n?.note ?? null,
          minutes: n?.minutes ?? 0,
          faits: n?.faits ?? 0,
          buts: siens.filter((f) =>
            f.type === "goal" && f.playerId === entry.playerId && f.detail !== OWN_GOAL_DETAIL,
          ).length,
          passes: siens.filter((f) =>
            f.type === "goal" && f.assistPlayerId === entry.playerId && f.playerId !== entry.playerId,
          ).length,
        };
        const fenetre = fenetres.get(cle);
        if (fenetre) fenetre.push(ligne);
        else fenetres.set(cle, [ligne]);
      }
    }
  }

  const formes = new Map<string, FormeJoueur>();
  for (const [cle, fenetre] of fenetres) formes.set(cle, formeDepuisMatchs(fenetre));
  return formes;
}
