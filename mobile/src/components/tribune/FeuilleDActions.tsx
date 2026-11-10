import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Modal, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { creerStyles, polices, useCouleurs } from "~/theme";

export interface ActionDeFeuille {
  libelle: string;
  icone: ComponentProps<typeof Ionicons>["name"];
  /** En rouge : un geste qui détruit. */
  danger?: boolean;
  onPress: () => void;
}

/**
 * Le menu d'une publication, en feuille qui monte du bas : ce que le menu
 * déroulant du site fait sur un écran à souris. Toucher à côté la referme.
 */
export function FeuilleDActions({ ouverte, actions, onFermer }: {
  ouverte: boolean;
  actions: ActionDeFeuille[];
  onFermer: () => void;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  return (
    <Modal visible={ouverte} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <Pressable style={styles.voile} onPress={onFermer} accessibilityLabel="Fermer le menu" />
      <SafeAreaView edges={["bottom"]} style={styles.feuille} accessibilityViewIsModal>
        {actions.map((a) => (
          <Pressable
            key={a.libelle}
            accessibilityRole="button"
            onPress={() => {
              onFermer();
              a.onPress();
            }}
            style={({ pressed }) => [styles.action, pressed && styles.presse]}
          >
            <Ionicons name={a.icone} size={18} color={a.danger ? couleurs.erreur : couleurs.texte} />
            <Text style={[styles.libelle, a.danger && styles.danger]}>{a.libelle}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={onFermer} style={({ pressed }) => [styles.action, styles.annuler, pressed && styles.presse]}>
          <Text style={styles.annulerTexte}>Annuler</Text>
        </Pressable>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = creerStyles((couleurs) => ({
  voile: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  feuille: { backgroundColor: couleurs.surface, borderTopWidth: 1, borderTopColor: couleurs.bordure, paddingTop: 6 },
  action: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 15 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  libelle: { fontFamily: polices.texteDemi, fontSize: 15, color: couleurs.texte },
  danger: { color: couleurs.erreur },
  annuler: { justifyContent: "center", borderTopWidth: 1, borderTopColor: couleurs.bordure },
  annulerTexte: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texteSecondaire },
}));
