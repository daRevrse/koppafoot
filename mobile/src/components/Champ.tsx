import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

interface Props extends TextInputProps {
  etiquette: string;
  erreur?: string | null;
}

/**
 * Le champ du site (auth-ui) : un filet carré, l'étiquette en capitales, et
 * un focus qui renforce la bordure au lieu d'allumer un anneau vert.
 */
export function Champ({ etiquette, erreur, style, onFocus, onBlur, ...reste }: Props) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>{etiquette.toUpperCase()}</Text>
      <TextInput
        accessibilityLabel={etiquette}
        placeholderTextColor={couleurs.texteDiscret}
        selectionColor={couleurs.primaire}
        cursorColor={couleurs.primaire}
        keyboardAppearance="dark"
        onFocus={(e) => {
          setFocus(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          onBlur?.(e);
        }}
        style={[styles.champ, focus && styles.champFocus, erreur ? styles.champErreur : null, style]}
        {...reste}
      />
      {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  bloc: { gap: 6 },
  etiquette: {
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret,
  },
  champ: {
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface,
    paddingHorizontal: 16, paddingVertical: 12, fontSize: 14, fontFamily: polices.texteDemi, color: couleurs.texte,
  },
  champFocus: { borderColor: couleurs.bordureForte },
  champErreur: { borderColor: couleurs.erreur },
  erreur: { fontSize: 12, fontFamily: polices.texteGras, color: couleurs.erreur },
}));
