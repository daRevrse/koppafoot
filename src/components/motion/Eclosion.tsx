"use client";

import { motion } from "motion/react";

/**
 * L'icône d'un moment rare : la candidature vient de partir.
 *
 * Un léger rebond, permis ici seulement : on ne le voit qu'une fois, juste
 * après l'envoi. Quand on revient voir une candidature déjà en attente,
 * `actif` est faux et l'icône est simplement là, sans spectacle.
 *
 * Le ressort est celui d'Apple (durée 0,5 s, rebond 0,2), et la transformation
 * est écrite en entier : les raccourcis `scale` de motion ne passent pas par
 * l'accélération matérielle. « Réduire les animations » est respecté par
 * MotionConfig (components/motion/PreferencesMouvement).
 */
export default function Eclosion({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  if (!actif) return <>{children}</>;
  return (
    <motion.div
      initial={{ opacity: 0, transform: "scale(0.9)" }}
      animate={{ opacity: 1, transform: "scale(1)" }}
      transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
    >
      {children}
    </motion.div>
  );
}
