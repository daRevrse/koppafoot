import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  publishOfficialPost, getTribuneIdentity, setTribuneIdentity, storeTribuneAvatar,
} from "@/lib/tribune-server";
import { SYSTEM_AUTHOR_ID } from "@/types";

/**
 * The superadmin's own voice in the Tribune.
 *
 * GET                                 , the official account's own posts,
 *                                        plus its display identity.
 * POST   { content, pinned?, link? }  , publish as the official account.
 * PATCH  { id, pinned? , content? }   , pin/unpin, or rewrite the text.
 * PUT    { name, avatarUrl }          , the account's display identity.
 * DELETE { id }                       , moderation: remove any post.
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

export async function GET(req: NextRequest) {
  try {
    const uid = await superadminUidOf(req);
    if (!uid) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const [snap, identity] = await Promise.all([
      adminDb
        .collection("posts")
        .where("author_id", "==", SYSTEM_AUTHOR_ID)
        .orderBy("created_at", "desc")
        .limit(50)
        .get(),
      getTribuneIdentity(),
    ]);

    return NextResponse.json({
      identity,
      posts: snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          content: x.content ?? "",
          type: x.type ?? "text",
          link: x.link ?? null,
          pinned: x.pinned ?? false,
          likes: (x.likes ?? []).length,
          commentCount: x.comment_count ?? 0,
          createdAt: x.created_at?.toDate?.()?.toISOString() ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("[admin/tribune GET]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const uid = await superadminUidOf(req);
    if (!uid) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const { name, avatarUrl, avatar } = (await req.json()) as {
      name?: string;
      avatarUrl?: string | null;
      /** New picture, base64, the browser cannot write the bucket itself. */
      avatar?: { data?: string; contentType?: string } | null;
    };
    if (!name?.trim()) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }

    let finalUrl = avatarUrl ?? null;
    if (avatar?.data && avatar.contentType) {
      if (!avatar.contentType.startsWith("image/")) {
        return NextResponse.json({ error: "Le fichier doit être une image" }, { status: 400 });
      }
      const buffer = Buffer.from(avatar.data, "base64");
      if (buffer.length > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "Image trop lourde (2 Mo maximum)" }, { status: 400 });
      }
      finalUrl = await storeTribuneAvatar(buffer, avatar.contentType);
    }

    await setTribuneIdentity({ name: name.trim(), avatarUrl: finalUrl });
    return NextResponse.json({ ok: true, identity: await getTribuneIdentity() });
  } catch (err) {
    console.error("[admin/tribune PUT]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
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

    // One pinned post at a time, a wall of pins pins nothing.
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

    const { id, pinned, content } = (await req.json()) as {
      id?: string; pinned?: boolean; content?: string;
    };
    if (!id || (typeof pinned !== "boolean" && content === undefined)) {
      return NextResponse.json({ error: "id, et pinned ou content requis" }, { status: 400 });
    }

    const ref = adminDb.collection("posts").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });
    }

    const patch: Record<string, unknown> = { updated_at: FieldValue.serverTimestamp() };

    if (content !== undefined) {
      // Rewriting text is only offered on the platform's own posts, editing
      // someone else's words under their name is not moderation.
      if (snap.data()?.author_id !== SYSTEM_AUTHOR_ID) {
        return NextResponse.json(
          { error: "Seules les publications officielles sont modifiables." },
          { status: 403 },
        );
      }
      if (!content.trim()) {
        return NextResponse.json({ error: "Le message ne peut pas être vide" }, { status: 400 });
      }
      patch.content = content.trim();
    }

    if (typeof pinned === "boolean") {
      if (pinned) await unpinAll();
      patch.pinned = pinned;
    }

    await ref.update(patch);
    return NextResponse.json({ ok: true, pinned, content: patch.content ?? undefined });
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

    // Warn the author their post went, unless it was ours to begin with.
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
