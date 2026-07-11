"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, Radio, BarChart3, Bell, ClipboardList } from "lucide-react";

// ============================================
// PlatformPromo
// ============================================
// Light acquisition band. Competition-first value props + a join CTA.
// Pure presentational — always renders (it's the acquisition pitch,
// not real-data driven).

const EASE = [0.22, 1, 0.36, 1] as const;

const PROPS = [
  {
    icon: Radio,
    title: "Scores en direct",
    description: "Chaque but, chaque carton, minute par minute, depuis le bord du terrain.",
  },
  {
    icon: BarChart3,
    title: "Classements auto",
    description: "Poules, classements et buteurs mis à jour après chaque match.",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Suis ta compétition et reçois coups d'envoi, buts et résultats.",
  },
  {
    icon: ClipboardList,
    title: "Organise la tienne",
    description: "Crée ta compétition, importe les équipes, délègue le live à ton staff.",
  },
];

export default function PlatformPromo() {
  return (
    <section className="bg-[#F5F5F0] px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="text-center"
        >
          <h2 className="font-display text-3xl font-black tracking-tight text-[#1A1715] sm:text-4xl">
            Le direct du football amateur
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#1A1715]/50 leading-relaxed">
            De la phase de poules à la finale : suis, partage et organise
            tes compétitions sur Koppafoot.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROPS.map((p, i) => {
            const Icon = p.icon;
            return (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: EASE }}
                className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 font-display text-lg font-black text-[#1A1715]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#1A1715]/50">
                  {p.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#1A1715] px-9 py-4 text-base font-bold text-white transition-all hover:scale-[1.03] hover:shadow-2xl hover:shadow-[#1A1715]/20 active:scale-[0.97]"
          >
            Rejoindre Koppafoot
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/organizer"
            className="inline-flex items-center gap-2 rounded-full border border-[#1A1715]/15 px-9 py-4 text-base font-bold text-[#1A1715] transition-all hover:bg-[#1A1715]/5 active:scale-[0.97]"
          >
            Organiser une compétition
          </Link>
        </div>
      </div>
    </section>
  );
}
