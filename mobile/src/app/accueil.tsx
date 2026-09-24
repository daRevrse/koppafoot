import { Image } from "expo-image";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { useAccueil } from "~/lib/accueil";
import { couleurs, polices } from "~/theme";

// Le registre de la campagne d'affiches : montrer le match, cacher la
// machine. Et rien qui ne soit pas déjà dans l'application — donc pas encore
// de notifications.
const DIAPOS = [
  {
    cle: "direct",
    image: require("../../assets/accueil/scores.jpg"),
    titre: "Le football d'ici, en direct",
    texte: "Les matchs de ta ville, minute par minute.",
  },
  {
    cle: "suivre",
    image: require("../../assets/accueil/matchs.jpg"),
    titre: "Suis tes compétitions",
    texte: "Une étoile, et elles passent en tête.",
  },
  {
    cle: "monde",
    image: require("../../assets/accueil/terrain.jpg"),
    titre: "Le monde aussi",
    texte: "Le football mondial du jour, au même endroit.",
  },
];

export default function EcranAccueil() {
  const { terminer } = useAccueil();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const liste = useRef<FlatList<(typeof DIAPOS)[number]>>(null);
  const dernier = index === DIAPOS.length - 1;

  return (
    <View style={styles.ecran}>
      <FlatList
        ref={liste}
        data={DIAPOS}
        keyExtractor={(d) => d.cle}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width }}>
            <Image source={item.image} style={styles.image} contentFit="cover" />
            <View style={styles.textes}>
              <Text style={styles.titre}>{item.titre}</Text>
              <Text style={styles.texte}>{item.texte}</Text>
            </View>
          </View>
        )}
      />

      <SafeAreaView edges={["bottom"]} style={styles.bas}>
        <View style={styles.points}>
          {DIAPOS.map((d, i) => (
            <View key={d.cle} style={[styles.point, i === index && styles.pointActif]} />
          ))}
        </View>
        {dernier ? (
          <>
            <Bouton titre="Voir le direct" onPress={() => terminer()} />
            <Bouton titre="J'ai déjà un compte" variante="lien" sombre onPress={() => terminer("/connexion")} />
          </>
        ) : (
          <Bouton titre="Suivant" onPress={() => liste.current?.scrollToIndex({ index: index + 1 })} />
        )}
      </SafeAreaView>

      <SafeAreaView edges={["top"]} style={styles.haut}>
        <Pressable accessibilityRole="button" onPress={() => terminer()} hitSlop={12}>
          <Text style={styles.passer}>Passer</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.sombre },
  image: { width: "100%", height: "62%" },
  textes: { paddingHorizontal: 24, paddingTop: 28, gap: 10 },
  titre: { fontFamily: polices.titre, fontSize: 30, lineHeight: 34, color: "#fff" },
  texte: { fontFamily: polices.texte, fontSize: 16, color: "rgba(255,255,255,0.75)" },
  bas: { paddingHorizontal: 24, paddingBottom: 12, gap: 8 },
  points: { flexDirection: "row", gap: 6, marginBottom: 12 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.3)" },
  pointActif: { width: 18, backgroundColor: couleurs.primaireClair },
  haut: { position: "absolute", top: 0, right: 0, padding: 16 },
  passer: { fontFamily: polices.texteMoyen, fontSize: 14, color: "#fff" },
});
