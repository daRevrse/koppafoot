"use client";

import { motion } from "motion/react";
import { Star } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Grâce à KOPPAFOOT, j'ai trouvé une équipe en moins d'une semaine. Les matchs s'enchaînent, c'est génial !",
    name: "Karim B.",
    role: "Joueur",
    stars: 5,
    gradient: "from-emerald-400 to-teal-500",
  },
  {
    quote:
      "En tant que manager, je peux gérer mes joueurs, planifier les matchs et recruter facilement. Un vrai gain de temps.",
    name: "Sophie M.",
    role: "Manager",
    stars: 5,
    gradient: "from-blue-400 to-indigo-500",
  },
  {
    quote:
      "La plateforme m'a permis de tripler mes réservations en quelques mois. L'interface pro est vraiment bien pensée.",
    name: "David L.",
    role: "Propriétaire de terrain",
    stars: 5,
    gradient: "from-amber-400 to-orange-500",
  },
];

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="bg-[#F5F5F0] py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <span className="inline-block rounded-full bg-[#1A1715] px-5 py-1.5 text-xs font-bold text-white uppercase tracking-widest mb-6">
            Témoignages
          </span>
          <h2 className="text-4xl font-black text-[#1A1715] font-display sm:text-5xl lg:text-6xl tracking-tight">
            Ils utilisent
            <br />
            KOPPAFOOT
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-[#1A1715]/50 leading-relaxed">
            Découvre ce que nos utilisateurs en pensent.
          </p>
        </motion.div>

        {/* Testimonials grid  */}
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {TESTIMONIALS.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group rounded-[28px] bg-white p-8 transition-all duration-500 hover:shadow-2xl hover:-translate-y-1"
            >
              {/* Stars */}
              <div className="flex gap-1">
                {Array.from({ length: testimonial.stars }).map((_, j) => (
                  <Star
                    key={j}
                    size={16}
                    className="fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Quote */}
              <p className="mt-6 text-base leading-relaxed text-[#1A1715]/70">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-8 flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${testimonial.gradient} text-sm font-bold text-white`}
                >
                  {testimonial.name[0]}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1A1715]">
                    {testimonial.name}
                  </p>
                  <p className="text-xs text-[#1A1715]/40 font-medium">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
