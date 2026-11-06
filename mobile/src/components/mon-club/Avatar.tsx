import { Image } from "expo-image";
import { Text, View } from "react-native";
import { initiales } from "~/lib/initiales";
import { creerStyles, polices } from "~/theme";

/** La photo d'un joueur, ou ses initiales sur un disque vert pâle. */
export function Avatar({ nom, photo, taille = 40 }: { nom: string; photo: string | null; taille?: number }) {
  const styles = useStyles();
  const forme = { width: taille, height: taille, borderRadius: taille / 2 };
  return photo ? (
    <Image source={{ uri: photo }} style={forme} contentFit="cover" accessibilityIgnoresInvertColors />
  ) : (
    <View style={[forme, styles.vide]}>
      <Text style={[styles.texte, { fontSize: Math.round(taille / 3) }]}>{initiales(nom)}</Text>
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  vide: { backgroundColor: couleurs.primaireVoile, alignItems: "center", justifyContent: "center" },
  texte: { fontFamily: polices.texteNoir, color: couleurs.primaire },
}));
