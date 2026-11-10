import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { couleurDAvatar } from "~/lib/tribune";
import { polices } from "~/theme";

/**
 * Le visage d'un auteur de la Tribune : sa photo, sinon ses initiales sur la
 * couleur que le site lui donne (la même pour un même nom).
 */
export function Visage({ nom, photo, initiales, taille = 40 }: {
  nom: string;
  photo?: string | null;
  /** Les initiales à montrer ; par défaut les deux premières lettres du nom. */
  initiales?: string;
  taille?: number;
}) {
  const rond = { width: taille, height: taille, borderRadius: taille / 2 };
  if (photo && photo.startsWith("http")) {
    return <Image source={{ uri: photo }} style={rond} contentFit="cover" />;
  }
  return (
    <View style={[styles.sansPhoto, rond, { backgroundColor: couleurDAvatar(nom) }]}>
      <Text style={[styles.initiales, { fontSize: taille <= 28 ? 10 : 12 }]}>{initiales ?? nom.slice(0, 2).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sansPhoto: { alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteGras, color: "#FFFFFF" },
});
