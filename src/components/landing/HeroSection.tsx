"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-emerald-950 pitch-pattern overflow-hidden">
      {/* Diagonal decorative element */}
      <div className="absolute -right-20 -top-20 h-80 w-80 rotate-45 bg-primary-900/30" />
      <div className="absolute -left-10 bottom-20 h-40 w-40 rotate-12 bg-primary-800/20" />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-32 text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 flex justify-center"
        >
          <Image
            src="/branding/logo_symbol.png"
            alt=""
            width={72}
            height={72}
            className="brightness-0 invert"
          />
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl font-extrabold leading-tight text-white font-display sm:text-5xl md:text-6xl"
        >
          Rejoins le plus grand{" "}
          <span className="text-accent-400">réseau football</span>{" "}
          amateur
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-emerald-200/80"
        >
          Trouve des matchs, crée ton équipe, réserve un terrain.
          KOPPAFOOT connecte tous les passionnés de football.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-accent-600 transition-colors"
          >
            Créer un compte
            <ArrowRight size={18} />
          </Link>
          <a
            href="#roles"
            className="flex items-center gap-2 rounded-xl border-2 border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors"
          >
            Découvrir
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <ChevronDown size={24} className="text-white/40" />
        </motion.div>
      </motion.div>
    </section>
  );
}
