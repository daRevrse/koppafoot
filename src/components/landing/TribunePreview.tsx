"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { PublicPost } from "@/lib/posts-admin";

// ============================================
// TribunePreview
// ============================================
// Preview of recent public feed posts. Receives a PLAIN PublicPost[] from the
// page Server Component (page.tsx fetches via @/lib/posts-admin) — never imports
// the server-only lib.
//
// Author avatars are arbitrary URLs → plain <img> (initials fallback).
// Renders nothing when there are no posts (graceful degradation).

const EASE = [0.22, 1, 0.36, 1] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ post }: { post: PublicPost }) {
  if (post.authorAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.authorAvatar}
        alt={post.authorName}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-black text-emerald-600">
      {initials(post.authorName)}
    </span>
  );
}

function ScoreLine({ post }: { post: PublicPost }) {
  const m = post.metadata;
  if (!m || m.scoreHome == null || m.scoreAway == null) return null;
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
      <span className="flex-1 truncate text-right text-sm font-bold text-gray-900">
        {m.homeTeam ?? "—"}
      </span>
      <span className="shrink-0 rounded-lg bg-gray-900 px-3 py-1 font-display text-sm font-black tabular-nums text-white">
        {m.scoreHome}
        <span className="mx-1 text-white/40">–</span>
        {m.scoreAway}
      </span>
      <span className="flex-1 truncate text-left text-sm font-bold text-gray-900">
        {m.awayTeam ?? "—"}
      </span>
    </div>
  );
}

export default function TribunePreview({ posts }: { posts: PublicPost[] }) {
  if (posts.length === 0) return null;

  return (
    <section className="bg-gray-50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-black tracking-tight text-gray-900">
              La Tribune
            </h2>
            <p className="mt-1 text-sm font-bold text-gray-400">
              Ce que la communauté partage en ce moment.
            </p>
          </div>
          <Link
            href="/feed"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-black text-emerald-600 transition-colors hover:text-emerald-700 sm:inline-flex"
          >
            Voir La Tribune
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, i) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
              className="flex flex-col rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Avatar post={post} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-gray-900">
                    {post.authorName || "Anonyme"}
                  </p>
                  {post.authorRole && (
                    <p className="truncate text-xs font-bold text-gray-400">
                      {post.authorRole}
                    </p>
                  )}
                </div>
              </div>

              {post.content && (
                <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-gray-600">
                  {post.content}
                </p>
              )}

              {post.type === "match_result" && <ScoreLine post={post} />}
            </motion.article>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/feed"
            className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-600 transition-colors hover:text-emerald-700"
          >
            Voir La Tribune
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
