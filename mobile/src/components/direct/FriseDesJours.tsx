import { useCallback, useEffect, useRef } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { couleurs, polices } from "~/theme";

const LARGEUR = 48;
const ECART = 6;
const MARGE = 12;

interface Props {
  jours: string[];
  jour: string;
  aujourdhui: string;
  /** Les jours qui ont au moins un match : un point sous leur case. */
  avecMatchs: ReadonlySet<string>;
  /** Faux sous « En direct » et « Favoris », où le jour ne filtre rien. */
  actif: boolean;
  onChange: (jour: string) => void;
}

function etiquette(cle: string, aujourdhui: string): { haut: string; bas: string } {
  const d = new Date(`${cle}T00:00:00`);
  return {
    haut: cle === aujourdhui ? "Auj." : d.toLocaleDateString("fr-FR", { weekday: "short" }),
    bas: String(d.getDate()),
  };
}

export function FriseDesJours({ jours, jour, aujourdhui, avecMatchs, actif, onChange }: Props) {
  const liste = useRef<FlatList<string>>(null);
  const index = jours.indexOf(jour);

  // Le jour choisi reste au centre : à l'arrivée (onLayout), puis à chaque choix.
  const centrer = useCallback(
    (anime: boolean) => {
      if (index >= 0) liste.current?.scrollToIndex({ index, viewPosition: 0.5, animated: anime });
    },
    [index],
  );
  useEffect(() => centrer(true), [centrer]);

  return (
    <FlatList
      ref={liste}
      horizontal
      data={jours}
      extraData={[jour, actif, avecMatchs]}
      keyExtractor={(j) => j}
      showsHorizontalScrollIndicator={false}
      scrollEnabled={actif}
      // flexGrow: 0, comme les filtres : une liste horizontale dans une
      // colonne prendrait sinon toute la hauteur libre. flexShrink: 0 : sur le
      // web, la liste des matchs en dessous l'écrasait, et les points
      // passaient sous les filtres.
      style={[styles.frise, !actif && styles.inactive]}
      contentContainerStyle={styles.rangee}
      getItemLayout={(_, i) => ({ length: LARGEUR + ECART, offset: MARGE + (LARGEUR + ECART) * i, index: i })}
      onLayout={() => centrer(false)}
      renderItem={({ item }) => {
        const choisi = item === jour;
        const aDesMatchs = avecMatchs.has(item);
        const { haut, bas } = etiquette(item, aujourdhui);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={aDesMatchs ? `${libelleDuJour(item)}, des matchs` : libelleDuJour(item)}
            accessibilityState={{ selected: choisi, disabled: !actif }}
            disabled={!actif}
            onPress={() => onChange(item)}
            style={[styles.case, choisi && styles.caseChoisie]}
          >
            <Text style={[styles.haut, choisi && styles.surPrimaire]}>{haut}</Text>
            <Text style={[styles.bas, choisi && styles.surPrimaire]}>{bas}</Text>
            <View style={[styles.point, aDesMatchs && (choisi ? styles.pointChoisi : styles.pointPlein)]} />
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  frise: { flexGrow: 0, flexShrink: 0 },
  inactive: { opacity: 0.4 },
  rangee: { paddingHorizontal: MARGE, paddingVertical: 8 },
  case: { width: LARGEUR, marginRight: ECART, paddingVertical: 8, borderRadius: 12, alignItems: "center", gap: 2 },
  caseChoisie: { backgroundColor: couleurs.primaire },
  haut: { fontFamily: polices.texteMoyen, fontSize: 11, color: couleurs.texteDiscret },
  bas: { fontFamily: polices.titreMoyen, fontSize: 17, color: couleurs.texte },
  surPrimaire: { color: couleurs.surPrimaire },
  point: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  pointPlein: { backgroundColor: couleurs.primaire },
  pointChoisi: { backgroundColor: couleurs.surPrimaire },
});
