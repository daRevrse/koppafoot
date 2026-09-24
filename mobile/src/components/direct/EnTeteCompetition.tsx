import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
}

export function EnTeteCompetition({ competition, suivable, suivie, onEtoile, onPress }: Props) {
  const sousTitre = competitionSubtitle(competition);
  return (
    <View style={styles.entete}>
      <Pressable accessibilityRole="link" onPress={onPress} style={styles.titre}>
        <Ecusson url={competition.logoUrl} nom={competition.name} taille={20} />
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
          <Ionicons name={suivie ? "star" : "star-outline"} size={20} color={suivie ? couleurs.accent : couleurs.texteDiscret} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: couleurs.fondSecondaire, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  titre: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  textes: { flex: 1 },
  nom: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  sousTitre: { fontFamily: polices.texte, fontSize: 11, color: couleurs.texteDiscret },
});
