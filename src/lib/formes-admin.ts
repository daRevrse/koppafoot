// ============================================
// Server-only. L'état de forme des joueurs : on le calcule avec le
// classement, on le range, on le relit.
//
// POURQUOI UN DOCUMENT, comme le classement (voir lib/classement-admin) : la
// forme d'un joueur se lit sur ses cinq derniers matchs, qui peuvent être dans
// trois compétitions et une poignée d'amicaux. La recalculer à chaque
// affichage d'un effectif demanderait ces lectures pour chacun des quinze
// joueurs, à chaque ouverture de page, pour un résultat qui ne bouge qu'au
// coup de sifflet final. On la calcule donc au même moment que le classement,
// sur la même lecture de matchs, et une page d'effectif la relit en une fois.
//
// UN SEUL DOCUMENT, ET SA LIMITE. Une forme publiée pèse de l'ordre du
// kilo-octet ; le document en tient donc quelques centaines avant le plafond
// d'un mégaoctet de Firestore. Seules les formes RÉCENTES y entrent (voir
// `JOURS_FORME_PUBLIEE`), ce qui borne la taille par les joueurs actifs, pas
// par tous ceux qui ont un jour joué. Le jour où ça ne suffit plus, on passe
// à un document par joueur — la lecture (`lireFormes`) ne changera pas de
// signature.
// ============================================

import { adminDb } from "@/lib/firebase-admin";
import { cleDuJour } from "@/lib/dates";
import { matchsDeLaPlateforme, type MatchDeLaPlateforme } from "@/lib/classement-admin";
import {
  calculerFormes, joursDepuis, JOURS_FORME_PUBLIEE, type FormeJoueur,
} from "@/lib/etat-de-forme";

const DOC = "rankings/formes";

export interface FormesPubliees {
  formes: Record<string, FormeJoueur>;
  /** ISO. Null quand les formes n'ont jamais été calculées. */
  calculeLe: string | null;
}

/**
 * Calcule et publie. Rendu : le nombre de formes publiées.
 *
 * `dejaLus` : les matchs que le classement vient de lire, pour ne pas les
 * relire. Sans eux, la fonction les lit elle-même.
 */
export async function publierFormes(dejaLus?: MatchDeLaPlateforme[]): Promise<number> {
  const matchs = dejaLus ?? await matchsDeLaPlateforme();
  const aujourdHui = cleDuJour(new Date());

  const formes: Record<string, FormeJoueur> = {};
  for (const [cle, forme] of calculerFormes(matchs)) {
    // Une forme sans date n'a pas d'âge : on la garde, faute de pouvoir dire
    // qu'elle est vieille. Les matchs sans date sont rares, et déjà rangés
    // derrière tous les autres.
    const age = joursDepuis(forme.dernierMatch, aujourdHui);
    if (age !== null && age > JOURS_FORME_PUBLIEE) continue;
    formes[cle] = forme;
  }

  await adminDb.doc(DOC).set({
    formes,
    calcule_le: new Date().toISOString(),
  });
  return Object.keys(formes).length;
}

/**
 * Les formes demandées, et elles seules.
 *
 * Dégrade en « aucune forme » plutôt que de lever : un effectif doit
 * s'afficher même si ce document manque ou ne se lit pas. Une clé absente du
 * résultat veut dire « pas de forme récente » — l'affichage le dit ainsi.
 */
export async function lireFormes(cles: string[]): Promise<FormesPubliees> {
  try {
    const snap = await adminDb.doc(DOC).get();
    if (!snap.exists) return { formes: {}, calculeLe: null };
    const d = snap.data() ?? {};
    const toutes = (d.formes ?? {}) as Record<string, FormeJoueur>;
    const formes: Record<string, FormeJoueur> = {};
    for (const cle of cles) {
      if (toutes[cle]) formes[cle] = toutes[cle];
    }
    return { formes, calculeLe: (d.calcule_le ?? null) as string | null };
  } catch (err) {
    console.error("lireFormes failed:", err);
    return { formes: {}, calculeLe: null };
  }
}
