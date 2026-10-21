import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { FiltreDirect } from "~/lib/direct-tableau";
import { couleurs, polices } from "~/theme";

// Le nombre de matchs en cours est dans la pastille de l'en-tête du Direct.
const PUCES: { cle: FiltreDirect; libelle: string }[] = [
  { cle: "tous", libelle: "Tous" },
  { cle: "direct", libelle: "En direct" },
  { cle: "favoris", libelle: "Favoris" },
];

export function FiltresDirect({ filtre, onChange }: { filtre: FiltreDirect; onChange: (f: FiltreDirect) => void }) {
  return (
    // flexGrow: 0 : une ScrollView horizontale dans une colonne prend sinon
    // toute la hauteur libre, et les puces s'étiraient sur un tiers de l'écran.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.defilement} contentContainerStyle={styles.rangee}>
      {PUCES.map((p) => {
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
  defilement: { flexGrow: 0, flexShrink: 0 },
  rangee: { gap: 8, paddingHorizontal: 16, paddingBottom: 8, alignItems: "center" },
  puce: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1,
    borderColor: couleurs.bordure, backgroundColor: couleurs.surface,
  },
  puceActive: { backgroundColor: couleurs.primaire, borderColor: couleurs.primaire },
  libelle: { fontFamily: polices.texteMoyen, fontSize: 13, color: couleurs.texteSecondaire },
  libelleActif: { color: couleurs.surPrimaire },
});
