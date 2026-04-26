"use client";

import { useState, useEffect } from "react";
import { Smartphone, X, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function PWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed or in standalone mode
    const isPWA = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone;
    if (isPWA) {
      setIsStandalone(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the default browser prompt
      e.preventDefault();
      // Store the event so it can be triggered later
      setInstallPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    
    // Show the install prompt
    installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === "accepted") {
      setInstallPrompt(null);
      setIsVisible(false);
    }
  };

  if (isStandalone || !isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        className="mt-8 overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 backdrop-blur-md relative group"
      >
        {/* Subtle pulsed glow */}
        <motion.div 
          animate={{ opacity: [0.1, 0.3, 0.1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="absolute inset-0 bg-emerald-500/5"
        />

        <div className="relative flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <Download size={20} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white truncate">Installer KoppaFoot</h4>
            <p className="text-[10px] sm:text-xs text-white/40 leading-tight">Ajoutez l'app à votre écran d'accueil pour un accès direct.</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleInstall}
              className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-400 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
            >
              Installer
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="rounded-lg p-2 text-white/20 hover:text-white/50 hover:bg-white/5 transition-all"
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
