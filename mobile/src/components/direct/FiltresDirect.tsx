import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PointDirect } from "~/components/direct/PointDirect";
import type { FiltreDirect } from "~/lib/direct-tableau";
import { creerStyles, polices } from "~/theme";

/**
 * Les pastilles du Direct du site (DirectHomeV2) : rondes, 11 px Black. « En
 * direct (n) » porte son point, qui ne pulse que s'il y a un match en cours ;
 * active, elle se teinte de rouge, les autres de vert.
 */
export function FiltresDirect({ filtre, enDirect, onChange, fin }: {
  filtre: FiltreDirect;
  enDirect: number;
  onChange: (f: FiltreDirect) => void;
  /** Calé à droite, hors du défilement des pastilles : l'entrée vers l'annuaire. */
  fin?: ReactNode;
}) {
  const styles = useStyles();
  const puces: { cle: FiltreDirect; libelle: string }[] = [
    { cle: "tous", libelle: "Tous" },
    { cle: "direct", libelle: enDirect > 0 ? `En direct (${enDirect})` : "En direct" },
    { cle: "favoris", libelle: "Favoris" },
  ];
  return (
    // La bande ne grandit ni ne rétrécit : une ScrollView horizontale dans une
    // colonne prenait sinon toute la hauteur libre, et la liste en dessous l'écrasait.
    <View style={styles.bande}>
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
    {fin ? <View style={styles.fin}>{fin}</View> : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  bande: {
    flexDirection: "row", alignItems: "center", flexGrow: 0, flexShrink: 0,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  defilement: { flex: 1 },
  fin: { paddingRight: 12 },
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
}));
