import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { categorieAffichee, LIBELLES_CATEGORIE } from "@/lib/genre";
import type { Competition } from "@/types";
import { periodeCourte, STATUT_DE_CARTE } from "~/lib/annuaire";
import { couleurs, espacement, polices } from "~/theme";

/**
 * Une compétition de l'annuaire (CompetitionDirectoryCard du site, sa forme
 * pour téléphone) : la vignette, le statut, le nom, l'organisateur, les dates
 * et la ville, et l'étoile de suivi.
 */
export function CarteAnnuaire({ competition: c, suivie, onEtoile, onPress }: {
  competition: Competition;
  suivie: boolean;
  onEtoile: () => void;
  onPress: () => void;
}) {
  const statut = STATUT_DE_CARTE[c.status];
  const vignette = c.logoUrl ?? c.bannerUrl;
  const periode = periodeCourte(c.startDate, c.endDate);
  return (
    <View style={styles.carte}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${c.name}, ${statut.libelle}`}
        onPress={onPress}
        style={({ pressed }) => [styles.lien, pressed && styles.presse]}
      >
        <View style={styles.vignette}>
          {vignette ? (
            <Image source={{ uri: vignette }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Ionicons name="trophy-outline" size={26} color={couleurs.primaire} />
          )}
        </View>
        <View style={styles.textes}>
          <View style={styles.statut}>
            <View style={[styles.point, { backgroundColor: statut.couleur }]} />
            <Text style={[styles.statutTexte, { color: statut.couleur }]}>{statut.libelle.toUpperCase()}</Text>
          </View>
          <Text style={styles.nom} numberOfLines={2}>
            {c.name}
            {categorieAffichee(c.category) ? <Text style={styles.categorie}>{`  ${LIBELLES_CATEGORIE.fr[c.category].toUpperCase()}`}</Text> : null}
          </Text>
          {c.organizerName ? <Text style={styles.detail} numberOfLines={1}>{`Par ${c.organizerName}`}</Text> : null}
          {periode || c.venueCity ? (
            <Text style={styles.detail} numberOfLines={1}>{[periode, c.venueCity].filter(Boolean).join(" · ")}</Text>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={suivie ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
        accessibilityState={{ selected: suivie }}
        onPress={onEtoile}
        hitSlop={8}
        style={styles.etoile}
      >
        <Ionicons name={suivie ? "star" : "star-outline"} size={18} color={suivie ? couleurs.accent : couleurs.texteDiscret} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: "row", alignItems: "center", backgroundColor: couleurs.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  lien: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14, padding: 12 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  vignette: {
    width: 64, height: 64, backgroundColor: couleurs.surfaceHaute, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  textes: { flex: 1, minWidth: 0, gap: 3 },
  statut: { flexDirection: "row", alignItems: "center", gap: 6 },
  point: { width: 6, height: 6, borderRadius: 3 },
  statutTexte: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.12) },
  nom: { fontFamily: polices.titreMoyen, fontSize: 15, lineHeight: 19, color: couleurs.texte },
  categorie: { fontFamily: polices.texteNoir, fontSize: 9, color: couleurs.primaire },
  detail: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  etoile: { paddingHorizontal: 16, alignSelf: "stretch", justifyContent: "center" },
});
