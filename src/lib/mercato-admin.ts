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
  playerId: string | null;
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
        playerId: str(x.receiver_id),
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
        playerId: str(x.player_id),
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
    const merged = [...fromInvites, ...fromRequests]
      .filter((m) => m.at !== "")
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((m) => {
        const key = `${m.playerName.toLowerCase()}::${m.teamId || m.teamName.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, max);

    return hydrateVisuals(merged);
  } catch (err) {
    console.error("getConfirmedMovements failed:", err);
    return [];
  }
}

/**
 * Va chercher les visages et les blasons manquants.
 *
 * Les documents d'invitation et de candidature portent des champs denormalises
 * (`receiver_photo`, `team_logo`) qui, dans les faits, sont vides sur la
 * totalite des dossiers existants : ils n'ont jamais ete remplis a l'ecriture.
 * Le rail affichait donc douze jeux d'initiales et douze ecussons par defaut.
 *
 * Plutot que de reparer l'ecriture retroactivement — ce qui demanderait une
 * migration et ne reglerait rien pour les dossiers deja passes — on relit la
 * source de verite : `users` et `teams`. C'est ce que fait deja la page
 * mercato cote client, ici en une passe et avec le SDK admin.
 *
 * Deux lectures groupees au total, quel que soit le nombre de mouvements, et
 * un echec laisse simplement les valeurs a null : on retombe sur les initiales.
 */
async function hydrateVisuals(movements: Movement[]): Promise<Movement[]> {
  const playerIds = [...new Set(movements.filter((m) => !m.playerPhoto && m.playerId).map((m) => m.playerId as string))];
  const teamIds = [...new Set(movements.filter((m) => !m.teamLogo && m.teamId).map((m) => m.teamId))];
  if (playerIds.length === 0 && teamIds.length === 0) return movements;

  const photoById = new Map<string, string>();
  const logoById = new Map<string, string>();

  try {
    const [users, teams] = await Promise.all([
      playerIds.length ? adminDb.getAll(...playerIds.map((id) => adminDb.doc(`users/${id}`))) : Promise.resolve([]),
      teamIds.length ? adminDb.getAll(...teamIds.map((id) => adminDb.doc(`teams/${id}`))) : Promise.resolve([]),
    ]);

    for (const d of users) {
      const url = str((d.data() as Row | undefined)?.profile_picture_url);
      if (url) photoById.set(d.id, url);
    }
    for (const d of teams) {
      const url = str((d.data() as Row | undefined)?.logo_url);
      if (url) logoById.set(d.id, url);
    }
  } catch (err) {
    console.error("hydrateVisuals failed:", err);
    return movements;
  }

  return movements.map((m) => ({
    ...m,
    playerPhoto: m.playerPhoto ?? (m.playerId ? photoById.get(m.playerId) ?? null : null),
    teamLogo: m.teamLogo ?? logoById.get(m.teamId) ?? null,
  }));
}
