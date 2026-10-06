"use client";

import { MotionConfig } from "motion/react";

/**
 * « Réduire les animations », respecté par motion/react aussi.
 *
 * Les animations écrites avec motion (apparition des formulaires
 * d'authentification, onglets, toasts maison) jouaient malgré le réglage du
 * système : la bibliothèque ne le lit que si on le lui demande. Avec
 * `reducedMotion="user"`, elle garde les fondus et retire les déplacements,
 * comme le bloc « Mouvement » de globals.css le fait pour le CSS.
 */
export default function PreferencesMouvement({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
