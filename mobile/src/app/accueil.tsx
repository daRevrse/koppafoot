import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
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

/**
 * L'IMAGE PREND TOUT L'ÉCRAN, le texte et les boutons se posent dessus.
 *
 * Un dégradé vers le vert de la marque, sur la moitié basse, garde le texte
 * lisible quelle que soit la photo. Les dimensions viennent de la mise en
 * page réelle (onLayout) : sur Android, selon les versions, la fenêtre compte
 * ou non la barre de navigation. La fenêtre sert de valeur de départ, pour
 * que la première image ne soit pas vide en attendant la mesure.
 */
export default function EcranAccueil() {
  const { terminer } = useAccueil();
  const fenetre = useWindowDimensions();
  const [mesure, setMesure] = useState<{ largeur: number; hauteur: number } | null>(null);
  const taille = mesure ?? { largeur: fenetre.width, hauteur: fenetre.height };
  const [hauteurBas, setHauteurBas] = useState(150);
  const [index, setIndex] = useState(0);
  const liste = useRef<FlatList<(typeof DIAPOS)[number]>>(null);
  const dernier = index === DIAPOS.length - 1;

  return (
    <View
      style={styles.ecran}
      onLayout={(e) => setMesure({ largeur: e.nativeEvent.layout.width, hauteur: e.nativeEvent.layout.height })}
    >
      {/* Texte clair sur la photo ; le layout racine repasse en sombre après. */}
      <StatusBar style="light" />

      <FlatList
        ref={liste}
        data={DIAPOS}
        keyExtractor={(d) => d.cle}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: taille.largeur, offset: taille.largeur * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / taille.largeur))}
        renderItem={({ item }) => (
          <View style={{ width: taille.largeur, height: taille.hauteur }}>
            <Image source={item.image} style={StyleSheet.absoluteFill} contentFit="cover" />
            <LinearGradient
              colors={["transparent", "rgba(13,41,27,0.55)", couleurs.sombre]}
              locations={[0.4, 0.62, 0.9]}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.textes, { bottom: hauteurBas + 16 }]}>
              <Text style={styles.titre}>{item.titre}</Text>
              <Text style={styles.texte}>{item.texte}</Text>
            </View>
          </View>
        )}
      />

      <SafeAreaView
        edges={["bottom"]}
        style={styles.bas}
        onLayout={(e) => setHauteurBas(e.nativeEvent.layout.height)}
      >
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
  textes: { position: "absolute", left: 24, right: 24, gap: 10 },
  titre: { fontFamily: polices.titre, fontSize: 32, lineHeight: 36, color: "#fff" },
  texte: { fontFamily: polices.texte, fontSize: 16, lineHeight: 22, color: "rgba(255,255,255,0.8)" },
  bas: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 12, gap: 8 },
  points: { flexDirection: "row", gap: 6, marginBottom: 12 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  pointActif: { width: 18, backgroundColor: couleurs.primaireClair },
  haut: { position: "absolute", top: 0, right: 0, padding: 16 },
  passer: {
    fontFamily: polices.texteMoyen, fontSize: 14, color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4,
  },
});
