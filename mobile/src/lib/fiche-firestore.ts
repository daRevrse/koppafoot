import {
  collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where, type Unsubscribe,
} from "firebase/firestore";
import { toCompetition, toCompMatch, toCompTeam } from "@/lib/competition-mappers";
import { toMatch } from "@/lib/match-mappers";
import type {
  Competition, CompMatch, CompTeam, FirestoreCompetition, FirestoreCompMatch, FirestoreCompTeam, FirestoreMatch, Match,
} from "@/types";
import { db } from "~/lib/firebase";

// Les lectures d'une fiche de match : les mêmes requêtes que le site
// (lib/competition-firestore : onCompMatch, onCompTeams ; la page amicale :
// matches/{id}), et les mêmes convertisseurs partagés.

/** Une rencontre de compétition, en direct. `null` si elle n'existe pas (ou plus). */
export function ecouterMatchCompetition(cid: string, mid: string, cb: (m: CompMatch | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "competitions", cid, "comp_matches", mid),
    (snap) => cb(snap.exists() ? toCompMatch(snap.id, snap.data() as FirestoreCompMatch) : null),
    (erreur) => console.warn("[fiche] écouteur du match", cid, mid, erreur),
  );
}

/** Les équipes d'une compétition : leurs écussons à jour, leurs couleurs, leurs effectifs. */
export function ecouterEquipesCompetition(cid: string, cb: (equipes: CompTeam[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, "competitions", cid, "comp_teams"), orderBy("name", "asc")),
    (snap) => cb(snap.docs.map((d) => toCompTeam(d.id, cid, d.data() as FirestoreCompTeam))),
    (erreur) => console.warn("[fiche] écouteur des équipes", cid, erreur),
  );
}

/** La compétition, lue une fois : son nom, son format, son adresse. */
export async function lireCompetition(cid: string): Promise<Competition | null> {
  const snap = await getDoc(doc(db, "competitions", cid));
  return snap.exists() ? toCompetition(snap.id, snap.data() as FirestoreCompetition) : null;
}

const cidsConnus = new Map<string, string | null>();

/**
 * L'identifiant d'une compétition d'après son slug (la requête de
 * `getCompetitionBySlug` du site) : les liens des notifications portent le
 * slug. Gardé le temps de l'application. `null` si aucune ne le porte.
 */
export async function cidDuSlug(slug: string): Promise<string | null> {
  const connu = cidsConnus.get(slug);
  if (connu !== undefined) return connu;
  const snap = await getDocs(query(collection(db, "competitions"), where("slug", "==", slug), limit(1)));
  const cid = snap.empty ? null : snap.docs[0].id;
  cidsConnus.set(slug, cid);
  return cid;
}

/** Un amical, en direct. `null` s'il n'existe pas (ou plus). */
export function ecouterAmical(id: string, cb: (m: Match | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, "matches", id),
    (snap) => cb(snap.exists() ? toMatch(snap.id, snap.data() as FirestoreMatch) : null),
    (erreur) => console.warn("[fiche] écouteur de l'amical", id, erreur),
  );
}
