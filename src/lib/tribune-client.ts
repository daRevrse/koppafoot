import { auth } from "@/lib/firebase";

// ============================================
// Asking the server to announce a competition milestone in the Tribune.
//
// Deliberately best-effort: a failed announcement must never surface as a
// failure of the action that triggered it. Disqualifying a team is the real
// work; the post about it is not.
// ============================================

export type AnnounceEvent =
  | { kind: "registrations_open" }
  | { kind: "team_entered"; teamName: string }
  | {
      kind: "match_result";
      homeTeam: string; awayTeam: string;
      scoreHome: number; scoreAway: number;
      forfeit?: boolean;
    }
  | { kind: "team_disqualified"; teamName: string }
  | { kind: "competition_completed"; winner?: string | null };

export async function announce(cid: string, event: AnnounceEvent): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/tribune/announce", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ cid, event }),
    });
  } catch (err) {
    console.error("Tribune announcement failed:", err);
  }
}
