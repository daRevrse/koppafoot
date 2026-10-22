import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { couleurs, polices } from "~/theme";

interface Props {
  icone: ComponentProps<typeof Ionicons>["name"];
  texte: string;
  /** De quoi repartir : un bouton, le plus souvent. */
  children?: ReactNode;
}

/** Une liste vide, un chargement raté : une icône, une phrase, et de quoi repartir. */
export function EtatVide({ icone, texte, children }: Props) {
  return (
    <View style={styles.bloc}>
      <Ionicons name={icone} size={36} color={couleurs.texteDiscret} />
      <Text style={styles.texte}>{texte}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { alignItems: "center", paddingHorizontal: 32, paddingVertical: 40, gap: 14 },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire, textAlign: "center" },
});
