import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { GroupeCompte, LigneTheme } from "~/components/compte/MenuCompte";
import { EnTetePage } from "~/components/EnTetePage";
import { ReglagePush } from "~/components/ReglagePush";
import { useAuth } from "~/lib/auth";
import { creerStyles, espacement, polices } from "~/theme";

/**
 * Les paramètres (la page /parametres du site) : ce qu'on règle une fois et
 * qu'on ne traverse pas à chaque passage dans le Compte. Le thème, gardé sur
 * ce téléphone, avec ou sans compte ; les notifications de ce téléphone, qui
 * demandent un compte : c'est à lui qu'elles s'adressent.
 */
export default function EcranParametres() {
  const styles = useStyles();
  const { utilisateur } = useAuth();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTetePage titre="Paramètres" />
      <ScrollView contentContainerStyle={styles.contenu}>
        <Text style={styles.sousTitre}>Le thème et les notifications de ce téléphone.</Text>
        <GroupeCompte titre="Apparence">
          <LigneTheme premiere />
        </GroupeCompte>
        <Text style={styles.note}>Auto suit le réglage du téléphone : clair le jour, sombre le soir s&apos;il bascule.</Text>
        <View style={styles.section}>
          <Text style={styles.titre} accessibilityRole="header">NOTIFICATIONS</Text>
          {utilisateur ? (
            <ReglagePush uid={utilisateur.uid} />
          ) : (
            <View style={styles.cadre}>
              <Text style={styles.texte}>
                Les notifications suivent un compte : le direct de tes compétitions, la vie de ton équipe, ce qui
                t&apos;est adressé.
              </Text>
              <Bouton titre="Se connecter" variante="contour" onPress={() => router.push("/connexion")} />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32, gap: 20 },
  sousTitre: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
  note: { marginTop: -12, fontFamily: polices.texte, fontSize: 12, lineHeight: 17, color: couleurs.texteDiscret },
  section: { gap: 8 },
  titre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret },
  cadre: {
    gap: 14, padding: 16,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  texte: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: couleurs.texteSecondaire },
}));
