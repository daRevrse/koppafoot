import { Animated, StyleSheet } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { couleurs } from "~/theme";

/** Le point rouge d'un match en cours. Décoratif : la minute dit déjà tout. */
export function PointDirect({ taille = 6 }: { taille?: number }) {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.point, { width: taille, height: taille, borderRadius: taille / 2, opacity: opacite }]}
    />
  );
}

const styles = StyleSheet.create({
  point: { backgroundColor: couleurs.direct },
});
