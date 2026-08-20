// Server-only lib for public competition discovery (landing + /competitions).
// Uses firebase-admin (adminDb) and the SDK-agnostic mappers. MUST NOT be
// imported into any client component, it would leak server credentials.
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

export interface CompetitionHeroSlide {
  competition: Competition;
  featured: CompMatch | null;   // live match, else next scheduled
  results: CompMatch[];          // recent completed (≤5)
  upcoming: CompMatch[];         // scheduled with a date, soonest first (≤5)
}

/**
 * One rich hero slide per public competition: banner data (the competition) plus
 * its featured match, recent results and upcoming fixtures. One read per
 * competition (the whole comp_matches collection), derived in memory. Degrades
 * to [] on error.
 */
/** One competition with ALL its fixtures, the Direct feed reads across them. */
export interface CompetitionFeed {
  competition: Competition;
  matches: CompMatch[];
}

/**
 * Every public competition with its full fixture list, for the Direct home.
 *
 * The home used to bind to ONE competition (?c=slug) and show its poules,
 * standings and scorers. It now answers "what is on today, everywhere", so
 * it needs every competition's matches at once. One read per competition,
 * same cost as getHeroCompetitions; the client then attaches a real-time
 * listener per competition for live scores.
 */
export async function getDirectFeed(maxComps = 8): Promise<CompetitionFeed[]> {
  try {
    const comps = (await getPublicCompetitions()).slice(0, maxComps);
    return await Promise.all(
      comps.map(async (competition) => {
        const snap = await adminDb
          .collection("competitions")
          .doc(competition.id)
          .collection("comp_matches")
          .get();
        return {
          competition,
          matches: snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch)),
        };
      }),
    );
  } catch (err) {
    console.error("getDirectFeed failed:", err);
    return [];
  }
}

export async function getHeroCompetitions(maxComps = 5): Promise<CompetitionHeroSlide[]> {
  try {
    const comps = (await getPublicCompetitions()).slice(0, maxComps);
    return await Promise.all(
      comps.map(async (competition) => {
        const snap = await adminDb
          .collection("competitions")
          .doc(competition.id)
          .collection("comp_matches")
          .get();
        const all = snap.docs.map((d) => toCompMatch(d.id, d.data() as FirestoreCompMatch));

        const live = all.filter((m) => m.status === "live");
        const scheduled = all
          .filter((m) => m.status === "scheduled" && m.date != null)
          .sort((a, b) => (a.date as string).localeCompare(b.date as string));
        const completed = all
          .filter((m) => m.status === "completed")
          .sort((a, b) => (b.date ?? b.updatedAt).localeCompare(a.date ?? a.updatedAt));

        return {
          competition,
          featured: live[0] ?? scheduled[0] ?? null,
          results: completed.slice(0, 5),
          upcoming: scheduled.slice(0, 5),
        };
      }),
    );
  } catch (err) {
    console.error("getHeroCompetitions failed:", err);
    return [];
  }
}

/** Everything the public join page needs, in one server round-trip. */
export interface CompetitionLanding {
  competition: Competition;
  /** Teams already in, the social proof of the page. */
  teams: { id: string; name: string; logoUrl: string | null }[];
  matchCount: number;
}

/**
 * The conversion page's data, by slug.
 *
 * Read with the admin SDK rather than from the browser so the page can be
 * server-rendered: it is meant to be pasted into WhatsApp, and a link only
 * gets a title, a description and a thumbnail in the preview if the HTML
 * carries them before any JavaScript runs.
 *
 * Returns null for an unknown slug AND for a draft competition, a draft is
 * not public, and handing out its address would leak an unannounced event.
 */
export async function getCompetitionLanding(slug: string): Promise<CompetitionLanding | null> {
  try {
    const snap = await adminDb
      .collection("competitions")
      .where("slug", "==", slug)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const doc = snap.docs[0];
    const competition = toCompetition(doc.id, doc.data() as FirestoreCompetition);
    if (competition.status === "draft") return null;

    const [teamsSnap, matchesSnap] = await Promise.all([
      adminDb.collection("competitions").doc(doc.id).collection("comp_teams").get(),
      adminDb.collection("competitions").doc(doc.id).collection("comp_matches").get(),
    ]);

    return {
      competition,
      teams: teamsSnap.docs.map((d) => {
        const data = d.data() as { name?: string; logo_url?: string | null };
        return {
          id: d.id,
          name: data.name ?? "",
          logoUrl: data.logo_url ?? null,
        };
      }),
      matchCount: matchesSnap.size,
    };
  } catch (err) {
    console.error("getCompetitionLanding failed:", err);
    return null;
  }
}
