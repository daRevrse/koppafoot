import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { fr } from "@/i18n/fr";
import { Bouton } from "~/components/Bouton";
import { Champ } from "~/components/Champ";
import { EcranAuth, stylesAuth } from "~/components/EcranAuth";
import { useAuth } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { auth } from "~/lib/firebase";
import {
  confirmationValide, issueDeLaSuppression, MOT_DE_CONFIRMATION, type IssueSuppression,
} from "~/lib/suppression-compte";
import { couleurs, espacement, polices } from "~/theme";

async function supprimerLeCompte(saisie: string): Promise<IssueSuppression> {
  const u = auth.currentUser;
  if (!u) return { genre: "reconnexion" };
  try {
    const rep = await fetch(`${API_URL}/api/account/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` },
      body: JSON.stringify({ confirmation: saisie.trim().toUpperCase() }),
    });
    return issueDeLaSuppression(rep.status, await rep.json().catch(() => null));
  } catch {
    return { genre: "erreur", message: fr["suppr.echouee"] };
  }
}

/**
 * Supprimer son compte (la zone sensible du profil, sur le site). Le mot à
 * taper protège du geste machinal ; le serveur refait tout : le mot, une
 * connexion récente, et rien qui appartienne à d'autres. Une fois le compte
 * supprimé, la déconnexion referme la fenêtre (la garde de la pile).
 */
export default function EcranSuppression() {
  const { deconnexion } = useAuth();
  const router = useRouter();
  const [saisie, setSaisie] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [issue, setIssue] = useState<IssueSuppression | null>(null);
  const arme = confirmationValide(saisie);

  async function supprimer() {
    if (!arme || occupe) return;
    setOccupe(true);
    setIssue(null);
    const r = await supprimerLeCompte(saisie);
    if (r.genre === "faite") {
      Alert.alert(fr["suppr.faite"]);
      await deconnexion().catch(() => {});
      return;
    }
    setIssue(r);
    setOccupe(false);
  }

  return (
    <EcranAuth titre={fr["suppr.titre"]} phrase={fr["suppr.texte"]}>
      <Champ
        etiquette={fr["suppr.tapez"].replace("{mot}", MOT_DE_CONFIRMATION)}
        value={saisie}
        onChangeText={setSaisie}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        onSubmitEditing={() => void supprimer()}
      />

      {issue?.genre === "obstacles" ? (
        <View style={styles.cadre}>
          <Text style={styles.cadreTitre}>{fr["suppr.aFaire"].toUpperCase()}</Text>
          {issue.obstacles.map((o) => (
            <Text key={o} style={styles.obstacle}>{`•  ${o}`}</Text>
          ))}
        </View>
      ) : null}
      {issue?.genre === "reconnexion" ? (
        <View style={styles.cadre}>
          <Text style={stylesAuth.info}>{fr["suppr.reconnexion"]}</Text>
          <Bouton titre="Se déconnecter" variante="contour" onPress={() => void deconnexion()} />
        </View>
      ) : null}
      {issue?.genre === "erreur" ? <Text style={stylesAuth.erreur}>{issue.message}</Text> : null}

      <Bouton titre={fr["suppr.definitivement"]} variante="danger" disabled={!arme} occupe={occupe} onPress={() => void supprimer()} />
      <Bouton titre={fr["suppr.annuler"]} variante="lien" onPress={() => router.back()} />
    </EcranAuth>
  );
}

const styles = StyleSheet.create({
  cadre: { gap: 10, padding: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  cadreTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.erreur },
  obstacle: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texte },
});
