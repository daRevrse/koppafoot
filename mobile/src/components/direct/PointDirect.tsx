import { Animated } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { creerStyles } from "~/theme";

/** Le point rouge d'un match en cours. Décoratif : la minute dit déjà tout. */
export function PointDirect({ taille = 6 }: { taille?: number }) {
  const styles = useStyles();
  const opacite = useRespiration();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.point, { width: taille, height: taille, borderRadius: taille / 2, opacity: opacite }]}
    />
  );
}

const useStyles = creerStyles((couleurs) => ({
  point: { backgroundColor: couleurs.direct },
}));
