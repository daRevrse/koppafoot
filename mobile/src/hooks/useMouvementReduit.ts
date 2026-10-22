import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** Vrai quand le téléphone demande de réduire les animations. */
export function useMouvementReduit(): boolean {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    let vivant = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (vivant) setReduit(v);
      })
      .catch(() => {});
    const abonnement = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduit);
    return () => {
      vivant = false;
      abonnement.remove();
    };
  }, []);
  return reduit;
}
