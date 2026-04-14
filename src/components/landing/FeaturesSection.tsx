"use client";

import { motion } from "motion/react";
import { Calendar, UserPlus, Hash } from "lucide-react";

const FEATURES = [
  {
    icon: Calendar,
    title: "Calendrier intelligent",
    description:
      "Planifie tes matchs, gère tes disponibilités et ne rate plus jamais un rendez-vous sur le terrain. Tout est synchronisé en temps réel.",
  },
  {
    icon: UserPlus,
    title: "Recrutement & invitations",
    description:
      "Invite des joueurs, envoie des propositions et construis l'équipe de tes rêves. Le système d'invitations te facilite la tâche.",
  },
  {
    icon: Hash,
    title: "Le Terrain — ton fil d'actu",
    description:
      "Partage tes résultats, commente les matchs et suis l'actualité de ta communauté football. Le Terrain, c'est ton réseau social dédié.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="bg-gray-50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 font-display sm:text-4xl">
            Tout ce qu&apos;il te faut, au même endroit
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Des outils pensés pour simplifier ton football au quotidien.
          </p>
        </motion.div>

        <div className="mt-16 space-y-20">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            const isReversed = i % 2 !== 0;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
                className={`flex flex-col items-center gap-12 lg:flex-row ${isReversed ? "lg:flex-row-reverse" : ""}`}
              >
                {/* Text */}
                <div className="flex-1">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100">
                    <Icon size={24} className="text-primary-600" />
                  </div>
                  <h3 className="mt-4 text-2xl font-bold text-gray-900 font-display">{feature.title}</h3>
                  <p className="mt-3 text-gray-500 leading-relaxed">{feature.description}</p>
                </div>
                {/* Placeholder visual */}
                <div className="flex-1">
                  <div className="aspect-video rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                    <Icon size={48} className="text-gray-200" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
