"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Stadium background image */}
      <Image
        src="/branding/hero_stadium.png"
        alt="Football stadium atmosphere"
        fill
        className="object-cover"
        priority
        sizes="100vw"
      />

      {/* Gradient overlay: white at top, green at bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-white/90 to-emerald-600/85" />

      {/* Extra subtle fade for readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-transparent" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-40 text-center">
        {/* Massive heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-5xl font-black leading-[0.95] tracking-tight text-[#1A1715] font-display sm:text-7xl md:text-8xl lg:text-9xl uppercase"
        >
          Le foot{" "}
          <br className="hidden sm:block" />
          amateur{" "}
          <br className="hidden sm:block" />
          <span className="text-white drop-shadow-lg">en mieux.</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-8 max-w-xl text-lg text-[#1A1715]/80 font-medium leading-relaxed sm:text-xl"
        >
          KOPPAFOOT connecte les acteurs du football amateur.
          <br className="hidden sm:block" />
          Crée ton équipe, trouve des matchs, élargit ton réseau.
        </motion.p>

        {/* CTA — Pill-shaped, solid, no gradient */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12"
        >
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-[#1A1715] px-10 py-4.5 text-base font-bold text-white transition-all hover:shadow-2xl hover:shadow-[#1A1715]/20 hover:scale-[1.03] active:scale-[0.97]"
          >
            Rejoindre KOPPAFOOT
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown size={28} className="text-white/70" />
        </motion.div>
      </motion.div>
    </section>
  );
}
