import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PointDirect } from "~/components/direct/PointDirect";
import type { FiltreDirect } from "~/lib/direct-tableau";
import { couleurs, polices } from "~/theme";

/**
 * Les pastilles du Direct du site (DirectHomeV2) : rondes, 11 px Black. « En
 * direct (n) » porte son point, qui ne pulse que s'il y a un match en cours ;
 * active, elle se teinte de rouge, les autres de vert.
 */
export function FiltresDirect({ filtre, enDirect, onChange }: {
  filtre: FiltreDirect;
  enDirect: number;
  onChange: (f: FiltreDirect) => void;
}) {
  const puces: { cle: FiltreDirect; libelle: string }[] = [
    { cle: "tous", libelle: "Tous" },
    { cle: "direct", libelle: enDirect > 0 ? `En direct (${enDirect})` : "En direct" },
    { cle: "favoris", libelle: "Favoris" },
  ];
  return (
    // flexGrow: 0 : une ScrollView horizontale dans une colonne prend sinon
    // toute la hauteur libre ; flexShrink: 0 : la liste en dessous l'écrasait.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.defilement} contentContainerStyle={styles.rangee}>
      {puces.map((p) => {
        const actif = p.cle === filtre;
        const rouge = p.cle === "direct";
        return (
          <Pressable
            key={p.cle}
            accessibilityRole="tab"
            accessibilityState={{ selected: actif }}
            onPress={() => onChange(p.cle)}
            style={[styles.puce, actif && (rouge ? styles.puceDirect : styles.puceActive)]}
          >
            {rouge ? (
              enDirect > 0 ? <PointDirect /> : <View style={styles.pointEteint} />
            ) : null}
            <Text style={[styles.libelle, actif && (rouge ? styles.libelleDirect : styles.libelleActif)]}>{p.libelle}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  defilement: { flexGrow: 0, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure },
  rangee: { gap: 6, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  puce: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: couleurs.surfaceHaute,
  },
  puceActive: { backgroundColor: couleurs.primaireVoile },
  puceDirect: { backgroundColor: couleurs.directVoile },
  pointEteint: { width: 6, height: 6, borderRadius: 3, backgroundColor: couleurs.texteDiscret },
  libelle: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteSecondaire },
  libelleActif: { color: couleurs.primaire },
  libelleDirect: { color: couleurs.direct },
});
