"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send } from "lucide-react";
import { getComments, addComment } from "@/lib/firestore";
import { avatarColor, timeAgo } from "./PostCard";
import type { Comment } from "@/types";

interface CommentSectionProps {
  postId: string;
  commentCount: number;
  currentUser: { uid: string; name: string };
}

export function CommentSection({ postId, currentUser }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getComments(postId)
      .then((data) => setComments(data))
      .finally(() => setLoading(false));
  }, [postId]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const id = await addComment(postId, {
        authorId: currentUser.uid,
        authorName: currentUser.name,
        content: newComment.trim(),
      });
      const now = new Date().toISOString();
      setComments((prev) => [
        { id, authorId: currentUser.uid, authorName: currentUser.name, content: newComment.trim(), createdAt: now },
        ...prev,
      ]);
      setNewComment("");
    } finally {
      setSubmitting(false);
    }
  };

  const initials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Input */}
      <div className="flex gap-2 items-center">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(currentUser.name)}`}>
          {initials(currentUser.name)}
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Écrire un commentaire..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="text-primary-600 hover:text-primary-700 disabled:text-gray-300 transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-2">Aucun commentaire. Soyez le premier !</p>
      ) : (
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2"
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarColor(c.authorName)}`}>
                {initials(c.authorName)}
              </div>
              <div className="flex-1">
                <div className="inline-block rounded-2xl bg-gray-100 px-3 py-2 max-w-full">
                  <p className="text-xs font-semibold text-gray-900">{c.authorName}</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{c.content}</p>
                </div>
                <p className="mt-0.5 ml-2 text-[10px] text-gray-400">{timeAgo(c.createdAt)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
