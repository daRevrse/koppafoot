import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { competitionSubtitle } from "@/lib/direct-shared";
import type { Competition } from "@/types";
import { Ecusson } from "~/components/Ecusson";
import { couleurs, polices } from "~/theme";

interface Props {
  competition: Competition;
  /** Faux pour le football mondial et les amicaux : on ne les suit pas. */
  suivable: boolean;
  suivie: boolean;
  onEtoile: () => void;
  onPress: () => void;
  /** La ligne de l'onglet Compte le pose sur une carte. */
  style?: StyleProp<ViewStyle>;
}

export function EnTeteCompetition({ competition, suivable, suivie, onEtoile, onPress, style }: Props) {
  const sousTitre = competitionSubtitle(competition);
  return (
    <View style={[styles.entete, style]}>
      <Pressable accessibilityRole="link" onPress={onPress} style={styles.titre}>
        <Ecusson url={competition.logoUrl} nom={competition.name} taille={24} />
        <View style={styles.textes}>
          <Text style={styles.nom} numberOfLines={1}>{competition.name}</Text>
          {sousTitre ? <Text style={styles.sousTitre} numberOfLines={1}>{sousTitre}</Text> : null}
        </View>
      </Pressable>
      {suivable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={suivie ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
          accessibilityState={{ selected: suivie }}
          onPress={onEtoile}
          hitSlop={12}
        >
          <Ionicons name={suivie ? "star" : "star-outline"} size={22} color={suivie ? couleurs.accent : couleurs.texteDiscret} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond plein : l'en-tête reste collé en haut pendant que les cartes défilent dessous.
  entete: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    backgroundColor: couleurs.fond,
  },
  titre: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  textes: { flex: 1 },
  nom: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  sousTitre: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
});
