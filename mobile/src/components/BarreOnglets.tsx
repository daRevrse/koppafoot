import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { espacement, polices } from "~/theme";

/**
 * La barre d'onglets du site (components/match/MatchTabs) : elle prolonge
 * l'en-tête, noire, et reste collée sous la barre du haut. La fiche de match
 * et la page d'une compétition la partagent.
 */
export function BarreOnglets<T extends string>({ onglets, libelles, actif, onChange }: {
  onglets: T[];
  libelles: Record<T, string>;
  actif: T;
  onChange: (o: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bande} contentContainerStyle={styles.rangee}>
      {onglets.map((o) => {
        const on = o === actif;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            style={[styles.onglet, on && styles.ongletActif]}
          >
            <Text style={[styles.libelle, on && styles.libelleActif]}>{libelles[o].toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bande: {
    flexGrow: 0, flexShrink: 0, backgroundColor: "#000",
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.1)",
  },
  rangee: { gap: 24, paddingHorizontal: 16 },
  onglet: { paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  ongletActif: { borderBottomColor: "#34d399" },
  libelle: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.1), color: "rgba(255,255,255,0.45)" },
  libelleActif: { color: "#fff" },
});
