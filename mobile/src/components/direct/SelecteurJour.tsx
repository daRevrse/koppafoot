import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { decalerDeJours, libelleDuJour } from "@/lib/dates";
import { couleurs, polices } from "~/theme";

export function SelecteurJour({ jour, onChange }: { jour: string; onChange: (jour: string) => void }) {
  return (
    <View style={styles.barre}>
      <Pressable accessibilityRole="button" accessibilityLabel="Jour précédent" onPress={() => onChange(decalerDeJours(jour, -1))} hitSlop={12}>
        <Ionicons name="chevron-back" size={20} color={couleurs.texte} />
      </Pressable>
      <Text style={styles.jour}>{libelleDuJour(jour)}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Jour suivant" onPress={() => onChange(decalerDeJours(jour, 1))} hitSlop={12}>
        <Ionicons name="chevron-forward" size={20} color={couleurs.texte} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  jour: { fontFamily: polices.titreMoyen, fontSize: 16, color: couleurs.texte },
});
