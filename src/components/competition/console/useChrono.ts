"use client";

import { useEffect, useState } from "react";
import type { CompMatch } from "@/types";

// Une pièce de la console live (LiveMatchConsole).

/** Le temps du chrono à l'affichage, en millisecondes. */
export function useChrono(match: CompMatch | null): number {
  const [displayTime, setDisplayTime] = useState(0);

  // L'horloge du serveur : `timerStartAt` + `timerOffset`. La garde
  // `match.status === "live"` fige l'horloge au coup de sifflet final : ne pas
  // la retirer.
  useEffect(() => {
    if (!match?.liveState) return;
    let interval: ReturnType<typeof setInterval>;

    if (match.status === "live" && match.liveState.isTimerRunning && match.liveState.timerStartAt) {
      const start = new Date(match.liveState.timerStartAt).getTime();
      const offset = match.liveState.timerOffset || 0;
      interval = setInterval(() => setDisplayTime(Date.now() - start + offset), 100);
    } else {
      // Le chrono arrêté : l'affichage se cale sur le temps que porte le match.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayTime(match.liveState.timerOffset || 0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [match?.liveState, match?.status]);

  return displayTime;
}
