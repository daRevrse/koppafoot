"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { Eye, BarChart3, MapPin } from "lucide-react";

const FAN_FEATURES = [
  {
    image: "/branding/fan_matchs.png",
    icon: Eye,
    title: "Suis les matchs en direct",
    description:
      "Même sans jouer, tu peux suivre les rencontres près de chez toi. Consulte les scores en temps réel, découvre les équipes de ta ville et vis chaque match comme si tu y étais.",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    image: "/branding/fan_scores.png",
    icon: BarChart3,
    title: "Explore les classements",
    description:
      "Découvre les meilleurs joueurs, les équipes qui montent et les statistiques de ta communauté. Toute l'actualité du football amateur à portée de main.",
    gradient: "from-blue-400 to-violet-500",
  },
  {
    image: "/branding/fan_terrain.png",
    icon: MapPin,
    title: "Trouve un terrain",
    description:
      "Parcours la carte des terrains disponibles autour de toi. Consulte les créneaux, les tarifs et les avis — même sans compte, tu peux explorer.",
    gradient: "from-amber-400 to-orange-500",
  },
];

export default function FanSection() {
  return (
    <section id="fans" className="bg-[#F5F5F0] py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <span className="inline-block rounded-full bg-[#1A1715] px-5 py-1.5 text-xs font-bold text-white uppercase tracking-widest mb-6">
            Fans & Supporters
          </span>
          <h2 className="text-4xl font-black text-[#1A1715] font-display sm:text-5xl lg:text-6xl tracking-tight">
            Pas besoin de jouer
            <br />
            pour vibrer
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#1A1715]/50 leading-relaxed">
            KOPPAFOOT, c&apos;est aussi pour les supporters. Découvre
            tout ce que tu peux faire sans avoir de rôle sur la plateforme.
          </p>
        </motion.div>

        {/* Fan features — large portrait cards in a row */}
        <div className="grid gap-6 sm:grid-cols-3">
          {FAN_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.12,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="group"
              >
                {/* Large portrait image */}
                <div className="relative aspect-[3/4] overflow-hidden rounded-[32px] shadow-xl mb-6">
                  <Image
                    src={feature.image}
                    alt={feature.title}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                  {/* Icon badge */}
                  <div
                    className={`absolute top-5 left-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
                  >
                    <Icon size={22} />
                  </div>
                  {/* Text overlay at bottom */}
                  <div className="absolute inset-x-0 bottom-0 p-6">
                    <h3 className="text-xl font-bold text-white font-display sm:text-2xl">
                      {feature.title}
                    </h3>
                  </div>
                </div>

                {/* Description below */}
                <p className="text-sm text-[#1A1715]/50 leading-relaxed px-1">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
