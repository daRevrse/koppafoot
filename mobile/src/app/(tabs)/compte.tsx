import { useRouter } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { useAuth } from "~/lib/auth";
import { couleurs, polices } from "~/theme";

export default function EcranCompte() {
  const { utilisateur, profil, deconnexion } = useAuth();
  const router = useRouter();

  if (!utilisateur) {
    return (
      <SafeAreaView style={styles.ecran} edges={["top"]}>
        <Text style={styles.titre}>Compte</Text>
        <View style={styles.bloc}>
          <Text style={styles.texte}>Un compte pour suivre tes compétitions et les retrouver en tête du Direct.</Text>
          <Bouton titre="Se connecter" onPress={() => router.push("/connexion")} />
          <Bouton titre="Créer un compte" variante="contour" onPress={() => router.push("/inscription")} />
        </View>
      </SafeAreaView>
    );
  }

  function seDeconnecter() {
    Alert.alert("Se déconnecter ?", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void deconnexion() },
    ]);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <Text style={styles.titre}>Compte</Text>
      <View style={styles.bloc}>
        {profil ? (
          <>
            <Text style={styles.nom}>{profil.firstName} {profil.lastName}</Text>
            <Text style={styles.texte}>{profil.email ?? utilisateur.email}</Text>
            {profil.locationCity ? <Text style={styles.texte}>{profil.locationCity}</Text> : null}
          </>
        ) : (
          <Text style={styles.texte}>Profil indisponible pour l&apos;instant. Vérifie ta connexion.</Text>
        )}
        <Bouton titre="Se déconnecter" variante="contour" onPress={seDeconnecter} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte, paddingHorizontal: 16, paddingTop: 8 },
  bloc: { padding: 16, gap: 12 },
  nom: { fontFamily: polices.titreMoyen, fontSize: 20, color: couleurs.texte },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
});
