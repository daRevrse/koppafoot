import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toStaffGrant } from "@/lib/staff-scope";
import type { FirestoreStaffGrant, StaffGrant } from "@/types";

// ============================================
// Staff grants — the client side of the access codes
//
// Grants are written by the API only (Firestore rules deny every client
// write). The browser reads them for two things: the organizer's staff screen,
// and the guards that decide whether someone may open the live space.
// ============================================

function grantsRef(cid: string) {
  return collection(db, "competitions", cid, "staff_grants");
}

/** Live list of everyone holding a code-based access on this competition. */
export function onStaffGrants(cid: string, cb: (grants: StaffGrant[]) => void): Unsubscribe {
  return onSnapshot(
    grantsRef(cid),
    (snap) => {
      const rows = snap.docs
        .map((d) => toStaffGrant(d.data() as FirestoreStaffGrant))
        .sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
      cb(rows);
    },
    (err) => {
      console.error("Error listening to staff grants:", err);
      cb([]);
    },
  );
}

/** The caller's own grant on a competition, or null. */
export async function getStaffGrant(cid: string, uid: string): Promise<StaffGrant | null> {
  try {
    const snap = await getDoc(doc(db, "competitions", cid, "staff_grants", uid));
    if (!snap.exists()) return null;
    return toStaffGrant(snap.data() as FirestoreStaffGrant);
  } catch (err) {
    console.error("Error loading staff grant:", err);
    return null;
  }
}

/**
 * Ids of the competitions where the user holds a grant. A collection-group
 * query, so a volunteer who never became a `moderator_id` still finds their
 * competition in the live space.
 *
 * Needs the `staff_grants.uid` field override in firestore.indexes.json:
 * single-field indexes are COLLECTION-scoped by default, so querying the field
 * across every competition throws until COLLECTION_GROUP scope is granted too.
 * Deploy with `firebase deploy --only firestore:indexes` after changing it.
 */
export async function listGrantedCompetitionIds(uid: string): Promise<string[]> {
  try {
    const snap = await getDocs(
      query(collectionGroup(db, "staff_grants"), where("uid", "==", uid)),
    );
    const out: string[] = [];
    for (const d of snap.docs) {
      const grant = toStaffGrant(d.data() as FirestoreStaffGrant);
      if (grant.revoked) continue;
      if (grant.expiresAt && new Date(grant.expiresAt).getTime() <= Date.now()) continue;
      // .../competitions/{cid}/staff_grants/{uid}
      const cid = d.ref.parent.parent?.id;
      if (cid) out.push(cid);
    }
    return out;
  } catch (err) {
    console.error("Error listing granted competitions:", err);
    return [];
  }
}
