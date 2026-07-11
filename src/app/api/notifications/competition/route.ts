import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendPushToUser } from "@/lib/fcm-server";
import type { FirestoreCompetition } from "@/types";

/**
 * POST /api/notifications/competition
 *
 * Push a competition event (kickoff / goal / final score) to every user
 * following the competition (users.followed_competition_ids array-contains cid).
 *
 * Body: { cid: string; title: string; body: string; link?: string }
 *
 * Authorization: Bearer id token; the caller must be an organizer OR a
 * moderator of THAT competition, or a superadmin — the same people allowed
 * to operate the live console. Checked against the server-loaded competition
 * doc, never trusting the client.
 *
 * Fire-and-forget from the console: failures here must never block the
 * live flow, so the handler degrades to per-user catch + a count response.
 */

const MAX_FOLLOWERS_PER_BLAST = 500;

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

    const { cid, title, body, link } = (await req.json()) as {
      cid?: string; title?: string; body?: string; link?: string;
    };
    if (!cid || !title?.trim() || !body?.trim()) {
      return NextResponse.json({ error: "cid, title et body requis" }, { status: 400 });
    }

    const compSnap = await adminDb.collection("competitions").doc(cid).get();
    if (!compSnap.exists) {
      return NextResponse.json({ error: "Compétition introuvable" }, { status: 404 });
    }
    const competition = compSnap.data() as FirestoreCompetition;

    const isStaff =
      (competition.organizer_ids ?? []).includes(callerUid) ||
      (competition.moderator_ids ?? []).includes(callerUid);
    if (!isStaff) {
      const callerDoc = await adminDb.collection("users").doc(callerUid).get();
      const isSuperadmin = callerDoc.exists && callerDoc.data()?.user_type === "superadmin";
      if (!isSuperadmin) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Followers of this competition
    const followersSnap = await adminDb
      .collection("users")
      .where("followed_competition_ids", "array-contains", cid)
      .limit(MAX_FOLLOWERS_PER_BLAST)
      .get();

    const results = await Promise.allSettled(
      followersSnap.docs.map((d) =>
        sendPushToUser(d.id, { title: title.trim(), body: body.trim(), link }),
      ),
    );
    const sent = results.filter((r) => r.status === "fulfilled").length;

    return NextResponse.json({ ok: true, followers: followersSnap.size, sent });
  } catch (err) {
    console.error("[notifications/competition]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
