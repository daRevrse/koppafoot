import { useEffect, useRef } from "react";
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
  // Six onglets ne tiennent pas sur un téléphone : l'actif se ramène à
  // l'écran, qu'on l'ait touché ou qu'un lien de la page l'ait choisi.
  const defilement = useRef<ScrollView>(null);
  const positions = useRef(new Map<string, { x: number; largeur: number }>());
  const largeurVisible = useRef(0);
  useEffect(() => {
    const p = positions.current.get(actif);
    if (p) defilement.current?.scrollTo({ x: Math.max(0, p.x + p.largeur / 2 - largeurVisible.current / 2), animated: true });
  }, [actif]);

  return (
    <ScrollView
      ref={defilement}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bande}
      contentContainerStyle={styles.rangee}
      onLayout={(e) => {
        largeurVisible.current = e.nativeEvent.layout.width;
      }}
    >
      {onglets.map((o) => {
        const on = o === actif;
        return (
          <Pressable
            key={o}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o)}
            onLayout={(e) => {
              positions.current.set(o, { x: e.nativeEvent.layout.x, largeur: e.nativeEvent.layout.width });
            }}
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
