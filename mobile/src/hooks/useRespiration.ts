import { useEffect, useState } from "react";
import { Animated, Platform } from "react-native";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";

/** Le pilote natif n'existe pas sur le web : React Native Web préviendrait à chaque boucle. */
const PILOTE_NATIF = Platform.OS !== "web";

/**
 * Une opacité qui respire, de 1 à 0,35 et retour : le point d'un match en
 * cours, les squelettes. Immobile quand le téléphone demande moins
 * d'animations.
 */
export function useRespiration(demiPeriode = 800): Animated.Value {
  const reduit = useMouvementReduit();
  // useState et non useRef : lire une ref pendant le rendu est interdit (règle `refs`).
  const [opacite] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduit) {
      opacite.setValue(1);
      return;
    }
    const boucle = Animated.loop(
      Animated.sequence([
        Animated.timing(opacite, { toValue: 0.35, duration: demiPeriode, useNativeDriver: PILOTE_NATIF }),
        Animated.timing(opacite, { toValue: 1, duration: demiPeriode, useNativeDriver: PILOTE_NATIF }),
      ]),
    );
    boucle.start();
    return () => boucle.stop();
  }, [reduit, demiPeriode, opacite]);
  return opacite;
}
