import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { Article } from "@/lib/fil-actus";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";
import { creerStyles, espacement, palettes, polices } from "~/theme";

/**
 * La une du jour (ArticleHero du site) : un article à la fois, en grand, et on
 * passe au suivant d'un glissement. Défilement à la main seulement : une page
 * d'actualité qui bouge toute seule fait rater la ligne qu'on lisait.
 *
 * Avec ou sans photo : les flux d'éditeurs en donnent une, Google Actualités
 * jamais. Sans photo, le titre EST l'illustration, et le numéro du volet tient
 * lieu d'image.
 */
export function UneDuJour({ articles, onOuvrir }: { articles: Article[]; onOuvrir: (a: Article) => void }) {
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [rang, setRang] = useState(0);
  const liste = useRef<FlatList<Article>>(null);
  const reduit = useMouvementReduit();
  const n = articles.length;
  if (n === 0) return null;

  function aller(k: number) {
    setRang(k);
    liste.current?.scrollToOffset({ offset: k * width, animated: !reduit });
  }

  return (
    <View accessibilityLabel="À la une aujourd'hui">
      <FlatList
        ref={liste}
        data={articles}
        keyExtractor={(a) => a.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        // onScroll plutôt que la fin de l'élan : le web ne la signale pas.
        onScroll={(e) => setRang(Math.min(n - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / width))))}
        scrollEventThrottle={32}
        renderItem={({ item, index }) => (
          <Volet article={item} numero={index + 1} largeur={width} onPress={() => onOuvrir(item)} />
        )}
      />
      {n > 1 ? (
        <View style={styles.reperes}>
          {articles.map((a, k) => (
            <Pressable
              key={a.id}
              accessibilityRole="button"
              accessibilityLabel={`Article ${k + 1} sur ${n}`}
              accessibilityState={{ selected: k === rang }}
              onPress={() => aller(k)}
              style={styles.repere}
            >
              <View style={[styles.trait, k === rang && styles.traitActif]} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Volet({ article, numero, largeur, onPress }: { article: Article; numero: number; largeur: number; onPress: () => void }) {
  const styles = useStyles();
  const [photoCassee, setPhotoCassee] = useState(false);
  const photo = article.image && !photoCassee ? article.image : null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${article.title}. ${article.source}`}
      accessibilityHint="Ouvre l'article chez l'éditeur"
      onPress={onPress}
      style={[styles.volet, { width: largeur }]}
    >
      {photo ? (
        <>
          <Image
            source={{ uri: photo }}
            style={[StyleSheet.absoluteFill, styles.photo]}
            contentFit="cover"
            transition={150}
            onError={() => setPhotoCassee(true)}
            accessibilityIgnoresInvertColors
          />
          {/* Le voile porte le texte : sans lui, un titre blanc sur une photo
              claire devient illisible une fois sur trois. */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.85)"]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <Text style={styles.numero} aria-hidden>
          {String(numero).padStart(2, "0")}
        </Text>
      )}
      <View style={styles.texte}>
        <Text style={styles.source} numberOfLines={1}>{article.source}</Text>
        <Text style={styles.titre} numberOfLines={4}>{article.title}</Text>
        <View style={styles.lire}>
          <Text style={styles.lireTexte} numberOfLines={1}>Lire chez {article.source}</Text>
          <Ionicons name="open-outline" size={13} color="rgba(255,255,255,0.7)" />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = creerStyles((couleurs) => ({
  // 4:3 et non le 16:9 du site : sur un téléphone, le titre a besoin de la hauteur.
  // Sombre dans les deux thèmes, comme les en-têtes noirs : son texte est blanc, photo ou pas.
  volet: { aspectRatio: 4 / 3, overflow: "hidden", backgroundColor: palettes.sombre.surface, justifyContent: "flex-end" },
  photo: { opacity: 0.8 },
  numero: {
    position: "absolute", right: -12, top: -36, fontFamily: polices.titre, fontSize: 200, lineHeight: 220,
    color: "rgba(255,255,255,0.05)",
  },
  texte: { padding: 20, gap: 10 },
  source: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.2), textTransform: "uppercase",
    color: palettes.sombre.primaire,
  },
  titre: { fontFamily: polices.titre, fontSize: 26, lineHeight: 29, color: "#ffffff" },
  lire: { flexDirection: "row", alignItems: "center", gap: 6 },
  lireTexte: {
    flexShrink: 1, fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), textTransform: "uppercase",
    color: "rgba(255,255,255,0.7)",
  },
  reperes: { flexDirection: "row", gap: 6, paddingHorizontal: 16 },
  // Le trait fait 3 points ; la zone qu'on touche, elle, fait un doigt.
  repere: { flex: 1, paddingVertical: 12 },
  trait: { height: 3, backgroundColor: couleurs.bordure },
  traitActif: { backgroundColor: couleurs.texte },
}));
