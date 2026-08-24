"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  etatInstallation, etatInstallationServeur, installer, souscrireInstallation,
} from "@/lib/pwa-install";

// ============================================
// La bannière d'installation, sur la page de connexion.
//
// ELLE ÉCOUTAIT `beforeinstallprompt` ELLE-MÊME, ce qui la condamnait à ne
// fonctionner qu'ici : l'événement ne se produit qu'une fois, très tôt, et
// un composant monté plus tard ne le voit jamais. C'est ce qui rendait
// l'installation invisible à tous ceux qui étaient déjà connectés.
//
// L'écoute a déménagé dans lib/pwa-install, posée dès le chargement de
// l'application. La bannière et le bloc du menu compte lisent désormais le
// même état : deux copies d'une même logique divergent, et personne ne s'en
// aperçoit avant qu'un utilisateur le signale.
//
// Elle reste réservée à cette page, et c'est volontaire : une bannière qui
// suit partout est du harcèlement. Ailleurs, l'entrée permanente du menu
// compte suffit.
// ============================================

export default function PWAInstallPrompt() {
  const etat = useSyncExternalStore(
    souscrireInstallation,
    etatInstallation,
    etatInstallationServeur,
  );
  const [ferme, setFerme] = useState(false);

  // La bannière ne parle qu'aux navigateurs qui savent installer sur appel :
  // sur iPhone, la marche à suivre demande trois lignes d'explication, elles
  // vivent dans le menu du compte plutôt qu'en travers d'un écran de
  // connexion.
  if (etat !== "possible" || ferme) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="relative mt-8 overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md"
      >
        <motion.div
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-emerald-500/5"
        />

        <div className="relative flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <Download size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-bold">Installer KoppaFoot</h4>
            <p className="text-[10px] leading-tight text-black/40 sm:text-xs">
              Ajoutez l&apos;app à votre écran d&apos;accueil pour un accès direct.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => installer()}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-95"
            >
              Installer
            </button>
            <button
              onClick={() => setFerme(true)}
              className="rounded-lg p-2 text-white/20 transition-all hover:bg-white/5 hover:text-white/50"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
