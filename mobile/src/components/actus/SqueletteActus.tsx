import { Animated, StyleSheet, View } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { couleurs } from "~/theme";

/** La forme d'Actus, le temps du premier chargement : la une, une journée, deux articles. */
export function SqueletteActus() {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement des actus"
      style={{ opacity: opacite }}
    >
      <View style={styles.une} />
      <View style={styles.journee} />
      {[0, 1].map((k) => (
        <View key={k} style={styles.carte}>
          <View style={styles.ligne} />
          <View style={[styles.ligne, styles.ligneCourte]} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  une: { aspectRatio: 4 / 3, backgroundColor: couleurs.surface },
  journee: { width: 160, height: 18, marginHorizontal: 16, marginTop: 28, backgroundColor: couleurs.surfaceHaute },
  carte: { marginHorizontal: 16, marginTop: 12, padding: 16, gap: 10, backgroundColor: couleurs.surface },
  ligne: { height: 12, backgroundColor: couleurs.bordure },
  ligneCourte: { width: "45%" },
});
