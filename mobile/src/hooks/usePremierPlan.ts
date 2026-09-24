import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Vrai tant que l'application est à l'écran.
 *
 * L'état initial peut valoir « unknown » au démarrage à froid sur Android :
 * seul « background » compte comme absent, sinon le premier chargement
 * attendrait un changement d'état qui ne viendrait pas.
 */
export function usePremierPlan(): boolean {
  const [actif, setActif] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const abonnement = AppState.addEventListener("change", (etat) => setActif(etat === "active"));
    return () => abonnement.remove();
  }, []);
  return actif;
}
