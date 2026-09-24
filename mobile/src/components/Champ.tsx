import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { couleurs, polices } from "~/theme";

interface Props extends TextInputProps {
  etiquette: string;
  erreur?: string | null;
}

export function Champ({ etiquette, erreur, style, ...reste }: Props) {
  return (
    <View style={styles.bloc}>
      <Text style={styles.etiquette}>{etiquette}</Text>
      <TextInput
        accessibilityLabel={etiquette}
        placeholderTextColor={couleurs.texteDiscret}
        style={[styles.champ, erreur ? styles.champErreur : null, style]}
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
    borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: polices.texte, color: couleurs.texte,
  },
  champErreur: { borderColor: couleurs.erreur },
  erreur: { fontSize: 12, fontFamily: polices.texte, color: couleurs.erreur },
});
