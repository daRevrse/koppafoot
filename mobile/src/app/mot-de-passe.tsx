import { useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";

export default function EcranMotDePasse() {
  const { motDePasseOublie } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function envoyer() {
    if (!email.trim()) {
      setErreur("Email requis");
      return;
    }
    setErreur(null);
    setOccupe(true);
    try {
      await motDePasseOublie(email.trim());
      setEnvoye(true);
    } catch (e) {
      setErreur(getAuthErrorMessage(e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <EcranAuth titre="Mot de passe oublié" phrase="On t'envoie un lien pour en choisir un nouveau.">
      {envoye ? (
        // Pas de « compte introuvable » : ce serait dire à n'importe qui quelles adresses ont un compte.
        <Text style={stylesAuth.info}>
          Si un compte existe pour cette adresse, un e-mail vient de partir. Pense à regarder dans les indésirables.
        </Text>
      ) : (
        <>
          <Champ etiquette="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" onSubmitEditing={envoyer} />
          {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
          <Bouton titre="Envoyer le lien" occupe={occupe} onPress={envoyer} />
        </>
      )}
      <Bouton titre="Retour à la connexion" variante="lien" onPress={() => router.replace("/connexion")} />
    </EcranAuth>
  );
}
