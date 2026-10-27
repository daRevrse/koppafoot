import { ActivityIndicator, Pressable, Text } from "react-native";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/**
 * Le bouton d'un geste de l'Espace casquette (« Je couvre », « Confirmer »,
 * « Refuser ») : petit, carré, en capitales, comme les boutons de ligne du
 * site. Plein pour le geste qui engage, cerclé pour l'autre.
 */
export function BoutonGeste({ libelle, onPress, variante = "plein", occupe = false, inactif = false, accessibilityLabel }: {
  libelle: string;
  onPress: () => void;
  variante?: "plein" | "contour";
  /** Ce geste-ci est en cours : l'indicateur remplace le libellé. */
  occupe?: boolean;
  /** Un autre geste est en cours : on n'en lance pas un second. */
  inactif?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const plein = variante === "plein";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? libelle}
      accessibilityState={{ disabled: inactif || occupe, busy: occupe }}
      disabled={inactif || occupe}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.bouton,
        plein ? styles.plein : styles.contour,
        pressed && styles.presse,
        (inactif || occupe) && styles.attente,
      ]}
    >
      {occupe ? (
        <ActivityIndicator size="small" color={plein ? couleurs.surBouton : couleurs.texte} />
      ) : (
        <Text style={[styles.texte, { color: plein ? couleurs.surBouton : couleurs.texteSecondaire }]}>
          {libelle.toUpperCase()}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = creerStyles((couleurs) => ({
  bouton: { minWidth: 92, minHeight: 36, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  plein: { backgroundColor: couleurs.bouton },
  contour: { borderWidth: 1, borderColor: couleurs.bordureForte },
  presse: { opacity: 0.8 },
  attente: { opacity: 0.5 },
  texte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12) },
}));
