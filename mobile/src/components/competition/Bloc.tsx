import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { creerStyles, espacement, polices } from "~/theme";

/**
 * Un cadre de la page d'une compétition : son titre en capitales espacées,
 * et, à droite, de quoi aller voir la suite (« Tous les matchs »).
 */
export function Bloc({ titre, action, children }: {
  titre: string;
  action?: { libelle: string; onPress: () => void };
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.cadre}>
      <View style={styles.entete}>
        <Text style={styles.titre} accessibilityRole="header">{titre.toUpperCase()}</Text>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={8}>
            <Text style={styles.action}>{action.libelle.toUpperCase()}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export const useStylesBloc = creerStyles((couleurs) => ({
  /** Une ligne d'un cadre, séparée de la précédente. */
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  /** Le texte d'un cadre qui n'a rien à montrer. */
  vide: { paddingHorizontal: 16, paddingBottom: 16, fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
}));

const useStyles = creerStyles((couleurs) => ({
  cadre: { marginHorizontal: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  entete: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16 },
  titre: { flexShrink: 1, fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: couleurs.texteDiscret },
  action: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
}));
