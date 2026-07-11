import { auth } from "@/lib/firebase";

// ============================================
// competition-notify — fire-and-forget push to a competition's followers
// via /api/notifications/competition (kickoff / goal / final score).
// Called from the live console; a notification failure must NEVER block
// or slow the live flow, so this swallows every error by design.
// ============================================

export function notifyCompetitionFollowers(input: {
  cid: string;
  title: string;
  body: string;
  link?: string;
}): void {
  void (async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch("/api/notifications/competition", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });
    } catch {
      // Best-effort only.
    }
  })();
}
