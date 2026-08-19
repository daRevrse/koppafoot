// Server-only lib for the PUBLIC side of the mercato. Uses firebase-admin
// (adminDb), so it must never be imported into a client component.
//
// Why it exists: join requests and invitations live behind isAuthenticated()
// in firestore.rules, and that rule is right — a pending request is private
// business between a player and a manager. But a CONFIRMED move is news: the
// club has a new player, and that is exactly the kind of thing the public
// board should carry. Reading it here with admin credentials publishes the
// confirmed ones without opening the collections to everybody.
//
// Degrades gracefully (returns []) so a public page never crashes if
// Firestore is unreachable at prerender time.

import { adminDb } from "@/lib/firebase-admin";

export interface Movement {
  id: string;
  playerName: string;
  playerPhoto: string | null;
  playerPosition: string | null;
  teamName: string;
  teamLogo: string | null;
  teamId: string;
  /** How the move happened — a club called, or a player knocked. */
  kind: "invitation" | "candidature";
  /** ISO date of the confirmation. */
  at: string;
}

type Row = Record<string, unknown>;

/** Stored in English; the board is French. Same wording as /mercato. */
const POSITION_FR: Record<string, string> = {
  goalkeeper: "Gardien",
  defender: "Défenseur",
  midfielder: "Milieu",
  forward: "Attaquant",
};

const position = (v: unknown): string | null => {
  const raw = typeof v === "string" ? v.trim() : "";
  if (raw === "") return null;
  return POSITION_FR[raw] ?? raw;
};

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v : null;

/**
 * These documents store `created_at` / `updated_at` as Firestore Timestamps,
 * not ISO strings — reading them as text yields nothing, which is exactly how
 * this page first shipped showing no movements at all despite eighteen of
 * them sitting in the database.
 */
function isoDate(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v;
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object") {
    const t = v as { toDate?: () => Date; _seconds?: number };
    if (typeof t.toDate === "function") {
      try { return t.toDate().toISOString(); } catch { /* fall through */ }
    }
    if (typeof t._seconds === "number") {
      return new Date(t._seconds * 1000).toISOString();
    }
  }
  return null;
}

/**
 * Confirmed moves, newest first, both directions merged.
 *
 * Ordering is done in memory rather than in the query: `updated_at` is not
 * indexed alongside `status` on either collection, and adding two composite
 * indexes for a page that reads a handful of rows would cost more than it
 * saves.
 */
export async function getConfirmedMovements(max = 20): Promise<Movement[]> {
  try {
    const [invites, requests] = await Promise.all([
      adminDb.collection("invitations").where("status", "==", "accepted").get(),
      adminDb.collection("join_requests").where("status", "==", "accepted").get(),
    ]);

    const fromInvites: Movement[] = invites.docs.map((d) => {
      const x = d.data() as Row;
      return {
        id: d.id,
        playerName: str(x.receiver_name) ?? "Joueur",
        playerPhoto: str(x.receiver_photo),
        playerPosition: position(x.receiver_position),
        teamName: str(x.team_name) ?? "Équipe",
        teamLogo: str(x.team_logo),
        teamId: str(x.team_id) ?? "",
        kind: "invitation",
        at: isoDate(x.updated_at) ?? isoDate(x.created_at) ?? "",
      };
    });

    const fromRequests: Movement[] = requests.docs.map((d) => {
      const x = d.data() as Row;
      return {
        id: d.id,
        playerName: str(x.player_name) ?? "Joueur",
        playerPhoto: str(x.player_photo),
        playerPosition: position(x.player_position),
        teamName: str(x.team_name) ?? "Équipe",
        teamLogo: str(x.team_logo),
        teamId: str(x.team_id) ?? "",
        kind: "candidature",
        at: isoDate(x.updated_at) ?? isoDate(x.created_at) ?? "",
      };
    });

    // A player can be invited AND apply to the same club, and both get
    // accepted — that is one arrival, not two. Keep the most recent record
    // of each (player, club) pair.
    const seen = new Set<string>();
    return [...fromInvites, ...fromRequests]
      .filter((m) => m.at !== "")
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((m) => {
        const key = `${m.playerName.toLowerCase()}::${m.teamId || m.teamName.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, max);
  } catch (err) {
    console.error("getConfirmedMovements failed:", err);
    return [];
  }
}
