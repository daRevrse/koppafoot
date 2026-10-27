import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Competition } from "@/types";
import { Bloc, stylesBloc } from "~/components/competition/Bloc";
import { STATUT_DE_CARTE } from "~/lib/annuaire";
import { PAGES_DU_SITE } from "~/lib/espace-casquette";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { routeDeLaCompetition } from "~/lib/routes";
import { couleurs, espacement, polices } from "~/theme";

/**
 * Mes compétitions (l'espace organisateur du site) : celles qu'on organise,
 * puis celles qu'on modère. Toucher la ligne ouvre la page de la compétition
 * dans l'application ; « Gérer » ouvre son espace sur le site.
 */
export function SectionCompetitions({ competitions, organisateur }: { competitions: Competition[]; organisateur: boolean }) {
  return (
    <Bloc
      titre="Mes compétitions"
      action={organisateur ? { libelle: "Créer", onPress: () => ouvrirSurLeSite(PAGES_DU_SITE.creer) } : undefined}
    >
      {competitions.length === 0 ? (
        <Text style={stylesBloc.vide}>Tu n&apos;organises pas encore de compétition.</Text>
      ) : (
        competitions.map((c) => <LigneCompetition key={c.id} competition={c} />)
      )}
    </Bloc>
  );
}

function LigneCompetition({ competition: c }: { competition: Competition }) {
  const router = useRouter();
  const statut = STATUT_DE_CARTE[c.status];
  const vignette = c.logoUrl ?? c.bannerUrl;
  return (
    <View style={styles.ligne}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${c.name}, ${statut.libelle}`}
        onPress={() => {
          const route = routeDeLaCompetition(c);
          if (route) router.push(route);
        }}
        style={({ pressed }) => [styles.lien, pressed && styles.presse]}
      >
        <View style={styles.vignette}>
          {vignette ? (
            <Image source={{ uri: vignette }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Ionicons name="trophy-outline" size={18} color={couleurs.primaire} />
          )}
        </View>
        <View style={styles.textes}>
          <View style={styles.statut}>
            <View style={[styles.point, { backgroundColor: statut.couleur }]} />
            <Text style={[styles.statutTexte, { color: statut.couleur }]}>{statut.libelle.toUpperCase()}</Text>
          </View>
          <Text style={styles.nom} numberOfLines={1}>{c.name}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Gérer ${c.name} sur le site`}
        onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.gerer(c.id))}
        hitSlop={6}
        style={({ pressed }) => [styles.gerer, pressed && styles.presse]}
      >
        <Text style={styles.gererTexte}>GÉRER</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row", alignItems: "center", paddingRight: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  lien: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  vignette: {
    width: 40, height: 40, alignItems: "center", justifyContent: "center", overflow: "hidden",
    backgroundColor: couleurs.surfaceHaute,
  },
  image: { width: "100%", height: "100%" },
  textes: { flex: 1, minWidth: 0, gap: 3 },
  statut: { flexDirection: "row", alignItems: "center", gap: 6 },
  point: { width: 6, height: 6, borderRadius: 3 },
  statutTexte: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.12) },
  nom: { fontFamily: polices.titreMoyen, fontSize: 15, color: couleurs.texte },
  gerer: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: couleurs.bordureForte },
  gererTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteSecondaire },
});
