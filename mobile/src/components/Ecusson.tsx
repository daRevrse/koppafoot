import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { initiales } from "~/lib/initiales";
import { couleurs, polices } from "~/theme";

/**
 * Le blason d'une équipe, ou ses initiales.
 *
 * Une image seulement si la valeur est une URL : des initiales ont déjà été
 * rangées là où une adresse était attendue, et le site en a tiré des 404.
 */
export function Ecusson({ url, nom, taille = 22 }: { url: string | null; nom: string; taille?: number }) {
  const dimensions = { width: taille, height: taille, borderRadius: taille / 2 };
  if (url && url.startsWith("http")) {
    return <Image source={{ uri: url }} style={dimensions} contentFit="contain" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.rond, dimensions]}>
      <Text style={[styles.initiales, { fontSize: Math.round(taille * 0.4) }]}>{initiales(nom)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rond: { backgroundColor: couleurs.surfaceHaute, alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteGras, color: couleurs.texteSecondaire },
});
