import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Fiche } from "~/lib/fiche-match";
import { couleurs, polices } from "~/theme";

/** L'écran d'une fiche de match. Provisoire : l'en-tête et les onglets arrivent aux tâches suivantes. */
export function EcranFiche({ fiche }: { fiche: Fiche }) {
  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <ScrollView>
        <Text style={styles.titre}>
          {fiche.domicile.nom} {fiche.domicile.score ?? ""} – {fiche.exterieur.score ?? ""} {fiche.exterieur.nom}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  titre: { fontFamily: polices.texteNoir, fontSize: 16, color: couleurs.texte, padding: 16 },
});
