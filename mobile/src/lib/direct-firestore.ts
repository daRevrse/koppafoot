import {
  arrayRemove, arrayUnion, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type Unsubscribe,
} from "firebase/firestore";
import { toCompetition, toCompMatch } from "@/lib/competition-mappers";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";
import type { Competition, CompMatch, FirestoreCompetition, FirestoreCompMatch } from "@/types";
import { db } from "~/lib/firebase";

// Les lectures et écritures Firestore de l'application. Les versions du site
// (lib/competition-firestore, lib/firestore) lisent l'initialisation du site
// et ne traversent pas ; celles-ci en sont la réplique exacte — même requête,
// même mapper partagé.

/** Les matchs d'une compétition, en direct. Même requête que `onCompMatches` du site. */
export function ecouterMatchsCompetition(cid: string, cb: (matches: CompMatch[]) => void): Unsubscribe {
  const q = query(collection(db, "competitions", cid, "comp_matches"), orderBy("date", "asc"));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch))),
    (erreur) => console.warn("[direct] écouteur de compétition", cid, erreur),
  );
}

/** Les amicaux en cours ou joués. Même requête que `onLiveFriendlies` du site. */
export function ecouterAmicauxEnCours(cb: (matches: CompMatch[]) => void): Unsubscribe {
  const q = query(collection(db, "matches"), where("status", "in", ["live", "completed"]));
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs
          .map((d) => amicalVersCompMatch(d.id, d.data() as Record<string, unknown>))
          .filter((m): m is CompMatch => m != null),
      ),
    () => cb([]),
  );
}

/** Le suivi lié au compte, le même champ que le bouton « Suivre » du site. */
export async function suivreCompetition(uid: string, cid: string, suivre: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    followed_competition_ids: suivre ? arrayUnion(cid) : arrayRemove(cid),
    updated_at: serverTimestamp(),
  });
}

/**
 * Activer un rôle (`activer` de ChoixDuRole, sur le site) : les champs de
 * `patchDActivation` (lib/roles), que la règle `isRoleEvolution` laisse au
 * titulaire, et rien d'autre.
 */
export async function activerLeRole(uid: string, patch: Record<string, string>): Promise<void> {
  await updateDoc(doc(db, "users", uid), { ...patch, updated_at: serverTimestamp() });
}

/**
 * Des compétitions par identifiant, triées par nom. Une compétition supprimée
 * depuis qu'on la suit est ignorée. Un `getDoc` chacune : la lecture est
 * publique, et une requête `in` s'arrête à trente identifiants.
 */
export async function lireCompetitions(ids: readonly string[]): Promise<Competition[]> {
  const snaps = await Promise.all(ids.map((cid) => getDoc(doc(db, "competitions", cid))));
  return snaps
    .filter((s) => s.exists())
    .map((s) => toCompetition(s.id, s.data() as FirestoreCompetition))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
