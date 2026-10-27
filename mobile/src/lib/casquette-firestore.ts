import {
  collection, collectionGroup, doc, getDoc, getDocs, onSnapshot, orderBy, query, where, type Unsubscribe,
} from "firebase/firestore";
import { toBooking } from "@/lib/booking-mappers";
import { toCompetition, toCompMatch } from "@/lib/competition-mappers";
import { toMatch } from "@/lib/match-mappers";
import { toStaffGrant } from "@/lib/staff-scope";
import type {
  Booking, CompMatch, Competition, FirestoreBooking, FirestoreCompetition, FirestoreCompMatch, FirestoreMatch,
  FirestoreStaffGrant, FirestoreVenue, Match,
} from "@/types";
import { db } from "~/lib/firebase";

// Les lectures de l'Espace casquette : les requêtes des pages du site qu'il
// résume (/live-ops, /organizer, /mes-terrains), avec les mêmes convertisseurs.
// Toutes en lecture seule, déjà permises par les règles.

/** Les matchs confiés un par un, en direct (`onMatchesIModerate`). */
export function ecouterMatchsConfies(uid: string, cb: (matchs: Match[]) => void): Unsubscribe {
  const q = query(collection(db, "matches"), where("moderator_ids", "array-contains", uid));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch))),
    () => cb([]),
  );
}

/** Les amicaux à venir, dont on comptera ceux que personne ne couvre (`onAmicauxSansScoreur`). */
export function ecouterAmicauxAVenir(cb: (matchs: Match[]) => void): Unsubscribe {
  const q = query(collection(db, "matches"), where("status", "in", ["upcoming", "pending"]));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toMatch(d.id, d.data() as FirestoreMatch))),
    () => cb([]),
  );
}

/**
 * Les matchs d'une compétition ce jour-là, en direct. La requête ne lit que la
 * journée (index simple) : tenir dix compétitions ne coûte pas dix calendriers.
 */
export function ecouterMatchsDuJour(cid: string, jour: string, cb: (matchs: CompMatch[]) => void): Unsubscribe {
  const q = query(collection(db, "competitions", cid, "comp_matches"), where("date", "==", jour));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch))),
    () => cb([]),
  );
}

/** Les demandes et réservations des terrains du compte, en direct (`onBookingsByOwner`). */
export function ecouterReservationsDuProprietaire(uid: string, cb: (resas: Booking[]) => void): Unsubscribe {
  const q = query(collection(db, "bookings"), where("owner_id", "==", uid), orderBy("created_at", "desc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toBooking(d.id, d.data() as FirestoreBooking))),
    () => cb([]),
  );
}

/**
 * Le battement de chaque terrain du compte, en minutes : ce qu'il garde après
 * un créneau, et dont le chevauchement de deux demandes tient compte.
 */
export async function lireBattements(uid: string): Promise<Record<string, number>> {
  const snap = await getDocs(query(collection(db, "venues"), where("owner_id", "==", uid)));
  return Object.fromEntries(snap.docs.map((d) => [d.id, (d.data() as FirestoreVenue).battement_min ?? 0]));
}

export interface CompetitionsDuCompte {
  /** Celles qu'il organise, les plus récentes d'abord (`listCompetitionsByOrganizer`). */
  organisees: Competition[];
  /** Celles qu'il modère (`listCompetitionsCoOrganisees`). */
  coOrganisees: Competition[];
  /** Celles d'un code de console encore valable (`listGrantedCompetitionIds`). */
  parCode: Competition[];
}

const lire = (snap: { docs: { id: string; data: () => unknown }[] }) =>
  snap.docs.map((d) => toCompetition(d.id, d.data() as FirestoreCompetition));

/** Les compétitions qu'un compte tient, d'une manière ou d'une autre. */
export async function lireCompetitionsDuCompte(uid: string): Promise<CompetitionsDuCompte> {
  const [organisees, coOrganisees, codes] = await Promise.all([
    getDocs(query(collection(db, "competitions"), where("organizer_ids", "array-contains", uid), orderBy("created_at", "desc"))),
    getDocs(query(collection(db, "competitions"), where("moderator_ids", "array-contains", uid))),
    getDocs(query(collectionGroup(db, "staff_grants"), where("uid", "==", uid))).catch(() => null),
  ]);

  // .../competitions/{cid}/staff_grants/{uid} : ni révoqué, ni expiré.
  const maintenant = Date.now();
  const cids = (codes?.docs ?? [])
    .filter((d) => {
      const code = toStaffGrant(d.data() as FirestoreStaffGrant);
      return !code.revoked && !(code.expiresAt && new Date(code.expiresAt).getTime() <= maintenant);
    })
    .map((d) => d.ref.parent.parent?.id)
    .filter((cid): cid is string => !!cid);
  const parCode = await Promise.all(cids.map((cid) => getDoc(doc(db, "competitions", cid))));

  return {
    organisees: lire(organisees),
    coOrganisees: lire(coOrganisees).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    parCode: parCode
      .filter((s) => s.exists())
      .map((s) => toCompetition(s.id, s.data() as FirestoreCompetition)),
  };
}
