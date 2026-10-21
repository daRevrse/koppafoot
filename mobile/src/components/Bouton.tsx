import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { couleurs, polices, rayons } from "~/theme";

type Variante = "plein" | "contour" | "lien";

interface Props extends Omit<PressableProps, "children" | "style"> {
  titre: string;
  variante?: Variante;
  occupe?: boolean;
}

export function Bouton({ titre, variante = "plein", occupe = false, disabled, ...reste }: Props) {
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
        <ActivityIndicator color={variante === "plein" ? couleurs.surPrimaire : couleurs.primaire} />
      ) : (
        <Text style={[styles.libelle, libelles[variante]]}>{titre}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", borderRadius: rayons.champ },
  plein: { backgroundColor: couleurs.primaire },
  contour: { borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface },
  lien: { minHeight: 40 },
  inactif: { opacity: 0.5 },
  presse: { opacity: 0.8 },
  libelle: { fontSize: 15, fontFamily: polices.texteGras, textAlign: "center" },
});

// Le plein porte le fond de l'écran sur le vert : le blanc n'y faisait que 3,8.
const libelles = StyleSheet.create({
  plein: { color: couleurs.surPrimaire },
  contour: { color: couleurs.texte },
  lien: { color: couleurs.primaire },
});
