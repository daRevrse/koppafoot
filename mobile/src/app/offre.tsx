import { ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EnTetePage } from "~/components/EnTetePage";
import { ContenuOffre } from "~/components/offre/ContenuOffre";
import { useOffre } from "~/hooks/useOffre";
import { couleurs } from "~/theme";

/**
 * La page Offre (/offre du site), ouverte à tous : ce que sont KoppaFoot+ et
 * « Pas de pubs », leurs tarifs, et, connecté, où en est le compte. On n'y
 * achète rien (voir lib/offre-app).
 */
export default function EcranOffre() {
  const vue = useOffre();
  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTetePage titre={vue?.titre ?? "Offres"} />
      {vue ? <ContenuOffre vue={vue} /> : <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  chargement: { paddingVertical: 48 },
});
