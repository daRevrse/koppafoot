import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
import { couleurs } from "~/theme";

/** L'onglet Espace casquette. Rien derrière pour l'instant : l'en-tête seulement. */
export default function EcranEspace() {
  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTeteOnglet titre="Espace casquette" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
});
