"use client";

import { motion } from "motion/react";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote: "Grâce à KOPPAFOOT, j'ai trouvé une équipe en moins d'une semaine. Les matchs s'enchaînent, c'est génial !",
    name: "Karim B.",
    role: "Joueur",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    quote: "En tant que manager, je peux gérer mes joueurs, planifier les matchs et recruter facilement. Un vrai gain de temps.",
    name: "Sophie M.",
    role: "Manager",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    quote: "La plateforme m'a permis de tripler mes réservations en quelques mois. L'interface pro est vraiment bien pensée.",
    name: "David L.",
    role: "Propriétaire de terrain",
    badge: "bg-orange-100 text-orange-700",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="bg-primary-50/50 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h2 className="text-3xl font-bold text-gray-900 font-display sm:text-4xl">
            Ils utilisent KOPPAFOOT
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-gray-500">
            Découvre ce que nos utilisateurs en pensent.
          </p>
        </motion.div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="rounded-xl bg-white p-6 shadow-sm"
            >
              <Quote size={24} className="text-primary-200" />
              <p className="mt-4 text-sm leading-relaxed text-gray-600">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                  {testimonial.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{testimonial.name}</p>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${testimonial.badge}`}>
                    {testimonial.role}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
