"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Quote } from "lucide-react";

export default function BrandingPanel() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center bg-emerald-950 p-12 pitch-pattern overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute -right-16 -top-16 h-64 w-64 rotate-45 bg-primary-900/30" />
      <div className="absolute -left-8 bottom-32 h-32 w-32 rotate-12 bg-primary-800/20" />

      {/* Content */}
      <div className="relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Image
            src="/branding/logo_full_name.png"
            alt="KOPPAFOOT"
            width={200}
            height={52}
            className="mx-auto"
            priority
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mx-auto mt-6 max-w-xs text-emerald-200/70"
        >
          La plateforme qui connecte les passionnés de football amateur.
        </motion.p>
      </div>

      {/* Testimonial */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="absolute bottom-12 left-12 right-12 z-10"
      >
        <div className="rounded-xl bg-emerald-900/60 p-5">
          <Quote size={18} className="text-emerald-400/50" />
          <p className="mt-2 text-sm leading-relaxed text-emerald-200/70">
            &ldquo;J&apos;ai trouvé mon équipe en moins d&apos;une semaine. KOPPAFOOT a changé ma façon de jouer au foot.&rdquo;
          </p>
          <p className="mt-3 text-xs font-medium text-emerald-300">
            — Karim B., Joueur
          </p>
        </div>
      </motion.div>
    </div>
  );
}
