"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Trophy } from "lucide-react";
import CompetitionDirectoryCard from "@/components/competition/CompetitionDirectoryCard";
import type { Competition } from "@/types";

// ============================================
// CompetitionsTeaser
// ============================================
// Bridges the hero into the directory. Receives the PLAIN Competition[] from the
// page Server Component (fetched via @/lib/competition-admin) — this client
// component never imports the server-only admin lib.
//
//  - <= 1 competition → a slim band (the hero already spotlights the only one;
//    avoid duplicating it). Just a heading + a link to the full directory.
//  - else → "À la une" + up to 3 reused CompetitionDirectoryCards + a link to
//    the full directory.

export default function CompetitionsTeaser({
  competitions,
}: {
  competitions: Competition[];
}) {
  // Slim band: nothing more to tease beyond the hero's competition.
  if (competitions.length <= 1) {
    return (
      <section className="bg-gray-50 px-6 py-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 rounded-[2.5rem] border border-gray-100 bg-white px-8 py-12 text-center shadow-sm sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
              <Trophy size={24} />
            </div>
            <div>
              <h2 className="font-display text-xl font-black tracking-tight text-gray-900">
                Découvre toutes les compétitions
              </h2>
              <p className="mt-1 text-sm font-bold text-gray-400">
                Le football amateur en direct sur Koppafoot.
              </p>
            </div>
          </div>
          <Link
            href="/competitions"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            Explorer
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    );
  }

  // Featured row: first three competitions as reused directory tiles.
  const featured = competitions.slice(0, 3);

  return (
    <section className="bg-gray-50 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-black tracking-tight text-gray-900">
              À la une
            </h2>
            <p className="mt-1 text-sm font-bold text-gray-400">
              Les compétitions à suivre en direct.
            </p>
          </div>
          <Link
            href="/competitions"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-black text-emerald-600 transition-colors hover:text-emerald-700 sm:inline-flex"
          >
            Voir toutes les compétitions
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((competition, i) => (
            <motion.div
              key={competition.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              <CompetitionDirectoryCard competition={competition} />
            </motion.div>
          ))}
        </div>

        {/* Mobile-only full-directory link (the header one is sm+). */}
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/competitions"
            className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-600 transition-colors hover:text-emerald-700"
          >
            Voir toutes les compétitions
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
