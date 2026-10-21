import { Animated, StyleSheet, View } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { couleurs, rayons } from "~/theme";

/** Deux compétitions, la première avec deux matchs, la seconde avec un. */
const GROUPES = [2, 1];

/** La forme du Direct, le temps du premier chargement. */
export function SqueletteDirect() {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement du Direct"
      style={{ opacity: opacite }}
    >
      {GROUPES.map((cartes, g) => (
        <View key={g}>
          <View style={styles.entete}>
            <View style={styles.rond} />
            <View style={styles.titre} />
          </View>
          {Array.from({ length: cartes }, (_, c) => (
            <View key={c} style={styles.carte} />
          ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  rond: { width: 24, height: 24, borderRadius: 12, backgroundColor: couleurs.surfaceHaute },
  titre: { width: 140, height: 12, borderRadius: 6, backgroundColor: couleurs.surfaceHaute },
  carte: { height: 84, marginHorizontal: 12, marginBottom: 8, borderRadius: rayons.carte, backgroundColor: couleurs.surface },
});
