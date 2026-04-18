"use client";

import Image from "next/image";
import { motion } from "motion/react";

const ROLES = [
  {
    image: "/branding/role_joueur.png",
    title: "Joueur",
    subtitle: "Trouve ta place sur le terrain",
    description:
      "Rejoins des matchs près de chez toi, intègre une équipe et progresse à chaque rencontre. Le football comme tu l'aimes, accessible et sans prise de tête.",
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    image: "/branding/role_manager.png",
    title: "Manager",
    subtitle: "Construis l'équipe idéale",
    description:
      "Crée ton équipe, recrute les meilleurs talents de ta ville, organise tes matchs et pilote ta formation. Tout est centralisé, de la tactique à la logistique.",
    gradient: "from-blue-400 to-indigo-500",
  },
  {
    image: "/branding/role_arbitre.png",
    title: "Arbitre",
    subtitle: "Fais respecter les règles",
    description:
      "Gère ton planning d'arbitrage, accepte des missions match par match et rédige tes rapports directement dans l'app. Simple, rapide, professionnel.",
    gradient: "from-violet-400 to-purple-500",
  },
  {
    image: "/branding/role_proprietaire.png",
    title: "Propriétaire de terrain",
    subtitle: "Remplis tes créneaux",
    description:
      "Propose ton terrain aux joueurs et managers de ta zone. Gère tes réservations, ta visibilité et tes revenus depuis un tableau de bord dédié.",
    gradient: "from-amber-400 to-orange-500",
  },
];

export default function RolesSection() {
  return (
    <section id="roles" className="bg-[#F5F5F0] py-32 lg:py-40">
      <div className="mx-auto max-w-[1600px] px-6 lg:px-12">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-20"
        >
          <span className="inline-block rounded-full bg-[#1A1715] px-5 py-1.5 text-xs font-bold text-white uppercase tracking-widest mb-6">
            Pour tout le monde
          </span>
          <h2 className="text-4xl font-black text-[#1A1715] font-display sm:text-5xl lg:text-6xl tracking-tight">
            Un espace pour chaque
            <br />
            passionné
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#1A1715]/50 leading-relaxed">
            Que tu sois joueur, manager, arbitre ou propriétaire de terrain,
            KOPPAFOOT a été conçu pour toi.
          </p>
        </motion.div>

        {/* Roles — one per row with large portrait image */}
        <div className="space-y-16 lg:space-y-24 mb-12">
          {ROLES.map((role, i) => {
            const isReversed = i % 2 !== 0;
            return (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.7,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={`flex flex-col items-stretch gap-8 lg:gap-0 ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"
                  }`}
              >
                {/* Portrait image — large */}
                <div className="relative w-full lg:w-[55%] lg:flex-shrink-0">
                  <div className="relative h-[500px] sm:h-[700px] lg:h-[780px] overflow-hidden rounded-[32px] lg:rounded-[40px] shadow-2xl">
                    <Image
                      src={role.image}
                      alt={role.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 55vw"
                      priority={i < 2}
                    />
                    {/* Gradient overlay at bottom */}
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                </div>

                {/* Text content — vertically centered */}
                <div className="flex-1 flex flex-col justify-center text-center lg:text-left px-2 lg:px-14">
                  <span
                    className={`inline-block self-center lg:self-start rounded-full bg-gradient-to-r ${role.gradient} px-5 py-2 text-xs font-bold text-white uppercase tracking-wider mb-5`}
                  >
                    {role.title}
                  </span>
                  <h3 className="text-3xl font-black text-[#1A1715] font-display sm:text-4xl lg:text-5xl tracking-tight leading-[1.1]">
                    {role.subtitle}
                  </h3>
                  <p className="mt-6 text-base sm:text-lg text-[#1A1715]/50 leading-relaxed max-w-xl">
                    {role.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
