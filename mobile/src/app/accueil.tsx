import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { useAccueil } from "~/lib/accueil";
import { couleurs, espacement, polices } from "~/theme";

/**
 * La photo de la page de connexion du site (public/branding/login_side.jpg) :
 * un ballon sur un terrain en terre, le but au fond. L'application parle
 * d'abord au football d'ici, pas aux stades d'Europe.
 */
const FOND = require("../../assets/accueil/fond.jpg");

// Le registre de la campagne d'affiches : montrer le match, cacher la
// machine. Et rien qui ne soit pas déjà dans l'application.
const DIAPOS = [
  { cle: "direct", titre: "Le football d'ici, en direct", texte: "Les matchs de ta ville, minute par minute." },
  { cle: "suivre", titre: "Suis tes compétitions", texte: "Une étoile, et elles passent en tête." },
  { cle: "monde", titre: "Le monde aussi", texte: "Le football mondial du jour, au même endroit." },
];

/**
 * LA PHOTO RESTE, LES TEXTES DÉFILENT. Une seule image, fixe, plein écran,
 * sous un dégradé vers le noir de l'application ; seuls les titres glissent
 * d'un écran à l'autre. Les dimensions viennent de la mise en page réelle
 * (onLayout) : sur Android, selon les versions, la fenêtre compte ou non la
 * barre de navigation. La fenêtre sert de valeur de départ.
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
      <StatusBar style="light" />
      <Image source={FOND} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={["transparent", "rgba(8,13,11,0.6)", couleurs.fond]}
        locations={[0.35, 0.58, 0.86]}
        style={StyleSheet.absoluteFill}
      />

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
            <View style={[styles.textes, { bottom: hauteurBas + 16 }]}>
              <Text style={styles.titre}>{item.titre.toUpperCase()}</Text>
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
            <Bouton titre="J'ai déjà un compte" variante="lien" onPress={() => terminer("/connexion")} />
          </>
        ) : (
          <Bouton titre="Suivant" onPress={() => liste.current?.scrollToIndex({ index: index + 1 })} />
        )}
      </SafeAreaView>

      <SafeAreaView edges={["top"]} style={styles.haut}>
        <Pressable accessibilityRole="button" onPress={() => terminer()} hitSlop={12}>
          <Text style={styles.passer}>PASSER</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  textes: { position: "absolute", left: 24, right: 24, gap: 12 },
  // L'affiche du site (CadreAuth) : font-display font-black, capitales, interlignage 0,9.
  titre: { fontFamily: polices.titre, fontSize: 36, lineHeight: 34, letterSpacing: espacement(36, -0.02), color: "#fff" },
  texte: { fontFamily: polices.texte, fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.75)" },
  bas: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 24, paddingBottom: 12, gap: 8 },
  points: { flexDirection: "row", gap: 6, marginBottom: 12 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  pointActif: { width: 18, backgroundColor: "#10b981" },
  haut: { position: "absolute", top: 0, right: 0, padding: 16 },
  passer: {
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4,
  },
});
