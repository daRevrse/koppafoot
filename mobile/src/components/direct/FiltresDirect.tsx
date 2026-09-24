import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { FiltreDirect } from "~/lib/direct-tableau";
import { couleurs, polices } from "~/theme";

export function FiltresDirect({ filtre, enDirect, onChange }: { filtre: FiltreDirect; enDirect: number; onChange: (f: FiltreDirect) => void }) {
  const puces: { cle: FiltreDirect; libelle: string }[] = [
    { cle: "tous", libelle: "Tous" },
    { cle: "direct", libelle: enDirect > 0 ? `En direct (${enDirect})` : "En direct" },
    { cle: "favoris", libelle: "Favoris" },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangee}>
      {puces.map((p) => {
        const actif = p.cle === filtre;
        return (
          <Pressable key={p.cle} accessibilityRole="tab" accessibilityState={{ selected: actif }} onPress={() => onChange(p.cle)} style={[styles.puce, actif && styles.puceActive]}>
            <Text style={[styles.libelle, actif && styles.libelleActif]}>{p.libelle}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  rangee: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  puce: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond },
  puceActive: { backgroundColor: couleurs.texte, borderColor: couleurs.texte },
  libelle: { fontFamily: polices.texteMoyen, fontSize: 13, color: couleurs.texteSecondaire },
  libelleActif: { color: "#fff" },
});
