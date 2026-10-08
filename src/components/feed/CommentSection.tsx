"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send } from "lucide-react";
import toast from "react-hot-toast";
import { getComments } from "@/lib/firestore";
import { commenter } from "@/lib/tribune-client";
import { COMMENTAIRE_MAX } from "@/lib/tribune-commentaires";
import { avatarColor, timeAgo } from "./PostCard";
import type { Comment } from "@/types";
import { useLangue, useTextes } from "@/i18n";
import { textes } from "@/i18n/textes";
import { useComptesPublics } from "@/hooks/usePhotosDesComptes";

const T = textes(
  {
    ecrire: "Écrire un commentaire...",
    aucun: "Aucun commentaire. Sois le premier !",
    pasParti: "Ton commentaire n'est pas parti. Réessaie.",
  },
  {
    ecrire: "Write a comment...",
    aucun: "No comments yet. Be the first!",
    pasParti: "Your comment wasn't sent. Try again.",
  },
);

interface CommentSectionProps {
  postId: string;
  commentCount: number;
  /**
   * Le lecteur, ou `null` sans compte. Les commentaires restent lisibles,
   * c'est une page publique, mais on ne peut pas en ecrire.
   */
  currentUser: { uid: string; name: string; photo?: string | null } | null;
}

/**
 * Le visage de l'auteur : sa photo de profil, sinon ses initiales.
 *
 * LA PHOTO EST LUE, PAS RECOPIÉE. Un commentaire n'enregistre que le nom de
 * son auteur, et le fil affichait donc des initiales même pour qui a une
 * photo. On la demande à /api/public/photos (une requête pour tous les auteurs
 * du fil) : elle vaut pour les commentaires déjà écrits, et suit l'auteur
 * quand il change de photo.
 */
function Visage({ nom, photo, taille }: { nom: string; photo: string | null | undefined; taille: "sm" | "md" }) {
  const dim = taille === "md" ? "h-8 w-8 text-xs" : "h-7 w-7 text-[10px]";
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
    );
  }
  return (
    <div className={`flex ${dim} shrink-0 items-center justify-center rounded-full font-bold text-white ${avatarColor(nom)}`}>
      {nom.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function CommentSection({ postId, currentUser }: CommentSectionProps) {
  const { langue } = useLangue();
  const t = useTextes(T);
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
    if (!currentUser) return;
    const texte = newComment.trim();
    if (!texte) return;
    setSubmitting(true);
    try {
      const { id, authorName } = await commenter(postId, texte);
      const now = new Date().toISOString();
      setComments((prev) => [
        { id, authorId: currentUser.uid, authorName: authorName || currentUser.name, content: texte, createdAt: now },
        ...prev,
      ]);
      setNewComment("");
    } catch (err) {
      // L'échec se taisait : le texte restait dans le champ, sans un mot.
      console.error("Commentaire non publié :", err);
      toast.error(t.pasParti);
    } finally {
      setSubmitting(false);
    }
  };

  // Les auteurs du fil, et le lecteur : une seule requête pour toutes les photos.
  const { photos } = useComptesPublics([...comments.map((c) => c.authorId), currentUser?.uid]);

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Saisie : reservee a qui a un compte. Le fil, lui, reste lisible. */}
      {currentUser && (
      <div className="flex gap-2 items-center">
        <Visage nom={currentUser.name} photo={currentUser.photo || photos[currentUser.uid]} taille="md" />
        <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200/70 bg-gray-50 px-3 py-1.5">
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder={t.ecrire}
            maxLength={COMMENTAIRE_MAX}
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
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-2">
              <div className="h-7 w-7 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-24 animate-pulse bg-gray-200" />
                <div className="h-3 w-full animate-pulse bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-center text-xs text-gray-400 py-2">{t.aucun}</p>
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
              <Visage nom={c.authorName} photo={photos[c.authorId]} taille="sm" />
              <div className="flex-1">
                <div className="inline-block bg-gray-100 px-3 py-2 max-w-full">
                  <p className="text-xs font-semibold text-gray-900">{c.authorName}</p>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{c.content}</p>
                </div>
                <p className="mt-0.5 ml-2 text-[10px] text-gray-400">{timeAgo(c.createdAt, langue)}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  );
}
