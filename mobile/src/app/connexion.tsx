import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { CONTEXTE_AUTH_DEFAUT } from "@/config/auth-contextes";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";

export default function EcranConnexion() {
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const { connexionEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function seConnecter() {
    if (!email.trim() || !motDePasse) {
      setErreur("Email et mot de passe requis");
      return;
    }
    setErreur(null);
    setOccupe(true);
    try {
      // Rien d'autre à faire : la garde referme la fenêtre une fois connecté.
      await connexionEmail(email.trim(), motDePasse);
    } catch (e) {
      setErreur(getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  return (
    <EcranAuth
      titre={CONTEXTE_AUTH_DEFAUT.titreConnexion}
      phrase={raison === "suivre" ? "Crée un compte pour suivre cette compétition." : CONTEXTE_AUTH_DEFAUT.phraseConnexion}
    >
      <Champ etiquette="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Champ etiquette="Mot de passe" value={motDePasse} onChangeText={setMotDePasse} secureTextEntry autoComplete="current-password" textContentType="password" onSubmitEditing={seConnecter} />
      {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
      <Bouton titre="Se connecter" occupe={occupe} onPress={seConnecter} />
      <Bouton titre="Mot de passe oublié ?" variante="lien" onPress={() => router.replace("/mot-de-passe")} />
      <Bouton
        titre="Pas encore de compte ? Créer un compte"
        variante="lien"
        onPress={() => router.replace({ pathname: "/inscription", params: raison ? { raison } : {} })}
      />
    </EcranAuth>
  );
}
