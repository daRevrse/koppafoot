import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { couleurs, espacement, polices } from "~/theme";

/** Un groupe d'entrées du Compte : un titre en capitales espacées, puis ses lignes dans un même cadre. */
export function GroupeCompte({ titre, children }: { titre?: string; children: ReactNode }) {
  return (
    <View style={styles.groupe}>
      {titre ? <Text style={styles.titre} accessibilityRole="header">{titre.toUpperCase()}</Text> : null}
      <View style={styles.cadre}>{children}</View>
    </View>
  );
}

/**
 * Une entrée du Compte. Ce qui s'ouvre sur le site le dit par son icône
 * (une flèche qui sort) : on sait avant de toucher qu'on quitte l'écran.
 */
export function LigneCompte({ icone, libelle, detail, onPress, surLeSite = false, danger = false, premiere = false }: {
  icone: ComponentProps<typeof Ionicons>["name"];
  libelle: string;
  detail?: string | null;
  onPress: () => void;
  surLeSite?: boolean;
  danger?: boolean;
  /** La première ligne du cadre n'a pas de trait au-dessus. */
  premiere?: boolean;
}) {
  const teinte = danger ? couleurs.direct : couleurs.primaire;
  return (
    <Pressable
      accessibilityRole={surLeSite ? "link" : "button"}
      accessibilityLabel={detail ? `${libelle}, ${detail}` : libelle}
      accessibilityHint={surLeSite ? "S'ouvre sur le site" : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, !premiere && styles.trait, pressed && styles.presse]}
    >
      <Ionicons name={icone} size={19} color={teinte} />
      <View style={styles.textes}>
        <Text style={[styles.libelle, danger && { color: couleurs.direct }]} numberOfLines={1}>{libelle}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      {danger ? null : (
        <Ionicons name={surLeSite ? "open-outline" : "chevron-forward"} size={15} color={couleurs.texteDiscret} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groupe: { gap: 8 },
  titre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  ligne: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 15 },
  trait: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  presse: { backgroundColor: couleurs.surfaceHaute },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  libelle: { fontFamily: polices.texteGras, fontSize: 15, color: couleurs.texte },
  detail: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteDiscret },
});
