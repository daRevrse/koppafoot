import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { stylesBloc } from "~/components/competition/Bloc";
import { couleurs, espacement, polices } from "~/theme";

/**
 * Une ligne de l'Espace casquette : un match à tenir, une réservation, un
 * lien. Le titre, ce qui le situe, une note éventuelle, et à droite l'état
 * (en direct, terminé) ou le chevron de ce qui s'ouvre.
 */
export function LigneCasquette({ icone, titre, detail, note, etat, onPress }: {
  icone?: ComponentProps<typeof Ionicons>["name"];
  titre: string;
  detail?: string | null;
  note?: string | null;
  etat?: "direct" | "termine" | null;
  onPress: () => void;
}) {
  const libelleEtat = etat === "direct" ? "en direct" : etat === "termine" ? "terminé" : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[titre, detail, note, libelleEtat].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [stylesBloc.ligne, pressed && styles.presse]}
    >
      {icone ? (
        <View style={[styles.icone, etat === "direct" && styles.iconeDirect]}>
          <Ionicons name={icone} size={17} color={etat === "direct" ? couleurs.direct : couleurs.primaire} />
        </View>
      ) : null}
      <View style={styles.textes}>
        <Text style={styles.titre} numberOfLines={1}>{titre}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
        {note ? <Text style={styles.note} numberOfLines={1}>{note}</Text> : null}
      </View>
      {etat === "direct" ? (
        <Text style={[styles.etat, styles.direct]}>EN DIRECT</Text>
      ) : etat === "termine" ? (
        <Text style={[styles.etat, styles.termine]}>TERMINÉ</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={couleurs.texteDiscret} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  presse: { backgroundColor: couleurs.surfaceHaute },
  icone: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.primaireVoile },
  iconeDirect: { backgroundColor: couleurs.directVoile },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  titre: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  detail: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteDiscret },
  note: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  etat: { paddingHorizontal: 6, paddingVertical: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.1) },
  direct: { color: couleurs.direct, backgroundColor: couleurs.directVoile },
  termine: { color: couleurs.texteDiscret, backgroundColor: couleurs.surfaceHaute },
});
