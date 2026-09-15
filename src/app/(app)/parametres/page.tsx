"use client";

import { motion } from "motion/react";
import { NotificationsBlock, PreferencesBlock } from "@/components/account/AccountExtras";

// ============================================
// LES RÉGLAGES, SORTIS DE LA FEUILLE DU COMPTE.
//
// La feuille portait quatre blocs empilés : l'invitation, le support, les
// notifications, les préférences. On l'ouvre pour aller à son profil ou se
// déconnecter — plusieurs fois par semaine — et on y traversait à chaque fois
// des réglages qu'on touche une fois par an.
//
// Ils vivent donc ici, sur une page qu'on ouvre quand on la cherche. La
// feuille garde ce qu'on y va chercher souvent, et gagne une ligne
// « Paramètres » pour ceux-là.
//
// PAS DE NOUVEAU CODE DE RÉGLAGE. Les deux blocs sont ceux de la feuille,
// rendus tels quels : le thème, la langue et les notifications continuent
// d'être gérés au même endroit. Seule leur ADRESSE change. C'est aussi
// pourquoi ils sont rendus sans `sombre` — cette variante habille la feuille
// vert nuit, et une page d'application suit le thème comme le reste.
// ============================================

export default function ParametresPage() {
  return (
    <div className="mx-auto max-w-2xl pb-24">
      <motion.h1
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        className="font-display text-2xl font-extrabold text-gray-900 sm:text-3xl"
      >
        Paramètres
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mt-1 text-sm text-gray-500"
      >
        Les notifications de cet appareil, le thème et la langue.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-6 divide-y divide-gray-200/70 border border-gray-200/70 bg-white"
      >
        <NotificationsBlock />
        <PreferencesBlock />
      </motion.div>
    </div>
  );
}
