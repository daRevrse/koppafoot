// Server-only lib for public competition discovery (landing + /competitions).
// Uses firebase-admin (adminDb) and the SDK-agnostic mappers. MUST NOT be
// imported into any client component — it would leak server credentials.
// Every function degrades gracefully (returns [] / null) so public pages never
// crash if Firestore is unreachable at prerender/request time.

import { adminDb } from "@/lib/firebase-admin";
import { toCompetition, toCompMatch } from "@/lib/competition-mappers";
import type {
  Competition, CompMatch, FirestoreCompetition, FirestoreCompMatch, CompetitionStatus,
} from "@/types";

// Relevance rank: ongoing first, then upcoming, then finished. (draft is filtered out.)
const STATUS_RANK: Record<CompetitionStatus, number> = {
  group_stage: 0, knockout: 0, registration: 1, completed: 2, draft: 99,
};

/** All publicly-visible competitions (status != draft), most relevant first. */
export async function getPublicCompetitions(): Promise<Competition[]> {
  try {
    const snap = await adminDb.collection("competitions").get();
    const comps = snap.docs
      .map((d) => toCompetition(d.id, d.data() as FirestoreCompetition))
      .filter((c) => c.status !== "draft");
    comps.sort((a, b) => {
      const r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (r !== 0) return r;
      // tie-break: most recent start_date (fallback created_at) first
      return (b.startDate ?? b.createdAt).localeCompare(a.startDate ?? a.createdAt);
    });
    return comps;
  } catch (err) {
    console.error("getPublicCompetitions failed:", err);
    return [];
  }
}

/** The single highlighted competition + its live (or next scheduled) match. */
export async function getFeaturedCompetition(): Promise<{ competition: Competition; highlightMatch: CompMatch | null } | null> {
  try {
    const comps = await getPublicCompetitions();
    const competition = comps[0];
    if (!competition) return null;

    const matchesCol = adminDb
      .collection("competitions")
      .doc(competition.id)
      .collection("comp_matches");

    // Prefer a live match.
    const liveSnap = await matchesCol.where("status", "==", "live").limit(1).get();
    if (!liveSnap.empty) {
      const d = liveSnap.docs[0];
      return { competition, highlightMatch: toCompMatch(d.id, d.data() as FirestoreCompMatch) };
    }

    // Else the next scheduled match with a real date (filter null in memory).
    const schedSnap = await matchesCol
      .where("status", "==", "scheduled")
      .orderBy("date", "asc")
      .limit(5)
      .get();
    const next = schedSnap.docs
      .map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch))
      .find((m) => m.date != null);
    return { competition, highlightMatch: next ?? null };
  } catch (err) {
    console.error("getFeaturedCompetition failed:", err);
    return null;
  }
}
