"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, User, Users, Repeat, CalendarCheck } from "lucide-react";

// ============================================
// PlatformPromo
// ============================================
// Light acquisition band. Condenses the Roles/Features pitch into a few concise
// value props + a join CTA. Pure presentational — always renders (it's the
// acquisition pitch, not real-data driven).

const EASE = [0.22, 1, 0.36, 1] as const;

const PROPS = [
  {
    icon: User,
    title: "Profil joueur",
    description: "Construis ton profil, suis tes stats et progresse match après match.",
  },
  {
    icon: Users,
    title: "Équipes",
    description: "Crée ton équipe, recrute des joueurs et pilote ta formation.",
  },
  {
    icon: Repeat,
    title: "Mercato",
    description: "Trouve des coéquipiers, reçois des propositions, change de club.",
  },
  {
    icon: CalendarCheck,
    title: "Matchs",
    description: "Organise tes rencontres, gère tes dispos et trouve des adversaires.",
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
            Koppafoot, c&apos;est aussi…
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-[#1A1715]/50 leading-relaxed">
            Bien plus que des scores : la plateforme du football amateur, de ton
            profil jusqu&apos;à ton prochain match.
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

        <div className="mt-12 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#1A1715] px-9 py-4 text-base font-bold text-white transition-all hover:scale-[1.03] hover:shadow-2xl hover:shadow-[#1A1715]/20 active:scale-[0.97]"
          >
            Rejoindre Koppafoot
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
