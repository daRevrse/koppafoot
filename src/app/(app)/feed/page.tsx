"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageCircle, Heart, Share2, Send, Image as ImageIcon,
  MoreHorizontal, Trophy, Users, UserPlus, MapPin,
  ThumbsUp, Clock, Shield,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

// ============================================
// Mock data
// ============================================

type PostType = "text" | "match_result" | "team_announcement" | "highlight";

interface FeedPost {
  id: string;
  author: {
    name: string;
    role: string;
    avatar: string; // initials placeholder
    color: string;
  };
  type: PostType;
  content: string;
  metadata?: {
    homeTeam?: string;
    awayTeam?: string;
    scoreHome?: number;
    scoreAway?: number;
    teamName?: string;
  };
  likes: number;
  comments: number;
  isLiked: boolean;
  timeAgo: string;
}

const FEED: FeedPost[] = [
  {
    id: "p1",
    author: { name: "Karim M.", role: "Manager", avatar: "KM", color: "bg-blue-500" },
    type: "match_result",
    content: "Belle victoire ce weekend ! L'équipe a montré du caractère en deuxième mi-temps. Bravo à tous les joueurs !",
    metadata: { homeTeam: "FC Koppa", awayTeam: "AS Tonnerre", scoreHome: 3, scoreAway: 1 },
    likes: 24,
    comments: 8,
    isLiked: false,
    timeAgo: "Il y a 2h",
  },
  {
    id: "p2",
    author: { name: "Sarah L.", role: "Joueur", avatar: "SL", color: "bg-emerald-500" },
    type: "text",
    content: "Quelqu'un connaît un bon terrain 5v5 dispo le samedi après-midi dans le 15e ? On cherche un créneau régulier pour notre équipe.",
    likes: 5,
    comments: 12,
    isLiked: true,
    timeAgo: "Il y a 4h",
  },
  {
    id: "p3",
    author: { name: "Mehdi B.", role: "Capitaine", avatar: "MB", color: "bg-purple-500" },
    type: "team_announcement",
    content: "Les Red Wolves recrutent ! On cherche un gardien et un défenseur central pour compléter l'effectif. Matchs le week-end, ambiance au top.",
    metadata: { teamName: "Red Wolves FC" },
    likes: 18,
    comments: 6,
    isLiked: false,
    timeAgo: "Il y a 6h",
  },
  {
    id: "p4",
    author: { name: "Youssef A.", role: "Joueur", avatar: "YA", color: "bg-accent-500" },
    type: "highlight",
    content: "Mon premier hat-trick en compétition ! 3 buts en 20 minutes. Merci à l'équipe pour les passes décisives. On continue comme ça !",
    likes: 45,
    comments: 15,
    isLiked: false,
    timeAgo: "Hier",
  },
  {
    id: "p5",
    author: { name: "Lucas D.", role: "Arbitre", avatar: "LD", color: "bg-gray-500" },
    type: "text",
    content: "Rappel : le fair-play c'est aussi respecter l'arbitre. Bonne semaine de foot à tous !",
    likes: 32,
    comments: 4,
    isLiked: true,
    timeAgo: "Hier",
  },
];

const TYPE_BADGES: Record<PostType, { label: string; icon: typeof Trophy; color: string } | null> = {
  text: null,
  match_result: { label: "Résultat", icon: Trophy, color: "bg-primary-100 text-primary-700" },
  team_announcement: { label: "Recrutement", icon: UserPlus, color: "bg-blue-100 text-blue-700" },
  highlight: { label: "Performance", icon: ThumbsUp, color: "bg-accent-100 text-accent-700" },
};

// ============================================
// Component
// ============================================

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(FEED);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);

  const handleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const handlePost = () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);

    const post: FeedPost = {
      id: `new-${Date.now()}`,
      author: {
        name: `${user.firstName} ${user.lastName.charAt(0)}.`,
        role: "Joueur",
        avatar: `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`,
        color: "bg-primary-500",
      },
      type: "text",
      content: newPost,
      likes: 0,
      comments: 0,
      isLiked: false,
      timeAgo: "À l'instant",
    };

    setTimeout(() => {
      setPosts((prev) => [post, ...prev]);
      setNewPost("");
      setPosting(false);
    }, 300);
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

        {/* Feed posts */}
        <AnimatePresence mode="popLayout">
          {posts.map((post, i) => {
            const badge = TYPE_BADGES[post.type];
            const BadgeIcon = badge?.icon;

            return (
              <motion.div
                key={post.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: post.id.startsWith("new-") ? 0 : i * 0.05 }}
                className="rounded-xl border border-gray-200 bg-white"
              >
                {/* Post header */}
                <div className="flex items-start justify-between p-4 pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${post.author.color}`}>
                      {post.author.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{post.author.name}</span>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{post.author.role}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12} /> {post.timeAgo}
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
                    onClick={() => handleLike(post.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                      post.isLiked
                        ? "text-red-500"
                        : "text-gray-500 hover:text-red-500 hover:bg-red-50"
                    }`}
                  >
                    <Heart size={16} className={post.isLiked ? "fill-red-500" : ""} />
                    {post.likes > 0 && post.likes}
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-gray-500 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                    <MessageCircle size={16} />
                    {post.comments > 0 && post.comments}
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <Share2 size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
