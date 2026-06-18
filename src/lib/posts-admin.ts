// Server-only reader for recent public feed posts (La Tribune preview on the home).
// Uses firebase-admin; MUST NOT be imported into a client component. Posts are
// publicly readable. Degrades gracefully (returns []).

import { adminDb } from "@/lib/firebase-admin";

export interface PublicPost {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatar: string | null;
  type: string;
  content: string;
  metadata: {
    homeTeam?: string;
    awayTeam?: string;
    scoreHome?: number;
    scoreAway?: number;
    teamName?: string;
  } | null;
  mediaUrls: string[];
  commentCount: number;
  likesCount: number;
  createdAt: string;
}

interface FsPostMeta {
  home_team?: string;
  away_team?: string;
  score_home?: number;
  score_away?: number;
  team_name?: string;
}
interface FsPost {
  author_name?: string;
  author_role?: string;
  author_avatar?: string | null;
  type?: string;
  content?: string;
  metadata?: FsPostMeta | null;
  media_urls?: string[];
  comment_count?: number;
  likes?: string[];
  created_at?: string | { toDate?: () => Date };
}

function toIso(v: FsPost["created_at"]): string {
  if (!v) return new Date().toISOString();
  if (typeof v === "string") return v;
  if (typeof v.toDate === "function") return v.toDate().toISOString();
  return new Date().toISOString();
}

export async function getRecentPublicPosts(limitCount = 5): Promise<PublicPost[]> {
  try {
    const snap = await adminDb
      .collection("posts")
      .orderBy("created_at", "desc")
      .limit(limitCount)
      .get();
    return snap.docs.map((d) => {
      const x = d.data() as FsPost;
      const m = x.metadata;
      return {
        id: d.id,
        authorName: x.author_name ?? "",
        authorRole: x.author_role ?? "",
        authorAvatar: x.author_avatar ?? null,
        type: x.type ?? "text",
        content: x.content ?? "",
        metadata: m
          ? {
              homeTeam: m.home_team,
              awayTeam: m.away_team,
              scoreHome: m.score_home,
              scoreAway: m.score_away,
              teamName: m.team_name,
            }
          : null,
        mediaUrls: x.media_urls ?? [],
        commentCount: x.comment_count ?? 0,
        likesCount: Array.isArray(x.likes) ? x.likes.length : 0,
        createdAt: toIso(x.created_at),
      };
    });
  } catch (err) {
    console.error("getRecentPublicPosts failed:", err);
    return [];
  }
}
