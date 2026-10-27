import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";

/**
 * La barre d'état en clair au-dessus d'un en-tête noir (club, équipe, joueur,
 * match, compétition), quel que soit le thème. Seulement tant que l'écran est
 * devant : il reste monté sous l'écran qu'on lui empile, et sa barre claire
 * l'emporterait sinon sur celle, sombre en thème clair, de l'écran du dessus.
 */
export function BarreDEtatSurNoir() {
  const [devant, setDevant] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setDevant(true);
      return () => setDevant(false);
    }, []),
  );
  return devant ? <StatusBar style="light" /> : null;
}
