import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { couleurs, polices } from "~/theme";

type Variante = "plein" | "contour" | "lien";

interface Props extends Omit<PressableProps, "children" | "style"> {
  titre: string;
  variante?: Variante;
  occupe?: boolean;
  /** Posé sur un fond sombre (l'accueil) : un libellé clair pour « contour » et « lien ». */
  sombre?: boolean;
}

export function Bouton({ titre, variante = "plein", occupe = false, sombre = false, disabled, ...reste }: Props) {
  const inactif = disabled || occupe;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactif, busy: occupe }}
      disabled={inactif}
      style={({ pressed }) => [styles.base, styles[variante], inactif && styles.inactif, pressed && styles.presse]}
      {...reste}
    >
      {occupe ? (
        <ActivityIndicator color={variante === "plein" ? "#fff" : couleurs.primaire} />
      ) : (
        <Text
          style={[
            styles.libelle,
            variante === "plein" || sombre ? styles.libellePlein : styles.libelleAutre,
          ]}
        >
          {titre}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  plein: { backgroundColor: couleurs.primaire },
  contour: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond },
  lien: { minHeight: 40 },
  inactif: { opacity: 0.5 },
  presse: { opacity: 0.8 },
  libelle: { fontSize: 15, fontFamily: polices.texteGras },
  libellePlein: { color: "#fff" },
  libelleAutre: { color: couleurs.texte },
});
