"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Trophy, Users, MapPin } from "lucide-react";

const FEATURES = [
  { icon: Users, text: "Rejoins des équipes et trouve des joueurs" },
  { icon: Trophy, text: "Organise et participe à des matchs" },
  { icon: MapPin, text: "Réserve des terrains près de chez toi" },
];

export default function BrandingPanel() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#1A1715]">
      {/* Stadium background */}
      <Image
        src="/branding/hero_stadium.png"
        alt=""
        fill
        className="object-cover opacity-30"
        sizes="50vw"
        priority
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1A1715] via-[#1A1715]/70 to-emerald-950/90" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center px-12 text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative h-12 w-48"
        >
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            fill
            className="object-contain"
            sizes="192px"
            priority
          />
        </motion.div>

        {/* Tagline */}
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-8 text-2xl font-black text-white font-display lg:text-3xl tracking-tight"
        >
          Le foot amateur,
          <br />
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            en mieux.
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-4 max-w-xs text-sm text-white/40 leading-relaxed"
        >
          La plateforme qui connecte les passionnés de football amateur.
        </motion.p>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10 space-y-3"
        >
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3 rounded-xl bg-white/[0.05] border border-white/[0.08] px-5 py-3 backdrop-blur-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <Icon size={14} className="text-emerald-400" />
                </div>
                <span className="text-sm text-white/60">{f.text}</span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Testimonial */}
      {/* <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="absolute bottom-10 left-10 right-10 z-10"
      >
        <div className="rounded-2xl bg-white/[0.05] border border-white/[0.08] backdrop-blur-sm p-5">
          <p className="text-sm leading-relaxed text-white/50 italic">
            &ldquo;J&apos;ai trouvé mon équipe en moins d&apos;une semaine.
            KOPPAFOOT a changé ma façon de jouer au foot.&rdquo;
          </p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white">
              KB
            </div>
            <div>
              <p className="text-xs font-semibold text-white/70">Karim B.</p>
              <p className="text-[10px] text-white/30">Joueur — Lomé</p>
            </div>
          </div>
        </div>
      </motion.div> */}
    </div>
  );
}
