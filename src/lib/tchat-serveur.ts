import { adminDb } from "@/lib/firebase-admin";
import { estSuperadmin } from "@/lib/admin-api-auth";
import { peutConfigurer } from "@/lib/competition-api-auth";
import { grantCoversMatch, toStaffGrant } from "@/lib/staff-scope";
import type { FirestoreCompetition, FirestoreStaffGrant } from "@/types";

// ============================================
// Le tchat d'un match, côté serveur (voir lib/tchat) : de quel match il
// s'agit, s'il est en direct, et qui peut y supprimer un message.
// ============================================

export interface MatchDuTchat {
  mid: string;
  /** La compétition d'un match de compétition, `null` pour un amical. */
  cid: string | null;
  statut: string;
  donnees: Record<string, unknown>;
}

/**
 * Le match d'un tchat : sous sa compétition quand `cid` est donné, dans
 * `matches` sinon. `null` s'il n'existe pas.
 */
export async function lireMatchDuTchat(mid: string, cid: string | null): Promise<MatchDuTchat | null> {
  if (!/^[A-Za-z0-9]{1,40}$/.test(mid) || (cid && !/^[A-Za-z0-9]{1,40}$/.test(cid))) return null;
  const snap = cid
    ? await adminDb.collection("competitions").doc(cid).collection("comp_matches").doc(mid).get()
    : await adminDb.collection("matches").doc(mid).get();
  if (!snap.exists) return null;
  const donnees = snap.data() ?? {};
  return { mid, cid, statut: typeof donnees.status === "string" ? donnees.status : "", donnees };
}

const liste = (x: unknown): string[] => (Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : []);

/**
 * Le staff du match, qui peut supprimer un message du tchat : en compétition,
 * ceux qui la configurent et le scoreur venu avec un code d'accès qui couvre
 * ce match ; en amical, les deux managers, leurs délégués et ceux qu'on a
 * chargés de couvrir le match. L'administration partout.
 */
export async function peutModererLeTchat(uid: string, m: MatchDuTchat): Promise<boolean> {
  if (m.cid) {
    const comp = await adminDb.collection("competitions").doc(m.cid).get();
    if (comp.exists && (await peutConfigurer(uid, comp.data() as FirestoreCompetition))) return true;
    const grant = await adminDb.collection("competitions").doc(m.cid).collection("staff_grants").doc(uid).get();
    if (grant.exists && grantCoversMatch(
      toStaffGrant(grant.data() as FirestoreStaffGrant),
      { id: m.mid, stage: String(m.donnees.stage ?? ""), group: (m.donnees.group as string | null) ?? null },
    )) {
      return true;
    }
  } else {
    const d = m.donnees;
    if (d.manager_id === uid || d.away_manager_id === uid || liste(d.moderator_ids).includes(uid)) return true;
    const equipes = [d.home_team_id, d.away_team_id].filter((t): t is string => typeof t === "string" && t !== "");
    const docs = await Promise.all(equipes.map((t) => adminDb.collection("teams").doc(t).get()));
    if (docs.some((t) => liste(t.data()?.staff_manager_ids).includes(uid))) return true;
  }
  const profil = await adminDb.collection("users").doc(uid).get();
  return profil.exists && estSuperadmin(profil.data());
}

export const messagesDuTchat = (mid: string) => adminDb.collection("match_chats").doc(mid).collection("messages");
