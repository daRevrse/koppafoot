import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avecVia } from "@/lib/audience";
import { gameTypeLabel, matchDurationLabel } from "@/lib/competition-format";
import { categorieAffichee, LIBELLES_CATEGORIE } from "@/lib/genre";
import type { Competition } from "@/types";
import { useSuivi } from "~/hooks/useSuivi";
import { urlDuSite } from "~/lib/config";
import { periodeDeLaCompetition, STATUTS } from "~/lib/page-competition";
import { espacement, polices } from "~/theme";

// L'en-tête de la page publique du site : SOMBRE PAR CONSTRUCTION, comme le
// tableau d'affichage d'une fiche de match. La bannière, s'il y en a une,
// passe derrière, très atténuée : on vient lire des résultats.
const VERT = "#34d399";
const AMBRE = "#FBBF24";
const blanc = (opacite: number) => `rgba(255,255,255,${opacite})`;

/** Partager la compétition, avec la phrase du site : « Suis X à Lomé en direct sur KoppaFoot. » */
function partager(c: Competition): void {
  const ville = c.venueCity ? ` à ${c.venueCity}` : "";
  const phrase = c.status === "registration"
    ? `${c.name}${ville} : les inscriptions sont ouvertes.`
    : `Suis ${c.name}${ville} en direct sur KoppaFoot.`;
  void Share.share({ message: `${phrase}\n${urlDuSite(avecVia(`/c/${c.slug}`, "partage"))}` }).catch(() => {});
}

/** La barre du haut, collée : retour, le nom dès que l'en-tête est sorti de l'écran, l'étoile et le partage. */
export function BarreCompetition({ competition, compact, onRetour }: {
  competition: Competition;
  compact: boolean;
  onRetour: () => void;
}) {
  const suivi = useSuivi();
  const suivie = suivi.ids.has(competition.id);
  return (
    <SafeAreaView edges={["top"]} style={styles.barreFond}>
      <View style={styles.barre}>
        <Pressable accessibilityRole="button" accessibilityLabel="Revenir à l'écran précédent" onPress={onRetour} hitSlop={8} style={styles.bouton}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={[styles.compact, !compact && styles.cache]} numberOfLines={1} accessibilityElementsHidden={!compact}>
          {competition.name.toUpperCase()}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={suivie ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
          accessibilityState={{ selected: suivie }}
          onPress={() => void suivi.basculer(competition.id)}
          hitSlop={8}
          style={styles.bouton}
        >
          <Ionicons name={suivie ? "star" : "star-outline"} size={17} color={suivie ? AMBRE : "#fff"} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Partager la compétition" onPress={() => partager(competition)} hitSlop={8} style={styles.bouton}>
          <Ionicons name="share-outline" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** Le logo, le statut et l'organisateur, le nom, puis les dates, la ville, le format et les abonnés. */
export function EnTeteDeCompetition({ competition: c, abonnes }: { competition: Competition; abonnes: number | null }) {
  const details = [
    periodeDeLaCompetition(c.startDate, c.endDate),
    c.venueCity,
    gameTypeLabel(c.format),
    matchDurationLabel(c.format),
    categorieAffichee(c.category) ? LIBELLES_CATEGORIE.fr[c.category] : null,
  ].filter((d): d is string => !!d);

  return (
    <View style={styles.entete}>
      {c.bannerUrl ? (
        <>
          <Image source={{ uri: c.bannerUrl }} style={[StyleSheet.absoluteFill, styles.banniere]} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, styles.voile]} />
        </>
      ) : null}
      <View style={styles.identite}>
        <View style={styles.logo}>
          {c.logoUrl ? (
            <Image source={{ uri: c.logoUrl }} style={styles.logoImage} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Ionicons name="trophy-outline" size={26} color={VERT} />
          )}
        </View>
        <View style={styles.textes}>
          <Text style={styles.statut} numberOfLines={1}>
            {STATUTS[c.status].toUpperCase()}
            {c.organizerName ? <Text style={styles.organisateur}>{` · ${c.organizerName.toUpperCase()}`}</Text> : null}
          </Text>
          <Text style={styles.nom} numberOfLines={2} accessibilityRole="header">{c.name.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.details}>
        {details.map((d) => <Text key={d} style={styles.detail}>{d.toUpperCase()}</Text>)}
        {abonnes ? <Text style={[styles.detail, styles.vert]}>{`${abonnes} ABONNÉ${abonnes > 1 ? "S" : ""}`}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barreFond: { backgroundColor: "#000" },
  barre: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  bouton: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: blanc(0.15),
    alignItems: "center", justifyContent: "center",
  },
  compact: { flex: 1, textAlign: "center", fontFamily: polices.texteNoir, fontSize: 13, letterSpacing: espacement(13, 0.06), color: "#fff" },
  cache: { opacity: 0 },

  entete: { backgroundColor: "#000", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, overflow: "hidden" },
  banniere: { opacity: 0.35 },
  voile: { backgroundColor: "rgba(0,0,0,0.7)" },
  identite: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: {
    width: 56, height: 56, borderWidth: 1, borderColor: blanc(0.15), backgroundColor: blanc(0.05),
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  logoImage: { width: "100%", height: "100%" },
  textes: { flex: 1, minWidth: 0 },
  statut: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.18), color: "#6ee7b7" },
  organisateur: { color: blanc(0.4) },
  nom: { marginTop: 4, fontFamily: polices.titre, fontSize: 24, lineHeight: 26, color: "#fff" },
  details: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 6, marginTop: 16 },
  detail: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.15), color: blanc(0.55) },
  vert: { color: "#6ee7b7" },
});
