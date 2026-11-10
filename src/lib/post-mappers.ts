// ============================================
// Les publications de la Tribune et leurs commentaires, du document Firestore
// à l'objet de l'écran. Partagé, pur, sans SDK : le site (lib/firestore) et
// l'application mobile (la Tribune) les lisent avec. Même principe que
// match-mappers, booking-mappers et equipe-mappers.
// ============================================

import { formatDate } from "@/lib/equipe-mappers";
import type { Comment, FirestoreComment, FirestorePost, Post } from "@/types";

export function toPost(id: string, d: FirestorePost, currentUserId?: string): Post {
  const likes = d.likes ?? [];
  const meta = d.metadata;
  return {
    id, authorId: d.author_id, authorName: d.author_name,
    authorRole: d.author_role, authorAvatar: d.author_avatar,
    type: d.type, content: d.content,
    metadata: meta ? {
      homeTeam: meta.home_team, awayTeam: meta.away_team,
      scoreHome: meta.score_home, scoreAway: meta.score_away,
      teamName: meta.team_name,
      teamId: meta.team_id,
      teamLogo: meta.team_logo ?? null,
      teamCity: meta.team_city ?? null,
      postes: meta.postes ?? [],
      closed: meta.closed === true,
      repostOf: meta.repost_of ? {
        postId: meta.repost_of.post_id,
        authorName: meta.repost_of.author_name,
        content: meta.repost_of.content,
      } : undefined,
    } : null,
    likes, commentCount: d.comment_count ?? 0,
    isLiked: currentUserId ? likes.includes(currentUserId) : false,
    mediaUrls: d.media_urls ?? [],
    pinned: d.pinned ?? false,
    link: d.link ?? null,
    createdAt: formatDate(d.created_at), updatedAt: formatDate(d.updated_at),
  };
}

export function toComment(id: string, d: FirestoreComment): Comment {
  return {
    id, authorId: d.author_id, authorName: d.author_name,
    content: d.content, createdAt: formatDate(d.created_at),
  };
}
