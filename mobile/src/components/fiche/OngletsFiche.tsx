import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import type { Onglet } from "~/lib/fiche-match";
import { espacement, polices } from "~/theme";

/** Les libellés courts du site : la rangée doit tenir sur un téléphone. */
const LIBELLES: Record<Onglet, string> = {
  feed: "Fil", tchat: "Tchat", infos: "Infos", lineups: "Compo", stats: "Stats", standings: "Classement", h2h: "H2H",
};

/**
 * La barre d'onglets du site (components/match/MatchTabs) : elle prolonge le
 * tableau, noire, et reste collée sous la barre du haut.
 */
export function OngletsFiche({ onglets, actif, onChange }: {
  onglets: Onglet[];
  actif: Onglet;
  onChange: (o: Onglet) => void;
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
            <Text style={[styles.libelle, on && styles.libelleActif]}>{LIBELLES[o].toUpperCase()}</Text>
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
