import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { estSuperadmin } from "@/lib/admin-api-auth";

/**
 * Post reports.
 *
 * The Tribune's "Signaler" button used to pop a toast and send nothing,
 * a reported post reached no one. Reports now land in `post_reports`, which
 * is admin-SDK only: reporters write through this route and never read the
 * queue back.
 *
 * POST   { postId, reason? } , any authenticated user reports a post.
 * GET    ?status=pending     , superadmin reads the queue.
 * PATCH  { id, action }      , superadmin dismisses a report.
 */

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

async function isSuperadmin(uid: string): Promise<boolean> {
  const doc = await adminDb.collection("users").doc(uid).get();
  return estSuperadmin(doc.data());
}

export async function POST(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { postId, reason } = (await req.json()) as { postId?: string; reason?: string };
    if (!postId) return NextResponse.json({ error: "postId requis" }, { status: 400 });

    const postSnap = await adminDb.collection("posts").doc(postId).get();
    if (!postSnap.exists) {
      return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
    }
    const post = postSnap.data()!;

    // One report per person per post: reporting twice is not two problems.
    const existing = await adminDb
      .collection("post_reports")
      .where("post_id", "==", postId)
      .where("reporter_id", "==", uid)
      .limit(1)
      .get();
    if (!existing.empty) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const reporter = await adminDb.collection("users").doc(uid).get();
    const r = reporter.data();

    await adminDb.collection("post_reports").add({
      post_id: postId,
      // Snapshotted: the point of a report is to show what was written, and
      // an author can edit or delete the post before anyone reviews it.
      post_content: post.content ?? "",
      post_author_id: post.author_id ?? "",
      post_author_name: post.author_name ?? "",
      reporter_id: uid,
      reporter_name: `${r?.first_name ?? ""} ${r?.last_name ?? ""}`.trim() || "Un membre",
      reason: (reason ?? "").trim(),
      status: "pending",
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tribune/reports POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid || !(await isSuperadmin(uid))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const wantAll = req.nextUrl.searchParams.get("status") === "all";
    const base = adminDb.collection("post_reports");
    const snap = await (wantAll ? base.get() : base.where("status", "==", "pending").get());

    const reports = snap.docs
      .map((d) => {
        const x = d.data();
        return {
          id: d.id,
          postId: x.post_id,
          postContent: x.post_content ?? "",
          postAuthorId: x.post_author_id ?? "",
          postAuthorName: x.post_author_name ?? "",
          reporterName: x.reporter_name ?? "",
          reason: x.reason ?? "",
          status: x.status ?? "pending",
          createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
        };
      })
      .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

    return NextResponse.json({ reports });
  } catch (err) {
    console.error("[tribune/reports GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = await callerUidOf(req);
    if (!uid || !(await isSuperadmin(uid))) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { id, action } = (await req.json()) as { id?: string; action?: string };
    if (!id || action !== "dismiss") {
      return NextResponse.json({ error: "id et action (dismiss) requis" }, { status: 400 });
    }

    await adminDb.collection("post_reports").doc(id).update({
      status: "reviewed",
      reviewed_by: uid,
      reviewed_at: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[tribune/reports PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
