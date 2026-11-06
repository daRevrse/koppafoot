import { Pressable, Text, View } from "react-native";
import { retourSelection } from "~/lib/retour";
import { creerStyles, espacement, polices } from "~/theme";

/**
 * Un choix parmi quelques valeurs (un poste, un niveau, une catégorie) : des
 * pastilles carrées, l'active en vert pâle, comme les filtres du site.
 */
export function Pastilles<T extends string>({ etiquette, options, valeur, onChange }: {
  etiquette: string;
  options: readonly { valeur: T; libelle: string }[];
  valeur: T | null;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>{etiquette.toUpperCase()}</Text>
      <View style={styles.rangee} accessibilityRole="radiogroup" accessibilityLabel={etiquette}>
        {options.map((o) => {
          const on = o.valeur === valeur;
          return (
            <Pressable
              key={o.valeur}
              accessibilityRole="radio"
              accessibilityLabel={o.libelle}
              aria-checked={on}
              onPress={() => {
                if (!on) retourSelection();
                onChange(o.valeur);
              }}
              style={({ pressed }) => [styles.pastille, on && styles.active, pressed && styles.presse]}
            >
              <Text style={[styles.libelle, on && styles.libelleActif]}>{o.libelle.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  bloc: { gap: 6 },
  etiquette: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  rangee: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pastille: {
    minHeight: 40, paddingHorizontal: 14, justifyContent: "center",
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface,
  },
  active: { borderColor: couleurs.primaire, backgroundColor: couleurs.primaireVoile },
  presse: { opacity: 0.8 },
  libelle: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.1), color: couleurs.texteSecondaire },
  libelleActif: { color: couleurs.primaire },
}));
