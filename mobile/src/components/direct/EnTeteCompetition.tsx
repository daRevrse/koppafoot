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
  /** Le nombre de matchs du jour, et le chevron qui replie la liste : le Direct seulement. */
  repli?: { nombre: number; repliee: boolean; onBasculer: () => void };
  /** La ligne de l'onglet Compte le pose sur une surface. */
  style?: StyleProp<ViewStyle>;
}

/** L'en-tête d'une compétition, celui du Direct du site (CompetitionGroup). */
export function EnTeteCompetition({ competition, suivable, suivie, onEtoile, onPress, repli, style }: Props) {
  const sousTitre = competitionSubtitle(competition);
  return (
    <View style={[styles.entete, style]}>
      <Pressable accessibilityRole="link" onPress={onPress} style={styles.titre}>
        <Ecusson url={competition.logoUrl} nom={competition.name} taille={26} />
        <View style={styles.textes}>
          <Text style={styles.nom} numberOfLines={1}>{competition.name}</Text>
          {sousTitre ? (
            <View style={styles.lieu}>
              <Ionicons name="location-sharp" size={10} color={couleurs.texteDiscret} />
              <Text style={styles.sousTitre} numberOfLines={1}>{sousTitre}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      {suivable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={suivie ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
          accessibilityState={{ selected: suivie }}
          onPress={onEtoile}
          hitSlop={10}
        >
          <Ionicons name={suivie ? "star" : "star-outline"} size={18} color={suivie ? couleurs.accent : couleurs.texteDiscret} />
        </Pressable>
      ) : null}
      {repli ? (
        <>
          <Text style={styles.nombre}>{repli.nombre}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={repli.repliee ? "Déplier" : "Replier"}
            accessibilityState={{ expanded: !repli.repliee }}
            onPress={repli.onBasculer}
            hitSlop={10}
            style={styles.chevron}
          >
            <Ionicons name={repli.repliee ? "chevron-forward" : "chevron-down"} size={16} color={couleurs.texteDiscret} />
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Fond plein : l'en-tête reste collé en haut pendant que les lignes défilent dessous.
  entete: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: couleurs.surfaceHaute,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  titre: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  textes: { flex: 1 },
  nom: { fontFamily: polices.texteNoir, fontSize: 13, color: couleurs.texte },
  lieu: { flexDirection: "row", alignItems: "center", gap: 3 },
  sousTitre: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  nombre: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteDiscret },
  chevron: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
});
