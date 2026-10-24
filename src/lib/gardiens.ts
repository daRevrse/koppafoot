// ============================================
// Qui est dans les cages : une seule reponse, pour tout le monde.
//
// LE GARDIEN ETAIT DEVINE. La console, la note et le classement prenaient
// chacun « la premiere ligne de la feuille au poste Gardien » — remplacants
// compris, donc parfois celui reste sur le banc, qui ramassait les buts
// encaisses du titulaire. Et quand personne n'avait ce poste (deux lignes
// d'effectif sur trois n'en ont pas), la console ouvrait l'arret a TOUT LE
// MONDE : dans un match « petits poteaux », ou personne ne prend le ballon a la
// main, elle comptait des arrets a des joueurs qui ne pouvaient pas en faire.
//
// LE GARDIEN EST DESORMAIS DESIGNE, et il change de main selon trois regles du
// proprietaire, et trois seulement :
//   - au coup d'envoi, c'est le titulaire que la feuille met au poste ;
//   - celui qui entre A SA PLACE devient gardien, avec ses propres chiffres ;
//   - un joueur deja sur la pelouse ne prend les gants que si son equipe n'a
//     plus de gardien en jeu (un rouge, une blessure sans changement) — ou
//     pour les reprendre a un autre joueur de champ qui depannait.
//
// UN MATCH « SANS GARDIEN » n'en a aucun, jamais : c'est une case de la feuille
// de match, ecrite au lancement dans `live_state.sans_gardien`. Sa presence
// est aussi ce qui distingue un match tenu sous cette regle d'un match plus
// ancien, que tout le reste du produit continue de lire comme avant — une
// note deja publiee ne doit pas bouger parce qu'on a deploye.
//
// Module pur, sans SDK : la console, la note, le classement et le retrait
// d'un evenement le lisent tels quels.
// ============================================

import { OWN_GOAL_DETAIL, type TypeEvenement } from "@/lib/evenements";
import { normaliserPoste } from "@/lib/postes";
import type { LineupEntry } from "@/types";

/** Ce qu'il faut d'un evenement pour suivre les gants. */
export interface FaitDeGardien {
  type: TypeEvenement;
  minute: number;
  teamId: string;
  playerId?: string;
  detail?: string;
  /** Remplacements : celui qui sort. `playerId` est l'entrant. */
  outPlayerId?: string | null;
}

/**
 * D'ou le gardien en place tient ses gants. Seul celui qui les a PRIS — un
 * joueur de champ qui depanne — peut se les voir reprendre.
 */
export type SourceDesGants = "feuille" | "remplacement" | "gants";

export interface GardienEnPlace {
  playerId: string;
  source: SourceDesGants;
}

export interface BilanDuGardien {
  playerId: string;
  /** Les minutes passees dans les cages, pas sur la pelouse. */
  minutes: number;
  /** Les buts encaisses pendant qu'il y etait. */
  encaisses: number;
}

/**
 * Le match est-il tenu sous la regle du gardien designe ?
 *
 * Oui des que la case a ete ecrite, cochee ou non : le lancement l'ecrit
 * toujours. Un match lance avant n'a rien, et garde la regle d'avant.
 */
export function regleDuGardienDesigne(
  ls: { sansGardien?: boolean | null } | null | undefined,
): boolean {
  return typeof ls?.sansGardien === "boolean";
}

/** Le gardien du coup d'envoi : le premier TITULAIRE au poste. */
export function gardienDeDepart(lineup: LineupEntry[]): LineupEntry | null {
  return lineup.find((e) => e.role === "starter" && normaliserPoste(e.position) === "goalkeeper") ?? null;
}

/**
 * Le but, encaisse par `teamId` ? Un but contre son camp est porte par
 * l'equipe qui le CONCEDE : c'est elle qui l'encaisse, pas l'autre.
 */
function encaissePar(f: FaitDeGardien, teamId: string): boolean {
  if (f.type !== "goal") return false;
  const csc = f.detail === OWN_GOAL_DETAIL;
  return f.teamId === teamId ? csc : !csc;
}

/**
 * Les faits dans l'ordre du match.
 *
 * MEME TRI QUE LES MINUTES JOUEES (voir computeMinutesPlayed) : par minute,
 * stable, pour que deux faits de la meme minute gardent l'ordre de saisie —
 * le rouge du gardien, puis le but qu'il n'est plus la pour arreter.
 */
function dansLOrdre(faits: FaitDeGardien[]): FaitDeGardien[] {
  return faits
    .filter((f) => typeof f.minute === "number")
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.minute - b.f.minute || a.i - b.i)
    .map(({ f }) => f);
}

/**
 * La marche commune : les faits dans l'ordre du match, le gardien qui change,
 * et ce qui se passe sous chaque gardien.
 */
function parcourir(
  lineup: LineupEntry[],
  faits: FaitDeGardien[],
  teamId: string,
  surChaque: (f: FaitDeGardien, avant: GardienEnPlace | null, apres: GardienEnPlace | null) => void,
): GardienEnPlace | null {
  const depart = gardienDeDepart(lineup);
  let enPlace: GardienEnPlace | null = depart ? { playerId: depart.playerId, source: "feuille" } : null;

  for (const f of dansLOrdre(faits)) {
    const avant = enPlace;
    if (f.teamId === teamId) {
      if (f.type === "substitution" && enPlace && f.outPlayerId === enPlace.playerId && f.playerId) {
        enPlace = { playerId: f.playerId, source: "remplacement" };
      } else if ((f.type === "red_card" || f.type === "sortie") && enPlace && f.playerId === enPlace.playerId) {
        enPlace = null;
      } else if (f.type === "gants" && f.playerId) {
        enPlace = { playerId: f.playerId, source: "gants" };
      }
    }
    surChaque(f, avant, enPlace);
  }
  return enPlace;
}

/** Le gardien de `teamId` apres ces faits, ou `null` quand les cages sont vides. */
export function gardienEnPlace(
  lineup: LineupEntry[],
  faits: FaitDeGardien[],
  teamId: string,
): GardienEnPlace | null {
  return parcourir(lineup, faits, teamId, () => {});
}

/**
 * Peut-il prendre les gants ? Quand personne ne les a, ou quand celui qui les
 * a les avait pris lui-meme — un depanneur les rend au gardien remplacant qui
 * entre apres lui. Jamais a un gardien de la feuille ou entre a sa place :
 * on ne remplace un gardien par un joueur deja sur la pelouse que s'il n'y a
 * plus de gardien.
 */
export function peutPrendreLesGants(enPlace: GardienEnPlace | null, playerId: string): boolean {
  return enPlace === null || (enPlace.source === "gants" && enPlace.playerId !== playerId);
}

/**
 * Chaque joueur passe dans les cages de `teamId`, dans l'ordre d'arrivee :
 * combien de minutes il y est reste, et ce qu'il y a encaisse. Un but marque
 * cages vides n'est encaisse par personne.
 *
 * Les minutes suivent les bornes des minutes jouees : rien avant zero, rien
 * apres le coup de sifflet, qui est la duree du match ou la derniere minute
 * saisie si le temps additionnel l'a depassee.
 */
export function bilanDesGardiens(
  lineup: LineupEntry[],
  faits: FaitDeGardien[],
  teamId: string,
  dureeMatchMin: number,
): BilanDuGardien[] {
  const minutesSaisies = faits.map((f) => f.minute).filter((m) => typeof m === "number");
  const coupDeSifflet = Math.max(dureeMatchMin, ...minutesSaisies, 0);
  const borne = (m: number) => Math.min(Math.max(m, 0), coupDeSifflet);

  const bilans: BilanDuGardien[] = [];
  const bilanDe = (playerId: string) => {
    let b = bilans.find((x) => x.playerId === playerId);
    if (!b) {
      b = { playerId, minutes: 0, encaisses: 0 };
      bilans.push(b);
    }
    return b;
  };

  // Le gardien du coup d'envoi a un bilan meme s'il n'a rien vecu de notable.
  const depart = gardienDeDepart(lineup);
  if (depart) bilanDe(depart.playerId);

  // `depuis` : la minute ou le gardien en place a pris les cages.
  let depuis = 0;
  const enPlaceFinal = parcourir(lineup, faits, teamId, (f, avant, apres) => {
    if (avant?.playerId !== apres?.playerId) {
      const minute = borne(f.minute);
      if (avant) bilanDe(avant.playerId).minutes += minute - depuis;
      if (apres) bilanDe(apres.playerId);
      depuis = minute;
    }
    if (apres && encaissePar(f, teamId)) bilanDe(apres.playerId).encaisses += 1;
  });
  if (enPlaceFinal) bilanDe(enPlaceFinal.playerId).minutes += coupDeSifflet - depuis;

  return bilans;
}

/**
 * LES JOUEURS SUR LA PELOUSE, A LEUR PLACE, pour le terrain de la console.
 *
 * Le terrain place chacun d'apres la feuille : son poste, et la case que le
 * manager lui a choisie. Un remplacant gardait donc SON poste, et se rangeait
 * ou celui-ci le mettait — un milieu entre pour le gardien jouait au milieu,
 * et le but restait vide. CELUI QUI ENTRE PREND LA PLACE DE CELUI QUI SORT :
 * son poste, sa case, et son rang dans l'ordre de la feuille, qui dit qui
 * joue a gauche. Celui qui le remplace ensuite la reprend a son tour.
 *
 * `gardien` : le gardien en place sous la regle du gardien designe (voir
 * `gardienEnPlace`), `null` quand les cages sont vides. LUI SEUL EST DESSINE
 * AU BUT. Celui qui a pris les gants quitte sa case pour les cages, et elle
 * reste vide ; un gardien de poste qui n'a pas les gants joue dans le champ.
 * Absent — un match d'avant la case, ou sans gardien —, les postes restent
 * ceux de la feuille.
 *
 * Qui est sur la pelouse vient de `surLeTerrain`, jamais des faits : on ne
 * dessine que ceux qui y sont vraiment.
 */
export function lignesSurLaPelouse(
  lineup: LineupEntry[],
  surLeTerrain: string[],
  faits: FaitDeGardien[],
  teamId: string | null,
  gardien?: string | null,
): LineupEntry[] {
  const places = new Map(lineup.map((e, rang) => [
    e.playerId,
    { position: e.position ?? null, emplacement: e.emplacement ?? null, rang },
  ]));
  for (const f of dansLOrdre(faits)) {
    if (f.teamId !== teamId || f.type !== "substitution" || !f.playerId || !f.outPlayerId) continue;
    const laissee = places.get(f.outPlayerId);
    if (laissee) places.set(f.playerId, { ...laissee });
  }

  const presents = new Set(surLeTerrain);
  return lineup
    .filter((e) => presents.has(e.playerId))
    .map((e) => ({ e, place: places.get(e.playerId)! }))
    .sort((a, b) => a.place.rang - b.place.rang)
    .map(({ e, place }) => {
      let { position, emplacement } = place;
      if (gardien !== undefined) {
        if (e.playerId === gardien) {
          // Une case du champ le retiendrait hors du but.
          position = "goalkeeper";
          if (emplacement && emplacement.ligne !== 0) emplacement = null;
        } else {
          if (normaliserPoste(position) === "goalkeeper") position = null;
          if (emplacement?.ligne === 0) emplacement = null;
        }
      }
      return { ...e, position, emplacement };
    });
}

/**
 * Le gardien d'une feuille en cours de preparation, sur l'ecran des feuilles.
 *
 * `choisi` : `undefined` tant que le scoreur n'a rien touche — on propose
 * alors le premier titulaire que l'effectif met au poste —, `null` s'il a
 * retire la designation, sinon l'identifiant qu'il a designe, qui ne vaut
 * que tant que ce joueur reste titulaire.
 */
export function gardienPropose(
  titulaires: { id: string; position?: string | null }[],
  choisi: string | null | undefined,
): string | null {
  if (choisi === undefined) {
    return titulaires.find((t) => normaliserPoste(t.position) === "goalkeeper")?.id ?? null;
  }
  if (choisi === null) return null;
  return titulaires.some((t) => t.id === choisi) ? choisi : null;
}

/**
 * Faut-il un gardien sur cette feuille ? Pas dans un match sans gardien, et
 * pas pour l'adversaire hors plateforme d'un amical : sa feuille « Joueur N »
 * est validee d'office, et la console ne peut rien saisir pour lui.
 */
export function gardienExige(teamId: string | null | undefined, sansGardien: boolean): boolean {
  return !sansGardien && !!teamId;
}
