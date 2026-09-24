import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as yup from "yup";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { nomPersonne, villeRequise } from "@/lib/champs-valides";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { stylesAuth } from "~/components/EcranAuth";
import { useAuth, type ChampsProfil } from "~/lib/auth";
import { couleurs, polices } from "~/theme";

// Les règles du site, écrites une fois dans lib/champs-valides.
const schema = yup.object({
  firstName: nomPersonne("Prénom"),
  lastName: nomPersonne("Nom"),
  locationCity: villeRequise,
});

type Cle = keyof ChampsProfil;

export default function EcranProfil() {
  const { utilisateur, completerProfil, deconnexion } = useAuth();
  const [valeurs, setValeurs] = useState<ChampsProfil>({ firstName: "", lastName: "", locationCity: "" });
  const [erreurs, setErreurs] = useState<Partial<Record<Cle, string>>>({});
  const [erreurGenerale, setErreurGenerale] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const changer = (cle: Cle) => (texte: string) => setValeurs((v) => ({ ...v, [cle]: texte }));

  async function continuer() {
    setErreurGenerale(null);
    let propres: ChampsProfil;
    try {
      propres = (await schema.validate(valeurs, { abortEarly: false })) as ChampsProfil;
      setErreurs({});
    } catch (e) {
      // `isError` et non `instanceof` : une seule copie de yup est garantie
      // (metro.config.js), mais ce test-là ne dépend pas de cette garantie.
      if (yup.ValidationError.isError(e)) {
        setErreurs(Object.fromEntries(e.inner.map((i) => [i.path, i.message])) as Partial<Record<Cle, string>>);
      }
      return;
    }
    setOccupe(true);
    try {
      // La garde bascule sur les onglets une fois le profil écrit.
      await completerProfil(propres);
    } catch (e) {
      setErreurGenerale(getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  function quitter() {
    Alert.alert("Se déconnecter ?", "Ton compte est créé ; tu compléteras ton profil à la prochaine connexion.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void deconnexion() },
    ]);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>Bienvenue !</Text>
          <Text style={styles.phrase}>{utilisateur?.email ?? "Complète ton profil pour continuer"}</Text>
          <View style={styles.formulaire}>
            <Champ etiquette="Prénom" value={valeurs.firstName} onChangeText={changer("firstName")} erreur={erreurs.firstName} autoComplete="given-name" textContentType="givenName" />
            <Champ etiquette="Nom" value={valeurs.lastName} onChangeText={changer("lastName")} erreur={erreurs.lastName} autoComplete="family-name" textContentType="familyName" />
            <Champ etiquette="Ta ville" value={valeurs.locationCity} onChangeText={changer("locationCity")} erreur={erreurs.locationCity} placeholder="Ta ville" textContentType="addressCity" onSubmitEditing={continuer} />
            {erreurGenerale ? <Text style={stylesAuth.erreur}>{erreurGenerale}</Text> : null}
            <Bouton titre="Continuer" occupe={occupe} onPress={continuer} />
            <Bouton titre="Se déconnecter" variante="lien" onPress={quitter} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingHorizontal: 24, paddingTop: 32, paddingBottom: 32 },
  titre: { fontFamily: polices.titre, fontSize: 26, color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteDiscret, marginTop: 4, marginBottom: 28 },
  formulaire: { gap: 16 },
});
