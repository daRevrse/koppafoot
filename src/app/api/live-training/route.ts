import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import type { CompPlayer } from "@/types";

/**
 * Training sandbox for the live console.
 *
 * New reporters and moderators need somewhere to make mistakes. This route
 * hands each user their OWN throwaway competition — they are its sole
 * organizer, so every existing Firestore rule already grants them the writes
 * the console performs. No rules change, and no two trainees can collide.
 *
 * The competition is `status: "draft"` and `is_sandbox: true`, so it is
 * filtered out of every public and organizer listing; only /live-ops shows it.
 *
 * POST  — create the sandbox, or return the existing one (idempotent).
 * PATCH — reset the match: score, events and timer back to kickoff.
 */

const SANDBOX_NAME = "Match d'entraînement";

const HOME_TEAM = { name: "FC Entraînement", short: "ENT", color: "#10b981" };
const AWAY_TEAM = { name: "AS Démo", short: "DEM", color: "#6366f1" };

// Two full-ish sheets so the trainee can build a lineup, sub, score and book.
const FIRST_NAMES = [
  "Kodjo", "Yao", "Koffi", "Amivi", "Sena", "Edem", "Mawuli",
  "Komi", "Afi", "Selom", "Kossi", "Ayaba", "Dela", "Elom",
];
const LAST = ["Adjo", "Mensah", "Agbeko", "Lawson", "Dogbe", "Attiogbe", "Kouassi"];

function buildRoster(seed: number): CompPlayer[] {
  return Array.from({ length: 14 }, (_, i) => ({
    id: `p${seed}_${i + 1}`,
    name: `${FIRST_NAMES[(i + seed * 3) % FIRST_NAMES.length]} ${LAST[(i + seed) % LAST.length]}`,
    number: String(i + 1),
    position:
      i === 0 ? "Gardien" : i < 5 ? "Défenseur" : i < 10 ? "Milieu" : "Attaquant",
    user_id: null,
  }));
}

async function callerUidOf(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    return decoded.uid;
  } catch {
    return null;
  }
}

/** The caller's existing sandbox, if any. */
async function findSandbox(uid: string) {
  const snap = await adminDb
    .collection("competitions")
    .where("is_sandbox", "==", true)
    .where("created_by", "==", uid)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0];
}

async function firstMatchId(cid: string): Promise<string | null> {
  const snap = await adminDb
    .collection("competitions").doc(cid)
    .collection("comp_matches")
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

export async function POST(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const existing = await findSandbox(uid);
    if (existing) {
      const mid = await firstMatchId(existing.id);
      if (mid) return NextResponse.json({ ok: true, cid: existing.id, mid, created: false });
      // Sandbox exists but its match is gone — fall through and rebuild it.
      await existing.ref.delete();
    }

    const compRef = adminDb.collection("competitions").doc();
    // Slug stays unique and unguessable — sandboxes never surface publicly,
    // but they share the slug namespace with real competitions.
    await compRef.set({
      name: SANDBOX_NAME,
      slug: `entrainement-${compRef.id.slice(0, 8).toLowerCase()}`,
      description: "Bac à sable : entraîne-toi à la console live, rien n'est publié.",
      logo_url: null,
      banner_url: null,
      organizer_ids: [uid],
      moderator_ids: [],
      created_by: uid,
      status: "draft",
      competition_type: "cup",
      is_sandbox: true,
      format: {
        group_count: 0,
        teams_per_group: 0,
        qualifiers_per_group: 0,
        has_third_place: false,
        double_round: false,
        knockout_teams: 2,
        points: { win: 3, draw: 1, loss: 0 },
        team_size: 11,
        half_duration: 45,
      },
      start_date: null,
      end_date: null,
      venue_city: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const teamsCol = compRef.collection("comp_teams");
    const homeRef = teamsCol.doc();
    const awayRef = teamsCol.doc();
    const teamDoc = (t: typeof HOME_TEAM, players: CompPlayer[]) => ({
      name: t.name,
      short_name: t.short,
      logo_url: null,
      color: t.color,
      group: null,
      players,
      claimed_by_manager_id: null,
      claimed_by_team_id: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });

    const matchRef = compRef.collection("comp_matches").doc();

    const batch = adminDb.batch();
    batch.set(homeRef, teamDoc(HOME_TEAM, buildRoster(1)));
    batch.set(awayRef, teamDoc(AWAY_TEAM, buildRoster(2)));
    batch.set(matchRef, {
      competition_id: compRef.id,
      stage: "knockout",
      group: null,
      round: "final",
      bracket_slot: 0,
      home_team_id: homeRef.id,
      away_team_id: awayRef.id,
      home_team_name: HOME_TEAM.name,
      away_team_name: AWAY_TEAM.name,
      home_team_logo: null,
      away_team_logo: null,
      date: null,
      time: null,
      venue_name: "Terrain d'entraînement",
      venue_city: null,
      status: "scheduled",
      score_home: null,
      score_away: null,
      penalty_home: null,
      penalty_away: null,
      winner_team_id: null,
      feeds_into_match_id: null,
      feeds_into_slot: null,
      live_state: null,
      created_at: FieldValue.serverTimestamp(),
      updated_at: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    return NextResponse.json({ ok: true, cid: compRef.id, mid: matchRef.id, created: true });
  } catch (err) {
    console.error("[live-training POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const sandbox = await findSandbox(uid);
    if (!sandbox) {
      return NextResponse.json({ error: "Aucun match d'entraînement" }, { status: 404 });
    }
    const mid = await firstMatchId(sandbox.id);
    if (!mid) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

    // Back to kickoff: score, events, timer and match sheets all cleared.
    await sandbox.ref.collection("comp_matches").doc(mid).update({
      status: "scheduled",
      score_home: null,
      score_away: null,
      penalty_home: null,
      penalty_away: null,
      winner_team_id: null,
      live_state: null,
      home_lineup: [],
      away_lineup: [],
      home_lineup_ready: false,
      away_lineup_ready: false,
      home_on_pitch: [],
      away_on_pitch: [],
      updated_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, cid: sandbox.id, mid });
  } catch (err) {
    console.error("[live-training PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
