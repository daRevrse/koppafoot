"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  Heart,
  MessageCircle,
  Share2,
  Trophy,
  UserPlus,
  Shield,
  Clock,
  ThumbsUp,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/* ──────────────────────────────────────
   Mock feed posts — preview only
   ────────────────────────────────────── */
const MOCK_POSTS = [
  {
    id: 1,
    authorName: "Mamadou K.",
    authorRole: "Manager",
    initials: "MK",
    avatarColor: "bg-emerald-500",
    type: "match_result" as const,
    content: "Victoire 3-1 face aux Panthères ! 🔥 Très belle performance collective, on continue comme ça les gars 💪",
    metadata: { homeTeam: "FC Émeraude", awayTeam: "Les Panthères", scoreHome: 3, scoreAway: 1 },
    time: "Il y a 2h",
    likes: 24,
    comments: 8,
    isLiked: true,
  },
  {
    id: 2,
    authorName: "Awa D.",
    authorRole: "Joueur",
    initials: "AD",
    avatarColor: "bg-purple-500",
    type: "text" as const,
    content: "Qui est dispo pour un 5v5 ce samedi à Terrain Plus Lomé ? ⚽ On cherche 3 joueurs, tous niveaux acceptés !",
    time: "Il y a 4h",
    likes: 15,
    comments: 12,
    isLiked: false,
  },
  {
    id: 3,
    authorName: "Kofi A.",
    authorRole: "Manager",
    initials: "KA",
    avatarColor: "bg-blue-500",
    type: "team_announcement" as const,
    content: "Les Aigles de Kégué recrutent ! 🦅 On recherche un gardien et deux milieux de terrain pour la saison. Entraînements les mardis et jeudis soirs.",
    metadata: { teamName: "Aigles de Kégué" },
    time: "Il y a 6h",
    likes: 31,
    comments: 19,
    isLiked: false,
  },
];

const TYPE_BADGES = {
  match_result: { label: "Résultat", Icon: Trophy, color: "bg-emerald-100 text-emerald-700" },
  team_announcement: { label: "Recrutement", Icon: UserPlus, color: "bg-blue-100 text-blue-700" },
  highlight: { label: "Performance", Icon: ThumbsUp, color: "bg-amber-100 text-amber-700" },
  text: null,
};

/* ──────────────────────────────────────
   Mini post card (static preview)
   ────────────────────────────────────── */
function PreviewCard({
  post,
  index,
}: {
  post: (typeof MOCK_POSTS)[number];
  index: number;
}) {
  const badge = TYPE_BADGES[post.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.5,
        delay: 0.15 + index * 0.12,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-sm p-5 transition-all duration-500 hover:bg-white/[0.07] hover:border-white/[0.14]"
    >
      {/* Author row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${post.avatarColor}`}
          >
            {post.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">
                {post.authorName}
              </span>
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">
                {post.authorRole}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-white/30 mt-0.5">
              <Clock size={10} />
              {post.time}
            </div>
          </div>
        </div>
      </div>

      {/* Badge */}
      {badge && (
        <div className="mb-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.color}`}
          >
            <badge.Icon size={10} />
            {badge.label}
          </span>
        </div>
      )}

      {/* Content */}
      <p className="text-sm text-white/70 leading-relaxed mb-3">
        {post.content}
      </p>

      {/* Match result card */}
      {post.type === "match_result" && post.metadata && (
        <div className="rounded-xl bg-white/[0.06] p-3 mb-3">
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-emerald-400" />
              <span className="text-xs font-bold text-white">
                {post.metadata.homeTeam}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1">
              <span className="text-base font-black text-white font-display">
                {post.metadata.scoreHome}
              </span>
              <span className="text-[10px] text-white/40">-</span>
              <span className="text-base font-black text-white font-display">
                {post.metadata.scoreAway}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                {post.metadata.awayTeam}
              </span>
              <Shield size={14} className="text-white/30" />
            </div>
          </div>
        </div>
      )}

      {/* Team announcement card */}
      {post.type === "team_announcement" && post.metadata && (
        <div className="flex items-center gap-3 rounded-xl bg-blue-500/10 p-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/20">
            <Shield size={16} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              {post.metadata.teamName}
            </p>
            <p className="text-[10px] text-blue-400">Recherche de joueurs</p>
          </div>
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-1 pt-3 border-t border-white/[0.06]">
        <div
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium ${
            post.isLiked ? "text-red-400" : "text-white/30"
          }`}
        >
          <Heart
            size={13}
            className={post.isLiked ? "fill-red-400" : ""}
          />
          {post.likes}
        </div>
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white/30">
          <MessageCircle size={13} />
          {post.comments}
        </div>
        <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-white/30">
          <Share2 size={13} />
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────
   Main section
   ────────────────────────────────────── */
export default function StatsSection() {
  return (
    <section className="bg-[#1A1715] py-28 lg:py-36 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-5 py-1.5 text-xs font-bold text-white/60 uppercase tracking-widest mb-6">
            <Sparkles size={12} className="text-emerald-400" />
            La Tribune
          </span>
          <h2 className="text-4xl font-black text-white font-display sm:text-5xl lg:text-7xl tracking-tight">
            Vis le football
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              en temps réel
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-white/45 leading-relaxed">
            Résultats de matchs, recrutements, discussions entre passionnés…
            <br className="hidden sm:block" />
            Le feed KOPPAFOOT, c&apos;est ta communauté football, en direct.
          </p>
        </motion.div>

        {/* ── Feed preview grid ── */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {MOCK_POSTS.map((post, i) => (
            <PreviewCard key={post.id} post={post} index={i} />
          ))}
        </div>

        {/* ── CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-8 py-4 text-sm font-bold text-white transition-all hover:shadow-2xl hover:shadow-emerald-500/20 hover:scale-[1.03] active:scale-[0.97]"
          >
            Rejoins La Tribune
            <ArrowRight
              size={16}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
          <p className="mt-4 text-xs text-white/25">
            Inscris-toi gratuitement et rejoins la conversation
          </p>
        </motion.div>
      </div>
    </section>
  );
}
