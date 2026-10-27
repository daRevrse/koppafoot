import { Animated, StyleSheet, View } from "react-native";
import { useRespiration } from "~/hooks/useRespiration";
import { creerStyles } from "~/theme";

/** Deux compétitions, la première avec deux matchs, la seconde avec un. */
const GROUPES = [2, 1];

/** La forme du Direct, le temps du premier chargement. */
export function SqueletteDirect() {
  const styles = useStyles();
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

const useStyles = creerStyles((couleurs) => ({
  entete: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: couleurs.surfaceHaute,
  },
  rond: { width: 26, height: 26, borderRadius: 13, backgroundColor: couleurs.bordure },
  titre: { width: 140, height: 10, backgroundColor: couleurs.bordure },
  carte: {
    height: 56, backgroundColor: couleurs.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
}));
