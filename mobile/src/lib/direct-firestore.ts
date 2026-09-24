import {
  arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where,
  type Unsubscribe,
} from "firebase/firestore";
import { toCompMatch } from "@/lib/competition-mappers";
import { amicalVersCompMatch } from "@/lib/friendlies-shared";
import type { CompMatch, FirestoreCompMatch } from "@/types";
import { db } from "~/lib/firebase";

// Les trois lectures/écritures Firestore du lot. Les versions du site
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
