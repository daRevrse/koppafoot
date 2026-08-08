import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { announceCompetitionEvent, type CompetitionEvent } from "@/lib/tribune-server";
import type { FirestoreCompetition } from "@/types";

/**
 * Competition milestones announced in the Tribune by the official account.
 *
 * Most milestones happen in the browser (an organizer flips a status,
 * disqualifies a team, finishes a match), but the post itself must be written
 * server-side — the rules forbid a client from publishing as "system". So the
 * client does its own write, then calls this to have the announcement made.
 *
 * POST { cid, event }  — event is the milestone minus the competition fields,
 *                        which are read from the competition itself so a
 *                        caller cannot announce something about someone
 *                        else's competition under a name of their choosing.
 */

type IncomingEvent =
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

const KINDS = [
  "registrations_open", "team_entered", "match_result",
  "team_disqualified", "competition_completed",
];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    let callerUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
      callerUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { cid, event } = (await req.json()) as { cid?: string; event?: IncomingEvent };
    if (!cid || !event || !KINDS.includes(event.kind)) {
      return NextResponse.json({ error: "cid et event valides requis" }, { status: 400 });
    }

    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;

    // Only the people who run the competition may speak about it officially.
    if (!(competition.organizer_ids ?? []).includes(callerUid)) {
      const callerDoc = await adminDb.collection("users").doc(callerUid).get();
      if (callerDoc.data()?.user_type !== "superadmin") {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // A sandbox is one user practising on fake data — it has no business
    // showing up in everyone's feed.
    if (competition.is_sandbox) return NextResponse.json({ ok: true, skipped: "sandbox" });

    const id = await announceCompetitionEvent({
      ...event,
      competitionName: competition.name,
      slug: competition.slug,
    } as CompetitionEvent);

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[tribune/announce]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
