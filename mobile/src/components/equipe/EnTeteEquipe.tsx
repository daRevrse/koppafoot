import { Ionicons } from "@expo/vector-icons";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avecVia } from "@/lib/audience";
import { versHex } from "@/lib/couleurs-equipe";
import type { CompTeam, Competition } from "@/types";
import { Ecusson } from "~/components/Ecusson";
import { urlDuSite } from "~/lib/config";
import { initiales } from "~/lib/initiales";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { espacement, polices } from "~/theme";

// Le bandeau d'une équipe (components/team/BandeauEquipe du site) : SOMBRE PAR
// CONSTRUCTION, comme l'en-tête d'une compétition ou d'un match.
const blanc = (opacite: number) => `rgba(255,255,255,${opacite})`;

const PASTILLE: Record<"V" | "N" | "D", { fond: string; texte: string }> = {
  V: { fond: "#34d399", texte: "#000" },
  N: { fond: blanc(0.25), texte: "#fff" },
  D: { fond: "#ef4444", texte: "#fff" },
};

/** La barre du haut : retour, partage, et la fiche du club que l'équipe représente. */
export function BarreEquipe({ equipe, competition, compact, onRetour }: {
  equipe: CompTeam;
  competition: Competition;
  compact: boolean;
  onRetour: () => void;
}) {
  const partager = () => {
    const lien = urlDuSite(avecVia(`/c/${competition.slug}/teams/${equipe.id}`, "partage"));
    void Share.share({ message: `${equipe.name} · ${competition.name}\n${lien}` }).catch(() => {});
  };
  return (
    <SafeAreaView edges={["top"]} style={styles.barreFond}>
      <View style={styles.barre}>
        <Pressable accessibilityRole="button" accessibilityLabel="Revenir à l'écran précédent" onPress={onRetour} hitSlop={8} style={styles.bouton}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text style={[styles.compact, !compact && styles.cache]} numberOfLines={1} accessibilityElementsHidden={!compact}>
          {equipe.name.toUpperCase()}
        </Text>
        {/* Le club derrière l'équipe : sa fiche n'existe que sur le site. */}
        {equipe.claimedByTeamId ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Fiche du club, sur le site"
            onPress={() => ouvrirSurLeSite(`/teams/${equipe.claimedByTeamId}`)}
            hitSlop={8}
            style={styles.bouton}
          >
            <Ionicons name="shield-outline" size={17} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Partager cette équipe" onPress={partager} hitSlop={8} style={styles.bouton}>
          <Ionicons name="share-outline" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/** L'écusson (ou l'initiale sur la couleur de l'équipe), la compétition, le nom, puis poule, rang, forme et effectif. */
export function EnTeteEquipe({ equipe, competition, place, forme, joueurs, onCompetition }: {
  equipe: CompTeam;
  competition: Competition;
  place: string | null;
  forme: ("V" | "N" | "D")[];
  joueurs: string;
  onCompetition: () => void;
}) {
  const couleur = versHex(equipe.color);
  return (
    <View style={styles.entete}>
      <View style={styles.identite}>
        {equipe.logoUrl ? (
          <Ecusson url={equipe.logoUrl} nom={equipe.name} taille={72} />
        ) : (
          <View style={[styles.initiale, couleur ? { backgroundColor: couleur } : null]}>
            <Text style={styles.initialeTexte}>{initiales(equipe.name)}</Text>
          </View>
        )}
        <View style={styles.textes}>
          <Pressable accessibilityRole="link" onPress={onCompetition} hitSlop={6}>
            <Text style={styles.competition} numberOfLines={1}>{competition.name.toUpperCase()}</Text>
          </Pressable>
          <Text style={styles.nom} numberOfLines={2} accessibilityRole="header">{equipe.name.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.puces}>
        {equipe.group ? <Text style={styles.puce}>{`GROUPE ${equipe.group}`}</Text> : null}
        {place ? <Text style={[styles.puce, styles.vert]}>{place.toUpperCase()}</Text> : null}
        {forme.length > 0 ? (
          <View
            style={styles.forme}
            accessible
            accessibilityLabel={`Forme, du plus ancien au plus récent : ${forme.map((r) => ({ V: "victoire", N: "nul", D: "défaite" })[r]).join(", ")}`}
          >
            {forme.map((r, i) => (
              <View key={i} style={[styles.pastille, { backgroundColor: PASTILLE[r].fond }]}>
                <Text style={[styles.pastilleTexte, { color: PASTILLE[r].texte }]}>{r}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Text style={styles.puce}>{joueurs.toUpperCase()}</Text>
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

  entete: { backgroundColor: "#000", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 },
  identite: { flexDirection: "row", alignItems: "center", gap: 16 },
  initiale: {
    width: 72, height: 72, borderWidth: 1, borderColor: blanc(0.15), backgroundColor: blanc(0.1),
    alignItems: "center", justifyContent: "center",
  },
  initialeTexte: { fontFamily: polices.titre, fontSize: 28, color: "#fff" },
  textes: { flex: 1, minWidth: 0 },
  competition: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.16), color: "#6ee7b7" },
  nom: { marginTop: 4, fontFamily: polices.titre, fontSize: 24, lineHeight: 26, color: "#fff" },
  puces: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 18, rowGap: 8, marginTop: 16 },
  puce: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: blanc(0.6) },
  vert: { color: "#6ee7b7" },
  forme: { flexDirection: "row", gap: 2 },
  pastille: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 9 },
});
