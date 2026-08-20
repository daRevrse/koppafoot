import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Follow / unfollow, for both user profiles and teams.
 *
 * The follow document itself was always writable only by its own follower, but
 * the two counters it maintains live on the *followed* document, so the rules
 * had to allow any signed-in user to write `followers_count` on any user, which
 * meant anyone could set anyone's follower count to anything. Both sides of the
 * write happen here now, in one transaction, and that rule branch is gone.
 *
 * POST { action: "follow" | "unfollow", targetType: "user" | "team", targetId }
 *
 * The follower is always the token's owner, never a value from the body.
 */

type Body = {
  action?: "follow" | "unfollow";
  targetType?: "user" | "team";
  targetId?: string;
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  let followerId: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    followerId = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const { action, targetType, targetId } = (await req.json().catch(() => ({}))) as Body;
  if (
    (action !== "follow" && action !== "unfollow") ||
    (targetType !== "user" && targetType !== "team") ||
    !targetId
  ) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  if (targetType === "user" && targetId === followerId) {
    return NextResponse.json({ error: "On ne se suit pas soi-même" }, { status: 400 });
  }

  const isTeam = targetType === "team";
  const followRef = adminDb
    .collection(isTeam ? "team_follows" : "follows")
    .doc(isTeam ? `${followerId}_team_${targetId}` : `${followerId}_${targetId}`);
  const targetRef = adminDb.collection(isTeam ? "teams" : "users").doc(targetId);

  try {
    await adminDb.runTransaction(async (tx) => {
      const [followSnap, targetSnap] = await Promise.all([
        tx.get(followRef),
        tx.get(targetRef),
      ]);
      if (!targetSnap.exists) throw new Error("NOT_FOUND");

      // Counters only move when the relationship actually changes. Following
      // twice, a double-tap, a retry, used to increment twice.
      const alreadyFollows = followSnap.exists;
      if (action === "follow" && alreadyFollows) return;
      if (action === "unfollow" && !alreadyFollows) return;

      const delta = action === "follow" ? 1 : -1;

      if (action === "follow") {
        tx.set(followRef, {
          follower_id: followerId,
          ...(isTeam ? { team_id: targetId } : { following_id: targetId }),
          created_at: FieldValue.serverTimestamp(),
        });
      } else {
        tx.delete(followRef);
      }

      tx.update(targetRef, {
        followers_count: FieldValue.increment(delta),
        updated_at: FieldValue.serverTimestamp(),
      });

      // Only people have a "following" count; teams do not follow anything.
      if (!isTeam) {
        tx.update(adminDb.collection("users").doc(followerId), {
          following_count: FieldValue.increment(delta),
          updated_at: FieldValue.serverTimestamp(),
        });
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    }
    console.error("follow transaction failed:", err);
    return NextResponse.json({ error: "Opération impossible" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
