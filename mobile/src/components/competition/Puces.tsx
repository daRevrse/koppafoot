import { Pressable, ScrollView, Text } from "react-native";
import { creerStyles, polices } from "~/theme";

/** Des pastilles qui filtrent (les poules d'un calendrier, d'un classement), comme celles du Direct. */
export function Puces<T extends string>({ puces, actif, onChange }: {
  puces: { cle: T; libelle: string }[];
  actif: T;
  onChange: (cle: T) => void;
}) {
  const styles = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.defilement} contentContainerStyle={styles.rangee}>
      {puces.map((p) => {
        const on = p.cle === actif;
        return (
          <Pressable
            key={p.cle}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(p.cle)}
            style={[styles.puce, on && styles.puceActive]}
          >
            <Text style={[styles.libelle, on && styles.libelleActif]}>{p.libelle}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  defilement: { flexGrow: 0, flexShrink: 0 },
  rangee: { gap: 6, paddingHorizontal: 16, paddingBottom: 12, alignItems: "center" },
  puce: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: couleurs.surfaceHaute },
  puceActive: { backgroundColor: couleurs.primaireVoile },
  libelle: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteSecondaire },
  libelleActif: { color: couleurs.primaire },
}));
