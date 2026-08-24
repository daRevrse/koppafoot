"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useT } from "@/i18n";
import {
  etatInstallation, etatInstallationServeur, installer, souscrireInstallation,
} from "@/lib/pwa-install";

// ============================================
// L'invitation à installer, flottante, dans le produit.
//
// POURQUOI EN PLUS DU MENU. L'entrée du menu compte est à demeure, mais elle
// est CACHÉE : il faut déjà savoir qu'on veut installer pour aller la
// chercher derrière le bouton du profil. Or personne ne se réveille en
// voulant installer une application, on l'accepte quand on nous la propose.
// Les deux ne font donc pas double emploi, l'une répond, l'autre demande.
//
// CE QU'ON A APPRIS DU PUSH, et qu'on ne refera pas ici. Une sollicitation
// qui tombe à l'ouverture, avant qu'on ait rien vu du produit, se ferme au
// réflexe. Trois garde-fous :
//
//  - elle attend. Le temps de charger, de lire un score, d'être quelque part.
//  - elle se ferme, et le refus TIENT : un mois de silence, gardé sur
//    l'appareil. Redemander à chaque page transforme une proposition en
//    harcèlement, et un produit qu'on ferme dix fois par jour n'est pas un
//    produit qu'on installe.
//  - elle ne s'affiche que là où elle mène quelque part : le navigateur nous
//    a donné la main, ou bien c'est un iPhone, où l'installation est le seul
//    chemin vers les notifications.
//
// Elle se place au-dessus de la barre du bas plutôt qu'en travers de
// l'écran : sous les yeux, jamais devant ce qu'on est en train de lire.
// ============================================

/** La date, en millisecondes, avant laquelle on ne redemande rien. */
const CLE_SILENCE = "koppafoot:install-repousse";

const MOIS = 30 * 24 * 60 * 60 * 1000;

/** Le temps qu'on laisse à quelqu'un d'arriver avant de lui demander quoi que
 *  ce soit. Assez pour que la page soit lue, trop court pour être oublié. */
const DELAI_AVANT_PROPOSITION = 8000;

function silencieux(): boolean {
  const jusqua = Number(localStorage.getItem(CLE_SILENCE) ?? 0);
  return Date.now() < jusqua;
}

export default function PWAInstallFloating() {
  const etat = useSyncExternalStore(
    souscrireInstallation,
    etatInstallation,
    etatInstallationServeur,
  );
  const t = useT();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (etat !== "possible" && etat !== "ios-manuel") return;
    if (silencieux()) return;
    const minuteur = setTimeout(() => setVisible(true), DELAI_AVANT_PROPOSITION);
    return () => clearTimeout(minuteur);
  }, [etat]);

  const repousser = () => {
    localStorage.setItem(CLE_SILENCE, String(Date.now() + MOIS));
    setVisible(false);
  };

  // L'installation acceptée fait retomber l'état à « installee » et la carte
  // disparaît d'elle-même. Refusée, elle consomme l'événement : plus rien à
  // proposer, on se tait aussi.
  const installerMaintenant = async () => {
    setVisible(false);
    await installer();
  };

  if (!visible || (etat !== "possible" && etat !== "ios-manuel")) return null;

  const ios = etat === "ios-manuel";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        role="dialog"
        aria-label={t("install.flottantTitre")}
        className="fixed inset-x-2 bottom-[calc(80px+env(safe-area-inset-bottom,8px))] z-[55] lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[24rem]"
      >
        <div className="relative overflow-hidden border border-emerald-400/20 bg-emerald-950/95 p-4 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={repousser}
            aria-label={t("install.plusTard")}
            className="absolute right-2 top-2 p-2 text-white/30 transition-colors hover:text-white/70"
          >
            <X size={15} />
          </button>

          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-500 text-emerald-950">
              {ios ? <Share size={18} /> : <Download size={18} />}
            </span>

            <div className="min-w-0 flex-1 pr-6">
              <p className="font-display text-sm font-black uppercase tracking-tight text-white">
                {t("install.flottantTitre")}
              </p>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/60">
                {ios ? t("install.ios") : t("install.flottantTexte")}
              </p>

              {!ios && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={installerMaintenant}
                    className="bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-950 transition-colors hover:bg-emerald-300"
                  >
                    {t("install.action")}
                  </button>
                  <button
                    type="button"
                    onClick={repousser}
                    className="px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/40 transition-colors hover:text-white/80"
                  >
                    {t("install.plusTard")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
