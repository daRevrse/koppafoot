import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { CONTEXTE_AUTH_DEFAUT } from "@/config/auth-contextes";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";

export default function EcranInscription() {
  const { raison } = useLocalSearchParams<{ raison?: string }>();
  const { inscriptionEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreurs, setErreurs] = useState<{ email?: string; motDePasse?: string }>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  async function creer() {
    // Les règles de /signup : un e-mail, six caractères au moins (le minimum de Firebase).
    const suivantes = {
      email: /^\S+@\S+\.\S+$/.test(email.trim()) ? undefined : "Email invalide",
      motDePasse: motDePasse.length >= 6 ? undefined : "Min. 6 caractères",
    };
    setErreurs(suivantes);
    if (suivantes.email || suivantes.motDePasse) return;
    setErreur(null);
    setOccupe(true);
    try {
      // La garde bascule ensuite sur l'écran profil.
      await inscriptionEmail(email.trim(), motDePasse);
    } catch (e) {
      setErreur(getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  return (
    <EcranAuth
      titre={CONTEXTE_AUTH_DEFAUT.titreInscription}
      phrase={raison === "suivre" ? "Crée un compte pour suivre cette compétition." : CONTEXTE_AUTH_DEFAUT.phraseInscription}
    >
      <Champ etiquette="Email" value={email} onChangeText={setEmail} erreur={erreurs.email} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Champ etiquette="Mot de passe" value={motDePasse} onChangeText={setMotDePasse} erreur={erreurs.motDePasse} secureTextEntry autoComplete="new-password" textContentType="newPassword" onSubmitEditing={creer} />
      {erreur ? <Text style={stylesAuth.erreur}>{erreur}</Text> : null}
      <Bouton titre="Créer mon compte" occupe={occupe} onPress={creer} />
      <Bouton
        titre="Déjà un compte ? Se connecter"
        variante="lien"
        onPress={() => router.replace({ pathname: "/connexion", params: raison ? { raison } : {} })}
      />
    </EcranAuth>
  );
}
