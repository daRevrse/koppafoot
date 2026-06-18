"use client";

import { motion } from "motion/react";
import { Trophy } from "lucide-react";
import type { FootballCompetition } from "@/lib/football-data";

// ============================================
// FeaturedFootballCompetitions
// ============================================
// A row of curated real competitions (Champions League, PL, …). Receives a
// PLAIN FootballCompetition[] from the page Server Component (page.tsx fetches
// via @/lib/football-data) — never imports the server-only lib.
//
// Emblems are arbitrary provider URLs → plain <img>. Renders nothing when empty.

const EASE = [0.22, 1, 0.36, 1] as const;

export default function FeaturedFootballCompetitions({
  competitions,
}: {
  competitions: FootballCompetition[];
}) {
  if (competitions.length === 0) return null;

  return (
    <section className="bg-gray-950 px-6 pb-20">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-8 font-display text-2xl font-black tracking-tight text-white"
        >
          Grandes compétitions
        </motion.h2>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {competitions.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center">
                {c.emblem ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.emblem}
                    alt={c.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Trophy size={28} className="text-emerald-400" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{c.name}</p>
                {c.area && (
                  <p className="truncate text-xs font-bold text-white/40">
                    {c.area}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
