import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { Bouton } from "~/components/Bouton";
import { useAuth } from "~/lib/auth";
import { googleDisponible, messageErreurGoogle } from "~/lib/google";
import { couleurs, polices } from "~/theme";

/**
 * « Continuer avec Google », puis « ou » avant le formulaire e-mail.
 *
 * Google en tête, comme sur le site : c'est le chemin le plus court, pas le
 * seul. Rien ne s'affiche là où le module n'existe pas (Expo Go, iOS).
 */
export function ConnexionGoogle({ onErreur }: { onErreur: (message: string | null) => void }) {
  const { connexionGoogle } = useAuth();
  const [occupe, setOccupe] = useState(false);

  if (!googleDisponible()) return null;

  async function continuer() {
    onErreur(null);
    setOccupe(true);
    try {
      // Réussie, la garde referme la fenêtre ; annulée, on rend la main.
      if (!(await connexionGoogle())) setOccupe(false);
    } catch (e) {
      onErreur(messageErreurGoogle(e) ?? getAuthErrorMessage(e));
      setOccupe(false);
    }
  }

  return (
    <>
      <Bouton titre="Continuer avec Google" variante="contour" occupe={occupe} onPress={continuer} />
      <View style={styles.separateur}>
        <View style={styles.trait} />
        <Text style={styles.ou}>ou</Text>
        <View style={styles.trait} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  separateur: { flexDirection: "row", alignItems: "center", gap: 12 },
  trait: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: couleurs.bordure },
  ou: { fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteDiscret },
});
