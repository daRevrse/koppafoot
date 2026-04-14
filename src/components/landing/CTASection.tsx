"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="bg-emerald-900 py-24 pitch-pattern">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-3xl font-bold text-white font-display sm:text-4xl"
        >
          Prêt à entrer sur le terrain ?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mx-auto mt-4 max-w-xl text-emerald-200/80"
        >
          Rejoins des milliers de passionnés et commence à jouer dès aujourd&apos;hui. C&apos;est gratuit.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/signup"
            className="flex items-center gap-2 rounded-xl bg-accent-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-accent-600 transition-colors"
          >
            Créer mon compte gratuitement
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-emerald-300 hover:text-white transition-colors"
          >
            Déjà inscrit ? Se connecter
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
