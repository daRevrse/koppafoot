"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Send, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";
import { onPosts, createPost, toggleLike } from "@/lib/firestore";
import type { Post } from "@/types";

// ============================================
// TribuneSidebar — the feed and its features live in a right sidebar
// of the shell (xl+). Composer + real-time posts + likes; comments
// open the full /feed page. Guests read, auth unlocks interactions.
// ============================================

function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-50 font-black text-emerald-600"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {url?.startsWith("http") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

function PostItem({ post, uid }: { post: Post; uid: string }) {
  let ago = "";
  try {
    ago = formatDistanceToNow(new Date(post.createdAt), { locale: fr, addSuffix: true });
  } catch { /* ignore */ }

  const handleLike = () => {
    if (!uid) {
      toast("Connecte-toi pour aimer une publication.", { icon: "🔒" });
      return;
    }
    toggleLike(post.id, uid, post.isLiked).catch(() => {});
  };

  return (
    <div className="border-b border-gray-50 px-4 py-3 last:border-0">
      <div className="flex items-start gap-2.5">
        <Avatar name={post.authorName} url={post.authorAvatar} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-xs font-black text-gray-900">{post.authorName}</p>
            {ago && <p className="shrink-0 text-[9px] font-bold text-gray-300">{ago}</p>}
          </div>
          {post.authorRole && post.authorRole !== "system" && (
            <p className="text-[10px] font-bold text-gray-300">{post.authorRole}</p>
          )}
          <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">
            {post.content}
          </p>

          {/* Match result metadata */}
          {post.metadata && post.metadata.scoreHome != null && post.metadata.scoreAway != null && (
            <div className="mt-2 flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-right text-[11px] font-bold text-gray-900">
                {post.metadata.homeTeam ?? "—"}
              </span>
              <span className="shrink-0 rounded-md bg-gray-900 px-2 py-0.5 text-[11px] font-black tabular-nums text-white">
                {post.metadata.scoreHome}–{post.metadata.scoreAway}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-gray-900">
                {post.metadata.awayTeam ?? "—"}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center gap-4">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-[11px] font-bold transition-colors ${
                post.isLiked ? "text-red-500" : "text-gray-300 hover:text-red-400"
              }`}
            >
              <Heart size={13} className={post.isLiked ? "fill-red-500" : ""} />
              {post.likes.length > 0 && post.likes.length}
            </button>
            <Link
              href="/feed"
              className="flex items-center gap-1 text-[11px] font-bold text-gray-300 transition-colors hover:text-gray-500"
            >
              <MessageCircle size={13} />
              {post.commentCount > 0 && post.commentCount}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TribuneSidebar() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const uid = user?.uid ?? "";

  useEffect(() => {
    const unsub = onPosts(15, uid, setPosts);
    return () => unsub();
  }, [uid]);

  const handlePost = async () => {
    if (!user || !draft.trim()) return;
    setPosting(true);
    try {
      await createPost({
        authorId: user.uid,
        authorName: `${user.firstName} ${user.lastName.charAt(0)}.`,
        authorRole: "",
        authorAvatar: user.profilePictureUrl || "",
        type: "text",
        content: draft.trim(),
      });
      setDraft("");
    } catch {
      toast.error("Impossible de publier. Réessaie.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-80 flex-shrink-0 xl:block">
      <div className="flex h-full flex-col border-l border-gray-200 bg-white">
        {/* Header */}
        <div className="flex h-16 shrink-0 items-center border-b border-gray-100 px-4">
          <h2 className="font-display text-sm font-black text-gray-900">La Tribune</h2>
        </div>

        {/* Composer (authed) / CTA (guest) */}
        {user ? (
          <div className="shrink-0 border-b border-gray-100 p-4">
            <div className="flex items-start gap-2.5">
              <Avatar name={`${user.firstName} ${user.lastName}`} url={user.profilePictureUrl} />
              <div className="min-w-0 flex-1">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Partage quelque chose…"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-300 focus:border-emerald-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-200 transition-colors"
                />
                <div className="mt-1.5 flex justify-end">
                  <button
                    onClick={handlePost}
                    disabled={posting || !draft.trim()}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[11px] font-black text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
                  >
                    {posting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Publier
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="shrink-0 border-b border-gray-100 p-4">
            <p className="text-center text-xs leading-relaxed text-gray-400">
              Connecte-toi pour publier et réagir.
            </p>
            <Link
              href="/signup"
              className="mt-2.5 flex items-center justify-center rounded-full bg-emerald-500 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-emerald-600"
            >
              Rejoindre
            </Link>
          </div>
        )}

        {/* Posts */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {posts.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-300">Aucune publication.</p>
          ) : (
            posts.map((post) => <PostItem key={post.id} post={post} uid={uid} />)
          )}
        </div>
      </div>
    </aside>
  );
}
