import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { couleurs, espacement, polices } from "~/theme";

type Variante = "plein" | "contour" | "lien" | "danger";

interface Props extends Omit<PressableProps, "children" | "style"> {
  titre: string;
  variante?: Variante;
  occupe?: boolean;
}

/**
 * Les boutons du site (components/auth/auth-ui) : carrés, en capitales
 * espacées. « plein » est classeBoutonAuth, « contour » le geste secondaire,
 * « lien » le lien de pied (classeLienPiedAuth).
 */
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
        <ActivityIndicator color={variante === "plein" || variante === "danger" ? couleurs.surBouton : couleurs.texte} />
      ) : (
        <Text style={libelles[variante]}>{titre.toUpperCase()}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  plein: { backgroundColor: couleurs.bouton, borderWidth: 1, borderColor: couleurs.bouton },
  contour: { borderWidth: 1, borderColor: couleurs.bordure },
  lien: { minHeight: 40 },
  danger: { backgroundColor: couleurs.boutonDanger, borderWidth: 1, borderColor: couleurs.boutonDanger },
  inactif: { opacity: 0.4 },
  presse: { opacity: 0.8 },
});

const libelles = StyleSheet.create({
  plein: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), textAlign: "center",
    color: couleurs.surBouton,
  },
  contour: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), textAlign: "center",
    color: couleurs.texteSecondaire,
  },
  lien: {
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), textAlign: "center",
    color: couleurs.texteDiscret,
  },
  danger: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), textAlign: "center",
    color: couleurs.surBouton,
  },
});
