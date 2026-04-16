"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageCircle, Heart, Share2, Send, Image as ImageIcon,
  MoreHorizontal, Trophy, Users, UserPlus, MapPin,
  ThumbsUp, Clock, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { onPosts, createPost, toggleLike } from "@/lib/firestore";
import type { Post, PostType } from "@/types";

// ============================================
// Constants
// ============================================

const TYPE_BADGES: Record<PostType, { label: string; icon: typeof Trophy; color: string } | null> = {
  text: null,
  match_result: { label: "Résultat", icon: Trophy, color: "bg-primary-100 text-primary-700" },
  team_announcement: { label: "Recrutement", icon: UserPlus, color: "bg-blue-100 text-blue-700" },
  highlight: { label: "Performance", icon: ThumbsUp, color: "bg-accent-100 text-accent-700" },
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500",
  "bg-accent-500", "bg-orange-500", "bg-pink-500",
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  return `Il y a ${days}j`;
}

// ============================================
// Loading skeleton
// ============================================

function PostSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-start gap-3 p-4 pb-0">
        <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      </div>
      <div className="space-y-2 px-4 pt-3 pb-4">
        <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="flex border-t border-gray-100 px-2 py-2">
        <div className="h-8 flex-1 animate-pulse rounded bg-gray-50" />
        <div className="h-8 flex-1 animate-pulse rounded bg-gray-50" />
        <div className="h-8 flex-1 animate-pulse rounded bg-gray-50" />
      </div>
    </div>
  );
}

// ============================================
// Component
// ============================================

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  // Real-time feed listener
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubscribe = onPosts(30, user.uid, (data) => {
      setPosts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLike = async (post: Post) => {
    if (!user) return;
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              isLiked: !p.isLiked,
              likes: p.isLiked
                ? p.likes.filter((uid) => uid !== user.uid)
                : [...p.likes, user.uid],
            }
          : p
      )
    );
    try {
      await toggleLike(post.id, user.uid, post.isLiked);
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  };

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    try {
      await createPost({
        authorId: user.uid,
        authorName: `${user.firstName} ${user.lastName.charAt(0)}.`,
        authorRole: user.userType === "manager" ? "Manager" : user.userType === "referee" ? "Arbitre" : "Joueur",
        authorAvatar: `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
        type: "text",
        content: newPost,
      });
      setNewPost("");
    } catch (err) {
      console.error("Error creating post:", err);
    } finally {
      setPosting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-gray-900 font-display">La Tribune</h1>
        <p className="mt-1 text-sm text-gray-500">Actualités et discussions de la communauté</p>
      </motion.div>

      <div className="mx-auto max-w-2xl space-y-4">
        {/* New post form */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-xs font-bold text-white">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div className="flex-1">
              <textarea
                value={newPost}
                onChange={(e) => setNewPost(e.target.value)}
                placeholder="Quoi de neuf sur le terrain ?"
                rows={2}
                className="w-full resize-none rounded-lg border-0 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors placeholder:text-gray-400"
              />
              <div className="mt-2 flex items-center justify-between">
                <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors">
                  <ImageIcon size={14} /> Photo
                </button>
                <button
                  onClick={handlePost}
                  disabled={!newPost.trim() || posting}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40 transition-all"
                >
                  <Send size={12} /> Publier
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Loading skeleton */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center rounded-xl border-2 border-dashed border-gray-200 bg-white py-16"
          >
            <MessageCircle size={32} className="text-gray-300" />
            <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">Aucune publication</h3>
            <p className="mt-1 text-sm text-gray-500">Sois le premier à publier quelque chose !</p>
          </motion.div>
        ) : (
          /* Feed posts */
          <AnimatePresence mode="popLayout">
            {posts.map((post, i) => {
              const badge = TYPE_BADGES[post.type];
              const BadgeIcon = badge?.icon;
              const initials = post.authorAvatar || post.authorName.slice(0, 2).toUpperCase();

              return (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="rounded-xl border border-gray-200 bg-white"
                >
                  {/* Post header */}
                  <div className="flex items-start justify-between p-4 pb-0">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(post.authorName)}`}>
                        {initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{post.authorName}</span>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{post.authorRole}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock size={12} /> {timeAgo(post.createdAt)}
                        </div>
                      </div>
                    </div>
                    <button className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>

                  {/* Badge */}
                  {badge && BadgeIcon && (
                    <div className="px-4 pt-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
                        <BadgeIcon size={12} /> {badge.label}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="px-4 pt-3 pb-2">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{post.content}</p>
                  </div>

                  {/* Match result card */}
                  {post.type === "match_result" && post.metadata && (
                    <div className="mx-4 mb-2 rounded-lg bg-gray-50 p-3">
                      <div className="flex items-center justify-center gap-4">
                        <div className="flex items-center gap-2">
                          <Shield size={16} className="text-primary-500" />
                          <span className="text-sm font-bold text-gray-900">{post.metadata.homeTeam}</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1 shadow-sm">
                          <span className="text-lg font-bold text-gray-900 font-display">{post.metadata.scoreHome}</span>
                          <span className="text-xs text-gray-400">-</span>
                          <span className="text-lg font-bold text-gray-900 font-display">{post.metadata.scoreAway}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{post.metadata.awayTeam}</span>
                          <Shield size={16} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Team announcement card */}
                  {post.type === "team_announcement" && post.metadata?.teamName && (
                    <div className="mx-4 mb-2 flex items-center gap-3 rounded-lg bg-blue-50 p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                        <Shield size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{post.metadata.teamName}</p>
                        <p className="text-xs text-blue-600">Recherche de joueurs</p>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center border-t border-gray-100 px-2 py-1">
                    <button
                      onClick={() => handleLike(post)}
                      className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                        post.isLiked
                          ? "text-red-500"
                          : "text-gray-500 hover:text-red-500 hover:bg-red-50"
                      }`}
                    >
                      <Heart size={16} className={post.isLiked ? "fill-red-500" : ""} />
                      {post.likes.length > 0 && post.likes.length}
                    </button>
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                      <MessageCircle size={16} />
                      {post.commentCount > 0 && post.commentCount}
                    </button>
                    <button className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                      <Share2 size={16} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
