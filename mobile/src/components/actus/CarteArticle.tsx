import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Article } from "@/lib/fil-actus";
import { heureDeLArticle } from "~/lib/actus";
import { couleurs, espacement, polices } from "~/theme";

/**
 * Un article du fil (ArticleCard de la page Actus) : la photo de l'éditeur
 * s'il en donne une, le titre, le média et l'heure. Le lien part chez lui :
 * rien n'est recopié.
 */
export function CarteArticle({ article, onPress }: { article: Article; onPress: () => void }) {
  // Une photo que l'éditeur refuse de servir : pas de cadre vide à sa place.
  const [photoCassee, setPhotoCassee] = useState(false);
  const heure = heureDeLArticle(article.at);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${article.title}. ${article.source}${heure ? `, ${heure}` : ""}`}
      accessibilityHint="Ouvre l'article chez l'éditeur"
      onPress={onPress}
      style={({ pressed }) => [styles.carte, pressed && styles.carteTouchee]}
    >
      {article.image && !photoCassee ? (
        <Image
          source={{ uri: article.image }}
          style={styles.photo}
          contentFit="cover"
          transition={150}
          onError={() => setPhotoCassee(true)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.corps}>
        <Text style={styles.titre}>{article.title}</Text>
        <View style={styles.pied}>
          <Text style={styles.source} numberOfLines={1}>
            {article.source}
            {heure ? <Text style={styles.point}>{"  ·  "}</Text> : null}
            {heure}
          </Text>
          <Ionicons name="open-outline" size={12} color={couleurs.texteDiscret} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: couleurs.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  // Le hover:border-gray-900 du site, au doigt.
  carteTouchee: { borderColor: couleurs.bordureForte, backgroundColor: couleurs.surfaceHaute },
  photo: { width: "100%", aspectRatio: 16 / 10, backgroundColor: couleurs.surfaceHaute },
  corps: { padding: 16, gap: 12 },
  titre: { fontFamily: polices.texteGras, fontSize: 16, lineHeight: 21, color: couleurs.texte },
  pied: { flexDirection: "row", alignItems: "center", gap: 8 },
  source: {
    flex: 1, fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.12),
    textTransform: "uppercase", color: couleurs.texteDiscret,
  },
  point: { color: couleurs.bordureForte },
});
