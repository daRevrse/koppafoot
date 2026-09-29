import { doc, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, Switch, Text, View } from "react-native";
import { fr } from "@/i18n/fr";
import { CATEGORIES_PUSH, type PushCategory } from "@/lib/push-categories";
import { useAuth } from "~/lib/auth";
import { db } from "~/lib/firebase";
import { activerPushMobile, desactiverPushMobile, etatPushMobile, type EtatPushMobile } from "~/lib/push";
import { couleurs, polices } from "~/theme";

/**
 * L'interrupteur des notifications de CE téléphone, dans l'onglet Compte.
 *
 * L'état se relit au retour au premier plan : la phrase du refus envoie dans
 * les réglages du téléphone, et l'utilisateur qui y autorise les
 * notifications doit retrouver ici un interrupteur qui marche.
 */
export function ReglagePush({ uid }: { uid: string }) {
  const { profil, rafraichirProfil } = useAuth();
  const [etat, setEtat] = useState<EtatPushMobile | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Les catégories valent pour le COMPTE (le serveur filtre à l'envoi), comme
  // sur le site : l'absence de réglage vaut oui.
  const prefs = Object.fromEntries(
    CATEGORIES_PUSH.map((c) => [c, profil?.pushPrefs?.[c] !== false]),
  ) as Record<PushCategory, boolean>;

  async function basculerCategorie(c: PushCategory) {
    setOccupe(true);
    try {
      // L'objet entier, pas une clé pointée : voir usePushNotifications (site).
      await updateDoc(doc(db, "users", uid), { push_prefs: { ...prefs, [c]: !prefs[c] } });
      await rafraichirProfil();
    } catch {
      // Le réglage reste tel quel à l'écran : il sera relu à la prochaine ouverture.
    } finally {
      setOccupe(false);
    }
  }

  useEffect(() => {
    const relire = () => void etatPushMobile().then(setEtat).catch(() => setEtat("inactif"));
    relire();
    const abonnement = AppState.addEventListener("change", (s) => { if (s === "active") relire(); });
    return () => abonnement.remove();
  }, []);

  if (etat === null || etat === "non-supporte") return null;

  async function basculer(actif: boolean) {
    setOccupe(true);
    try {
      setEtat(actif ? await activerPushMobile(uid) : await desactiverPushMobile(uid));
    } catch {
      setEtat(await etatPushMobile().catch(() => "inactif" as const));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.ligne}>
        <View style={styles.textes}>
          <Text style={styles.libelle}>Notifications</Text>
          <Text style={styles.detail}>Convocations, buts de tes compétitions, résultats à valider.</Text>
        </View>
        <Switch
          value={etat === "actif"}
          disabled={occupe || etat === "refuse"}
          onValueChange={(v) => void basculer(v)}
          trackColor={{ true: couleurs.primaireClair, false: couleurs.bordure }}
        />
      </View>
      {etat === "refuse" ? (
        <Text style={styles.detail} onPress={() => void Linking.openSettings()}>
          Bloquées dans les réglages du téléphone. Touche ici pour les autoriser, puis reviens.
        </Text>
      ) : null}
      {etat === "actif" ? (
        <View style={styles.categories}>
          {CATEGORIES_PUSH.map((c) => (
            <View key={c} style={styles.ligne}>
              <View style={styles.textes}>
                <Text style={styles.categorie}>{fr[`notifs.cat.${c}`]}</Text>
                <Text style={styles.note}>{fr[`notifs.cat.${c}.detail`]}</Text>
              </View>
              <Switch
                value={prefs[c]}
                disabled={occupe}
                onValueChange={() => void basculerCategorie(c)}
                trackColor={{ true: couleurs.primaireClair, false: couleurs.bordure }}
              />
            </View>
          ))}
          <Text style={styles.note}>{fr["notifs.categoriesNote"]}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { gap: 6, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: couleurs.bordure },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12 },
  textes: { flex: 1, gap: 2 },
  libelle: { fontFamily: polices.titreMoyen, fontSize: 16, color: couleurs.texte },
  detail: { fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
  note: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteSecondaire },
  categories: { gap: 8, paddingTop: 4 },
  categorie: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texte },
});
