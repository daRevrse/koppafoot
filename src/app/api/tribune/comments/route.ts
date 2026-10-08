import { NextRequest, NextResponse } from "next/server";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { notifierCompte } from "@/lib/notifier-serveur";
import {
  nomDansLaTribune,
  notificationDeCommentaire,
  sonnerPourCeCommentaire,
  texteDuCommentaire,
  type CompteNomme,
} from "@/lib/tribune-commentaires";
import { SYSTEM_AUTHOR_ID } from "@/types";

/**
 * Commenter une publication de la Tribune.
 *
 * POST { postId, content } → { id, authorName }
 *
 * Le serveur signe le commentaire (l'appelant, sous le nom que la Tribune
 * lui donne), le compte sur la publication, et prévient l'auteur : la cloche
 * à chaque commentaire, le téléphone au plus une fois par publication toutes
 * les dix minutes (lib/tribune-commentaires). Ni celui qui commente sa
 * propre publication, ni le compte officiel ne sont prévenus.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    let uid: string;
    try {
      uid = (await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1])).uid;
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const corps = (await req.json().catch(() => ({}))) as { postId?: unknown; content?: unknown };
    const postId = typeof corps.postId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(corps.postId) ? corps.postId : null;
    const texte = texteDuCommentaire(corps.content);
    if (!postId || !texte) {
      return NextResponse.json({ error: "Commentaire vide ou trop long" }, { status: 400 });
    }

    const compte = await adminDb.collection("users").doc(uid).get();
    if (!compte.exists) return NextResponse.json({ error: "Compte introuvable" }, { status: 403 });
    const nom = nomDansLaTribune(compte.data() as CompteNomme);

    const postRef = adminDb.collection("posts").doc(postId);
    const commentRef = postRef.collection("comments").doc();
    const maintenant = Date.now();

    const issue = await adminDb.runTransaction(async (tx) => {
      const post = await tx.get(postRef);
      if (!post.exists) return null;
      const d = post.data() ?? {};
      const auteur = typeof d.author_id === "string" ? d.author_id : "";
      const prevenir = !!auteur && auteur !== uid && auteur !== SYSTEM_AUTHOR_ID;
      const dernier = d.commentaire_push_at instanceof Timestamp ? d.commentaire_push_at.toMillis() : null;
      const sonner = prevenir && sonnerPourCeCommentaire(dernier, maintenant);
      tx.set(commentRef, {
        author_id: uid,
        author_name: nom,
        content: texte,
        created_at: FieldValue.serverTimestamp(),
      });
      tx.update(postRef, {
        comment_count: FieldValue.increment(1),
        ...(sonner && { commentaire_push_at: Timestamp.fromMillis(maintenant) }),
      });
      return { auteur, prevenir, sonner };
    });
    if (!issue) return NextResponse.json({ error: "Publication introuvable" }, { status: 404 });

    // Après l'écriture, et sans la faire échouer : le commentaire est publié,
    // la notification n'en est que l'accusé.
    if (issue.prevenir) {
      await notifierCompte(issue.auteur, {
        type: "tribune_comment",
        ...notificationDeCommentaire(nom, texte, postId),
        push: issue.sonner,
      });
    }

    return NextResponse.json({ id: commentRef.id, authorName: nom });
  } catch (err) {
    console.error("[tribune/comments]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
