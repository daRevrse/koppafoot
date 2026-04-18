"use client";

import { motion } from "motion/react";
import { Calendar, UserPlus, Hash, Zap, Trophy, Bell } from "lucide-react";

const FEATURES = [
  {
    icon: Calendar,
    badge: "Organisation",
    title: "Calendrier intelligent",
    description:
      "Planifie tes matchs, gère tes disponibilités et ne rate plus jamais un rendez-vous sur le terrain. Tout est synchronisé en temps réel.",
    gradient: "from-emerald-400 to-cyan-500",
    bgGradient: "from-emerald-50 to-cyan-50",
  },
  {
    icon: UserPlus,
    badge: "Recrutement",
    title: "Invitations & équipes",
    description:
      "Invite des joueurs, envoie des propositions et construis l'équipe de tes rêves. Le système d'invitations te facilite la tâche.",
    gradient: "from-blue-400 to-violet-500",
    bgGradient: "from-blue-50 to-violet-50",
  },
  {
    icon: Hash,
    badge: "Communauté",
    title: "Le Terrain — ton fil d'actu",
    description:
      "Partage tes résultats, commente les matchs et suis l'actualité de ta communauté football. Le Terrain, c'est ton réseau social dédié.",
    gradient: "from-amber-400 to-orange-500",
    bgGradient: "from-amber-50 to-orange-50",
  },
  {
    icon: Zap,
    badge: "Performance",
    title: "Stats en temps réel",
    description:
      "Suis tes performances, analyse tes statistiques et progresse match après match grâce à un tableau de bord complet.",
    gradient: "from-rose-400 to-pink-500",
    bgGradient: "from-rose-50 to-pink-50",
  },
  {
    icon: Trophy,
    badge: "Compétition",
    title: "Tournois & classements",
    description:
      "Participe à des tournois organisés dans ta ville, grimpe dans les classements et fais briller ton équipe.",
    gradient: "from-teal-400 to-emerald-500",
    bgGradient: "from-teal-50 to-emerald-50",
  },
  {
    icon: Bell,
    badge: "Notifications",
    title: "Alertes instantanées",
    description:
      "Reçois des notifications pour les matchs à venir, les invitations et les résultats. Ne rate plus rien.",
    gradient: "from-indigo-400 to-blue-500",
    bgGradient: "from-indigo-50 to-blue-50",
  },
];

export default function FeaturesSection() {
  return (
    <section id="features" className="bg-[#1A1715] py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <span className="inline-block rounded-full border border-white/20 px-5 py-1.5 text-xs font-bold text-white/70 uppercase tracking-widest mb-6">
            Fonctionnalités
          </span>
          <h2 className="text-4xl font-black text-white font-display sm:text-5xl lg:text-6xl tracking-tight">
            Tout ce qu&apos;il te faut,
            <br />
            au même endroit
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/50 leading-relaxed">
            Des outils pensés pour simplifier ton football au quotidien.
          </p>
        </motion.div>

        {/* Features grid — large rounded cards */}
        <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group relative overflow-hidden rounded-[32px] bg-white/[0.06] backdrop-blur-sm border border-white/[0.08] p-8 transition-all duration-500 hover:bg-white/[0.1] hover:border-white/[0.15]"
              >
                {/* Badge */}
                <span
                  className={`inline-block rounded-full bg-gradient-to-r ${feature.gradient} px-4 py-1 text-xs font-bold text-white uppercase tracking-wider`}
                >
                  {feature.badge}
                </span>

                <h3 className="mt-6 text-xl font-bold text-white font-display">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm text-white/40 leading-relaxed">
                  {feature.description}
                </p>

                {/* Icon decorative in background */}
                <div className="absolute -bottom-4 -right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500">
                  <Icon size={120} className="text-white" strokeWidth={1} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
