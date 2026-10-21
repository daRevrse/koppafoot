import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { couleurs, polices, rayons } from "~/theme";

interface Props extends TextInputProps {
  etiquette: string;
  erreur?: string | null;
}

export function Champ({ etiquette, erreur, style, onFocus, onBlur, ...reste }: Props) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>{etiquette}</Text>
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

const styles = StyleSheet.create({
  bloc: { gap: 6 },
  etiquette: { fontSize: 12, fontFamily: polices.texteGras, color: couleurs.texteSecondaire },
  champ: {
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface, borderRadius: rayons.champ,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: polices.texte, color: couleurs.texte,
  },
  champFocus: { borderColor: couleurs.primaire },
  champErreur: { borderColor: couleurs.erreur },
  erreur: { fontSize: 12, fontFamily: polices.texte, color: couleurs.erreur },
});
