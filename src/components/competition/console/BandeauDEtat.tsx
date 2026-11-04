"use client";

import { useState, useEffect } from "react";
import { Shield, WifiOff, CloudUpload } from "lucide-react";

/**
 * LA BANDE DU HAUT, et ce qu'elle a à dire.
 *
 * Elle portait en permanence « Ne quitte pas cette page avant le coup de
 * sifflet final » — une consigne qu'on lit une fois, affichée tout le match
 * dans la hauteur la plus rare de la console couchée. Elle sert maintenant à
 * ce qui change pendant le match, et se tait le reste du temps :
 *
 *   hors ligne     → combien de saisies attendent, et qu'elles partiront ;
 *   envoi qui traîne → le réseau passe mal, les saisies partent quand même ;
 *   à l'ouverture  → la consigne, le temps de la lire.
 */
export function BandeauDEtat({
  enLigne, enAttente, consigne,
}: {
  enLigne: boolean;
  /** Écritures parties et pas encore confirmées, plus retouches en file. */
  enAttente: number;
  consigne: boolean;
}) {
  // « Qui traîne » : au-delà de deux secondes et demie. En deçà, c'est un
  // aller-retour ordinaire, et l'annoncer ferait clignoter la bande à chaque
  // saisie.
  const occupe = enAttente > 0;
  const [lent, setLent] = useState(false);
  useEffect(() => {
    if (!occupe) return;
    const t = setTimeout(() => setLent(true), 2500);
    return () => {
      clearTimeout(t);
      setLent(false);
    };
  }, [occupe]);

  const saisies = `${enAttente} saisie${enAttente > 1 ? "s" : ""}`;
  if (!enLigne) {
    return (
      <div role="status" className="flex shrink-0 items-center gap-1.5 bg-amber-500 px-2 py-px text-gray-950">
        <WifiOff size={11} className="shrink-0" />
        <p className="truncate text-[10px] font-black uppercase tracking-wide">
          Hors ligne{enAttente > 0 ? ` · ${saisies} en attente` : ""} · continue, tout partira au retour du réseau
        </p>
      </div>
    );
  }
  if (occupe && lent) {
    return (
      <div role="status" className="flex shrink-0 items-center gap-1.5 bg-white/10 px-2 py-px text-white/80">
        <CloudUpload size={11} className="shrink-0 animate-pulse" />
        <p className="truncate text-[10px] font-black uppercase tracking-wide">
          Réseau lent · envoi de {saisies}
        </p>
      </div>
    );
  }
  if (consigne) {
    return (
      <div className="flex shrink-0 items-center gap-1.5 bg-amber-500 px-2 py-px text-white">
        <Shield size={10} className="shrink-0" />
        <p className="truncate text-[10px] font-black uppercase tracking-wide">
          Ne quitte pas cette page avant le coup de sifflet final
        </p>
      </div>
    );
  }
  return null;
}
