"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Heart, MessageCircle, Share2, MoreHorizontal,
  Trophy, UserPlus, ThumbsUp, Clock, Shield,
  Copy, Repeat2, Pencil, Trash2, Flag,
  Check, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { deletePost, updatePostContent, createPost } from "@/lib/firestore";
import { CommentSection } from "./CommentSection";
import type { Post, PostType, UserProfile } from "@/types";

// ============================================
// Constants (shared with page.tsx)
// ============================================

export const TYPE_BADGES: Record<PostType, { label: string; icon: typeof Trophy; color: string } | null> = {
  text: null,
  match_result: { label: "Résultat", icon: Trophy, color: "bg-primary-100 text-primary-700" },
  team_announcement: { label: "Recrutement", icon: UserPlus, color: "bg-blue-100 text-blue-700" },
  highlight: { label: "Performance", icon: ThumbsUp, color: "bg-accent-100 text-accent-700" },
};

export const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500",
  "bg-accent-500", "bg-orange-500", "bg-pink-500",
];

export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function timeAgo(dateIn: any): string {
  if (!dateIn) return "";
  let date: Date;
  if (typeof dateIn === "string") {
    date = new Date(dateIn);
  } else if (dateIn && typeof dateIn.toDate === "function") {
    date = dateIn.toDate();
  } else if (dateIn && dateIn.seconds) {
    date = new Date(dateIn.seconds * 1000);
  } else if (dateIn instanceof Date) {
    date = dateIn;
  } else {
    return "";
  }

  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString();
}

// ============================================
// Dropdown helper
// ============================================

function useDropdown() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return { open, setOpen, close };
}

// ============================================
// PostCard
// ============================================

interface PostCardProps {
  post: Post;
  currentUser: UserProfile;
  onLikeAction: (postId: string, isLiked: boolean) => void;
  onDeleteAction: (postId: string) => void;
}

export function PostCard({ post, currentUser, onLikeAction, onDeleteAction }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);
  const [showRepost, setShowRepost] = useState(false);
  const [repostText, setRepostText] = useState("");
  const [reposting, setReposting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const shareDropdown = useDropdown();
  const optionsDropdown = useDropdown();

  const badge = TYPE_BADGES[post.type];
  const BadgeIcon = badge?.icon;
  const initials = post.authorAvatar || post.authorName.slice(0, 2).toUpperCase();
  const isOwn = post.authorId === currentUser.uid;

  const isVenueOwner = currentUser.userType === "venue_owner";

  const authorRole =
    currentUser.userType === "manager" ? "Manager"
    : currentUser.userType === "referee" ? "Arbitre"
    : isVenueOwner ? "Partenaire"
    : "Joueur";

  const authorName = isVenueOwner && currentUser.companyName
    ? currentUser.companyName
    : `${currentUser.firstName} ${currentUser.lastName.charAt(0)}.`;

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent === post.content) { setEditing(false); return; }
    setSavingEdit(true);
    try {
      await updatePostContent(post.id, editContent.trim());
      setEditing(false);
    } catch {
      toast.error("Erreur lors de la modification");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Supprimer cette publication ?")) return;
    setDeleting(true);
    try {
      await deletePost(post.id);
      onDeleteAction(post.id);
    } catch {
      toast.error("Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Lien copié !");
    });
    shareDropdown.close();
  };

  const handleRepost = async () => {
    if (!repostText.trim()) return;
    setReposting(true);
    try {
      await createPost({
        authorId: currentUser.uid,
        authorName,
        authorRole,
        authorAvatar: currentUser.profilePictureUrl || `${currentUser.firstName.charAt(0)}${currentUser.lastName.charAt(0)}`,
        type: "text",
        content: repostText,
        metadata: {
          repost_of: {
            post_id: post.id,
            author_name: post.authorName,
            content: post.content,
          },
        },
      });
      toast.success("Publication partagée !");
      setShowRepost(false);
      setRepostText("");
    } catch {
      toast.error("Erreur lors du partage");
    } finally {
      setReposting(false);
    }
  };

  if (deleting) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-0">
        <div className="flex items-center gap-3">
          <Link href={`/profile/${post.authorId}`} className="shrink-0">
            <div className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white transition-opacity hover:opacity-80 ${avatarColor(post.authorName)}`}>
              {post.authorAvatar?.startsWith("http") ? (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{post.authorAvatar || post.authorName.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={`/profile/${post.authorId}`}
                className="text-sm font-semibold text-gray-900 hover:underline"
              >
                {post.authorName}
              </Link>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{post.authorRole}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Clock size={12} /> {timeAgo(post.createdAt)}
            </div>
          </div>
        </div>

        {/* Options menu */}
        <div className="relative">
          <button
            onClick={() => optionsDropdown.setOpen(!optionsDropdown.open)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            <MoreHorizontal size={16} />
          </button>
          <AnimatePresence>
            {optionsDropdown.open && (
              <>
                <div className="fixed inset-0 z-10" onClick={optionsDropdown.close} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-9 z-20 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                >
                  {isOwn ? (
                    <>
                      <button
                        onClick={() => { setEditing(true); optionsDropdown.close(); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil size={14} /> Modifier
                      </button>
                      <button
                        onClick={() => { optionsDropdown.close(); handleDelete(); }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} /> Supprimer
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => { toast("Signalement envoyé", { icon: "🚩" }); optionsDropdown.close(); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Flag size={14} /> Signaler
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Type badge */}
      {badge && BadgeIcon && (
        <div className="px-4 pt-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.color}`}>
            <BadgeIcon size={12} /> {badge.label}
          </span>
        </div>
      )}

      {/* Content / Edit mode */}
      <div className="px-4 pt-3 pb-2">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-primary-600 focus:outline-none"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Check size={12} /> Sauvegarder
              </button>
              <button
                onClick={() => { setEditing(false); setEditContent(post.content); }}
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <X size={12} /> Annuler
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{post.content}</p>
        )}
      </div>

      {/* Repost citation */}
      {post.metadata?.repostOf && (
        <div className="mx-4 mb-2 rounded-lg border-l-4 border-primary-400 bg-gray-50 px-3 py-2">
          <p className="text-xs font-semibold text-gray-500 mb-1">↩ {post.metadata.repostOf.authorName}</p>
          <p className="text-xs text-gray-600 italic line-clamp-3">{post.metadata.repostOf.content}</p>
        </div>
      )}

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

      {/* Media */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className={`mx-4 mb-2 grid gap-1 overflow-hidden rounded-lg ${post.mediaUrls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.mediaUrls.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt=""
              className="w-full object-cover max-h-72"
            />
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center border-t border-gray-100 px-2 py-1">
        {/* Like */}
        <button
          onClick={() => onLikeAction(post.id, post.isLiked)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            post.isLiked ? "text-red-500" : "text-gray-500 hover:text-red-500 hover:bg-red-50"
          }`}
        >
          <Heart size={16} className={post.isLiked ? "fill-red-500" : ""} />
          {post.likes.length > 0 && post.likes.length}
        </button>

        {/* Comment */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            showComments ? "text-primary-600 bg-primary-50" : "text-gray-500 hover:text-primary-600 hover:bg-primary-50"
          }`}
        >
          <MessageCircle size={16} />
          {post.commentCount > 0 && post.commentCount}
        </button>

        {/* Share */}
        <div className="relative flex-1">
          <button
            onClick={() => shareDropdown.setOpen(!shareDropdown.open)}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Share2 size={16} />
          </button>
          <AnimatePresence>
            {shareDropdown.open && (
              <>
                <div className="fixed inset-0 z-10" onClick={shareDropdown.close} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 min-w-[200px] rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                >
                  <button
                    onClick={handleCopyLink}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Copy size={14} /> Copier le lien
                  </button>
                  <button
                    onClick={() => { setShowRepost(true); shareDropdown.close(); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Repeat2 size={14} /> Repartager dans la Tribune
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Repost modal */}
      <AnimatePresence>
        {showRepost && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-100 px-4 py-3 overflow-hidden"
          >
            <p className="text-xs text-gray-500 mb-2 font-medium">Ajouter un commentaire à votre partage</p>
            <div className="rounded-lg border-l-4 border-primary-400 bg-gray-50 px-3 py-2 mb-2">
              <p className="text-xs font-semibold text-gray-500">{post.authorName}</p>
              <p className="text-xs text-gray-600 italic line-clamp-2">{post.content}</p>
            </div>
            <textarea
              value={repostText}
              onChange={(e) => setRepostText(e.target.value)}
              placeholder="Votre commentaire..."
              rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:bg-white focus:ring-1 focus:ring-primary-600 focus:outline-none"
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button
                onClick={handleRepost}
                disabled={!repostText.trim() || reposting}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Repeat2 size={12} /> Partager
              </button>
              <button
                onClick={() => { setShowRepost(false); setRepostText(""); }}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <CommentSection
              postId={post.id}
              commentCount={post.commentCount}
              currentUser={{ uid: currentUser.uid, name: `${currentUser.firstName} ${currentUser.lastName.charAt(0)}.` }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
