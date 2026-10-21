import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EtatVide } from "~/components/EtatVide";
import { couleurs } from "~/theme";

/**
 * Une page qui n'est pas encore là (une fiche, une compétition) : le bandeau
 * noir et des lignes qui respirent, ou « introuvable ».
 */
export function EtatFiche({ introuvable, texte = "Ce match n'existe pas ou n'est plus disponible." }: {
  introuvable: boolean;
  texte?: string;
}) {
  const router = useRouter();
  if (introuvable) {
    return (
      <SafeAreaView style={styles.ecran}>
        <EtatVide icone="search-outline" texte={texte}>
          <Bouton titre="Retour" variante="contour" onPress={() => router.back()} />
        </EtatVide>
      </SafeAreaView>
    );
  }
  return (
    <View style={styles.ecran}>
      <SafeAreaView edges={["top"]} style={styles.bandeau} />
      <SqueletteDirect />
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  // La hauteur du tableau d'affichage, pour que rien ne saute à l'arrivée du match.
  bandeau: { height: 240, backgroundColor: "#000" },
});
