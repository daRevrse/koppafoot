"use client";

import { motion } from "motion/react";
import { Users, Shield, Award, MapPin } from "lucide-react";

const ROLES = [
  {
    icon: Users,
    title: "Joueur",
    description: "Trouve des matchs, rejoins une équipe et progresse sur le terrain.",
    color: "border-emerald-500",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
  {
    icon: Shield,
    title: "Manager",
    description: "Crée ton équipe, organise des matchs et recrute les meilleurs talents.",
    color: "border-blue-500",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: Award,
    title: "Arbitre",
    description: "Arbitre des matchs, rédige tes rapports et gère ton planning.",
    color: "border-purple-500",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
  },
  {
    icon: MapPin,
    title: "Propriétaire de terrain",
    description: "Propose ton terrain, gère tes réservations et augmente ta visibilité.",
    color: "border-orange-500",
    iconBg: "bg-orange-50",
    iconColor: "text-orange-600",
  },
];

export default function RolesSection() {
  return (
    <section id="roles" className="bg-white py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 font-display sm:text-4xl">
            Un espace pour chaque passionné
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Que tu sois joueur, manager, arbitre ou propriétaire de terrain, KOPPAFOOT a été conçu pour toi.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((role, i) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className={`rounded-xl border-t-4 ${role.color} bg-white p-6 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${role.iconBg}`}>
                  <Icon size={24} className={role.iconColor} />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900 font-display">{role.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{role.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
