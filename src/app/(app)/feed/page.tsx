"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, Send, Image as ImageIcon, X } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { onPosts, createPost, toggleLike } from "@/lib/firestore";
import { uploadPostMedia } from "@/lib/storage";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PostCard, avatarColor } from "@/components/feed/PostCard";
import { UserProfileWidget } from "@/components/feed/UserProfileWidget";
import { CityMatchesWidget } from "@/components/feed/CityMatchesWidget";
import type { Post } from "@/types";

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
// Page
// ============================================

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState("");
  const [posting, setPosting] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              isLiked: !isLiked,
              likes: isLiked
                ? p.likes.filter((uid) => uid !== user.uid)
                : [...p.likes, user.uid],
            }
          : p
      )
    );
    try {
      await toggleLike(postId, user.uid, isLiked);
    } catch {
      // revert optimistic update on error
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                isLiked,
                likes: isLiked
                  ? [...p.likes, user.uid]
                  : p.likes.filter((uid) => uid !== user.uid),
              }
            : p
        )
      );
    }
  };

  const handleDelete = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Seules les images sont acceptées");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    setMediaFile(file);
    setMediaPreview(URL.createObjectURL(file));
  };

  const clearMedia = () => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!newPost.trim() || !user) return;
    setPosting(true);
    try {
      const isVenueOwner = user.userType === "venue_owner";
      
      const authorRole =
        user.userType === "manager" ? "Manager"
        : user.userType === "referee" ? "Arbitre"
        : isVenueOwner ? "Partenaire"
        : "Joueur";

      const authorName = isVenueOwner && user.companyName 
        ? user.companyName 
        : `${user.firstName} ${user.lastName.charAt(0)}.`;

      const authorAvatar = user.profilePictureUrl || `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`;
      
      const postId = await createPost({
        authorId: user.uid,
        authorName,
        authorRole,
        authorAvatar,
        type: "text",
        content: newPost,
      });

      if (mediaFile) {
        try {
          const url = await uploadPostMedia(postId, mediaFile);
          await updateDoc(doc(db, "posts", postId), { 
            media_urls: [url],
            updated_at: serverTimestamp() 
          });
          toast.success("Publication réussie avec photo");
        } catch (uploadErr) {
          console.error("Media upload error:", uploadErr);
          toast.error("Texte publié, mais erreur lors de l'upload de la photo");
        }
      } else {
        toast.success("Publication réussie");
      }

      setNewPost("");
      clearMedia();
    } catch (err) {
      console.error("Post creation error:", err);
      toast.error("Erreur lors de la publication");
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

      {/* 3-column layout */}
      <div className="flex gap-5 items-start">
        {/* Left sidebar — desktop only */}
        <div className="hidden lg:block w-60 shrink-0 sticky top-6">
          <UserProfileWidget user={user} />
        </div>

        {/* Feed center */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* New post form */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold text-white ${avatarColor(`${user.firstName} ${user.lastName}`)}`}>
                {user.profilePictureUrl ? (
                  <img
                    src={user.profilePictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                )}
              </div>

              <div className="flex-1">
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="Quoi de neuf sur le terrain ?"
                  rows={2}
                  className="w-full resize-none rounded-lg border-0 bg-gray-50 px-3 py-2.5 text-sm focus:bg-white focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors placeholder:text-gray-400"
                />

                {/* Media preview */}
                {mediaPreview && (
                  <div className="relative mt-2 inline-block">
                    <img src={mediaPreview} alt="preview" className="max-h-40 rounded-lg object-cover" />
                    <button
                      onClick={clearMedia}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-white hover:bg-gray-700"
                    >
                      <X size={10} />
                    </button>
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <ImageIcon size={14} /> Photo
                    </button>
                  </div>
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

          {/* Posts */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)}
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
            <AnimatePresence mode="popLayout">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <PostCard
                    post={post}
                    currentUser={user}
                    onLikeAction={handleLike}
                    onDeleteAction={handleDelete}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Right sidebar — desktop only */}
        <div className="hidden lg:block w-60 shrink-0 sticky top-6">
          <CityMatchesWidget city={user.locationCity} />
        </div>
      </div>
    </div>
  );
}
