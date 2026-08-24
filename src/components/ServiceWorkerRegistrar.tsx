"use client";

import { useEffect } from "react";
// Importé pour son effet de bord, et il n'y a pas d'autre moyen : le module
// pose son écouteur `beforeinstallprompt` à l'import, et cet événement ne se
// produit qu'une fois, très tôt. Attendre qu'un composant du menu compte le
// demande revient à ne jamais le recevoir. Ce fichier est monté dans le
// layout racine, c'est donc le plus tôt qu'on puisse être.
import "@/lib/pwa-install";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Auto-update check every 60 minutes
          setInterval(() => reg.update(), 60 * 60 * 1000);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    }
  }, []);

  return null;
}
