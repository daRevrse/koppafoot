import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { publishOfficialPost } from "@/lib/tribune-server";
import { SYSTEM_AUTHOR_ID } from "@/types";

/**
 * The superadmin's own voice in the Tribune.
 *
 * POST   { content, pinned?, link? }   — publish as the official account.
 * PATCH  { id, pinned }                — pin or unpin any post.
 * DELETE { id }                        — moderation: remove any post.
 *
 * Everything here is superadmin-only. Publishing as "system" is impossible
 * from a browser by design (see firestore.rules), so it has to come through
 * the admin SDK.
 */

async function superadminUidOf(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    const doc = await adminDb.collection("users").doc(decoded.uid).get();
    return doc.data()?.user_type === "superadmin" ? decoded.uid : null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const uid = await superadminUidOf(req);
    if (!uid) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { content, pinned, link } = (await req.json()) as {
      content?: string; pinned?: boolean; link?: string;
    };
    if (!content?.trim()) {
      return NextResponse.json({ error: "Le message est requis" }, { status: 400 });
    }

    // One pinned post at a time — a wall of pins pins nothing.
    if (pinned) await unpinAll();

    const id = await publishOfficialPost({
      type: "text",
      content: content.trim(),
      link: link?.trim() || null,
      pinned: Boolean(pinned),
    });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error("[admin/tribune POST]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

async function unpinAll() {
  const pinned = await adminDb.collection("posts").where("pinned", "==", true).get();
  await Promise.all(pinned.docs.map((d) => d.ref.update({ pinned: false })));
}

export async function PATCH(req: NextRequest) {
  try {
    const uid = await superadminUidOf(req);
    if (!uid) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id, pinned } = (await req.json()) as { id?: string; pinned?: boolean };
    if (!id || typeof pinned !== "boolean") {
      return NextResponse.json({ error: "id et pinned requis" }, { status: 400 });
    }

    const ref = adminDb.collection("posts").doc(id);
    if (!(await ref.get()).exists) {
      return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
    }
    if (pinned) await unpinAll();
    await ref.update({ pinned, updated_at: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true, pinned });
  } catch (err) {
    console.error("[admin/tribune PATCH]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const uid = await superadminUidOf(req);
    if (!uid) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

    const ref = adminDb.collection("posts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
    }

    // Warn the author their post went — unless it was ours to begin with.
    const authorId = snap.data()?.author_id;
    if (authorId && authorId !== SYSTEM_AUTHOR_ID) {
      await adminDb.collection("notifications").add({
        user_id: authorId,
        type: "system",
        title: "Publication retirée",
        body: "Une de tes publications a été retirée de la Tribune par la modération.",
        link: "/feed",
        read: false,
        created_at: FieldValue.serverTimestamp(),
      });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/tribune DELETE]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
