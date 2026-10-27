import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { creerStyles, polices, useCouleurs } from "~/theme";

/**
 * L'en-tête d'une page ouverte depuis l'en-tête des onglets (le compte, les
 * notifications) : le retour, puis le titre du site, en capitales.
 */
export function EnTetePage({ titre, action }: { titre: string; action?: ReactNode }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  return (
    <View style={styles.entete}>
      <View style={styles.barre}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Revenir à l'écran précédent"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          hitSlop={8}
          style={({ pressed }) => [styles.retour, pressed && styles.presse]}
        >
          <Ionicons name="chevron-back" size={18} color={couleurs.texte} />
        </Pressable>
        {action}
      </View>
      <Text style={styles.titre} accessibilityRole="header">{titre.toUpperCase()}</Text>
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  entete: { paddingHorizontal: 16, paddingTop: 4, gap: 8 },
  barre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  retour: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: couleurs.bordure,
    alignItems: "center", justifyContent: "center",
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  titre: { fontFamily: polices.titre, fontSize: 28, lineHeight: 32, color: couleurs.texte },
}));
