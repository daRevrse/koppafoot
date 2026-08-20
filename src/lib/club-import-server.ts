import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CompPlayer, FirestoreCompetition, LinkedCompPlayer } from "@/types";

// ============================================
// Server-only: copy a manager's club squad onto a competition team.
//
// Shared by the manual import (/api/competitions/club-import) and by the
// acceptance of a registration (/api/competitions/registrations), which must
// land a squad in exactly the same state.
//
// It writes BOTH sides of the link, `user_id` on the roster line AND a
// `linked_comp_players` row on the player's own user doc. The second write
// is why this cannot live on the client: the rules only ever let a user
// write their own document, and without it /stats has nothing to read.
// ============================================

const BATCH_LIMIT = 450;

export async function importClubRoster(input: {
  cid: string;
  teamId: string;
  clubId: string;
  competition: FirestoreCompetition;
}): Promise<{ added: number; linked: number }> {
  const { cid, teamId, clubId, competition } = input;

  const teamRef = adminDb
    .collection("competitions").doc(cid)
    .collection("comp_teams").doc(teamId);
  const [teamSnap, clubSnap] = await Promise.all([
    teamRef.get(),
    adminDb.collection("teams").doc(clubId).get(),
  ]);
  if (!teamSnap.exists) throw new Error("TEAM_NOT_FOUND");
  if (!clubSnap.exists) throw new Error("CLUB_NOT_FOUND");

  const compTeam = teamSnap.data()!;
  const club = clubSnap.data()!;

  const existing = (compTeam.players ?? []) as CompPlayer[];
  const linkedUsers = new Set(existing.map((p) => p.user_id).filter(Boolean));
  const existingIds = new Set(existing.map((p) => p.id));

  const memberIds = (club.member_ids ?? []) as string[];
  const squadNumbers = (club.squad_numbers ?? {}) as Record<string, string>;

  // A club roster is small, so plain gets beat an `in` query: no 30-id
  // chunking, no documentId() quirks.
  const memberDocs = await Promise.all(
    memberIds.map((id) => adminDb.collection("users").doc(id).get()),
  );
  const ghostSnap = await clubSnap.ref.collection("ghost_players").get().catch(() => null);

  const added: CompPlayer[] = [];
  const linkedUids: string[] = [];

  for (const doc of memberDocs) {
    if (!doc.exists || linkedUsers.has(doc.id)) continue;
    const u = doc.data()!;
    added.push({
      id: `u_${doc.id}`,
      name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "Joueur",
      number: squadNumbers[doc.id] ?? "",
      ...(u.position ? { position: u.position as string } : {}),
      user_id: doc.id,
    });
    linkedUids.push(doc.id);
  }

  for (const doc of ghostSnap?.docs ?? []) {
    const id = `ghost_${doc.id}`;
    if (existingIds.has(id)) continue;
    const g = doc.data();
    added.push({
      id,
      name: `${g.first_name ?? ""} ${g.last_name ?? ""}`.trim() || "Joueur",
      number: (g.squad_number as string) ?? "",
      ...(g.position ? { position: g.position as string } : {}),
      user_id: null,
    });
  }

  await teamRef.update({
    players: [...existing, ...added],
    claimed_by_team_id: clubId,
    updated_at: FieldValue.serverTimestamp(),
  });

  const link = (uid: string): LinkedCompPlayer => ({
    competition_id: cid,
    competition_name: competition.name,
    competition_slug: competition.slug,
    team_id: teamId,
    team_name: (compTeam.name as string) ?? "",
    player_id: `u_${uid}`,
    player_name: added.find((p) => p.user_id === uid)?.name ?? "",
  });

  for (let i = 0; i < linkedUids.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const uid of linkedUids.slice(i, i + BATCH_LIMIT)) {
      batch.update(adminDb.collection("users").doc(uid), {
        linked_comp_players: FieldValue.arrayUnion(link(uid)),
        updated_at: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  return { added: added.length, linked: linkedUids.length };
}
