"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="bg-[#F5F5F0] py-16 lg:py-24 px-6 lg:px-16">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-[40px] mx-auto max-w-6xl"
      >
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900 to-black" />

        {/* Decorative radials */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_30%,rgba(59,130,246,0.15),transparent_50%)]" />

        {/* Floating shapes */}
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 6, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[15%] left-[8%] w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20"
        />
        <motion.div
          animate={{ y: [0, 10, 0], rotate: [0, -8, 0] }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
          className="absolute bottom-[20%] right-[10%] w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
        />
        <motion.div
          animate={{ y: [0, -8, 0], x: [0, 5, 0] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
          className="absolute top-[60%] left-[75%] w-8 h-8 rounded-xl bg-white/8 backdrop-blur-sm border border-white/15 rotate-12"
        />

        {/* Content */}
        <div className="relative z-10 px-8 py-20 sm:px-12 sm:py-24 lg:px-20 lg:py-32 text-center">
          <h2 className="text-3xl font-black text-white font-display sm:text-4xl lg:text-6xl tracking-tight uppercase">
            Prêt à entrer
            <br />
            sur le terrain ?
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg text-white/80 leading-relaxed">
            Rejoins des milliers de passionnés et commence à jouer dès
            aujourd&apos;hui. C&apos;est gratuit.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/signup"
              className="flex items-center gap-2 rounded-full bg-white px-10 py-4.5 text-base font-bold text-[#1A1715] transition-all hover:shadow-2xl hover:shadow-white/20 hover:scale-[1.03] active:scale-[0.97]"
            >
              Créer mon compte gratuitement
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="rounded-full border-2 border-white/30 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-white/10 hover:border-white/50"
            >
              Déjà inscrit ? Se connecter
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
