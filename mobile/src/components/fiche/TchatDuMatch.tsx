import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { TCHAT_MAX, tchatOuvert, type MessageDuTchat } from "@/lib/tchat";
import { useAuth } from "~/lib/auth";
import { envoyerMessage, signalerMessage, supprimerMessage } from "~/lib/interactions-match";
import { creerStyles, polices, useCouleurs } from "~/theme";

const heure = (ms: number | null) =>
  ms == null ? "" : new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Le tchat d'un match (components/match/TchatDuMatch). Tout le monde le lit ;
 * on y écrit avec un compte, pendant le direct ; après le coup de sifflet, il
 * se relit. Son auteur et les modérateurs suppriment un message, les autres
 * le signalent. Le serveur refait tous les contrôles.
 */
export function TchatDuMatch({ mid, cid, statut, messages, peutModerer }: {
  mid: string;
  cid: string | null;
  statut: string;
  messages: MessageDuTchat[];
  peutModerer: boolean;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const { utilisateur } = useAuth();
  const router = useRouter();
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const liste = useRef<ScrollView>(null);
  // On ne ramène en bas que celui qui y était : on ne vole pas la lecture d'un ancien message.
  const enBas = useRef(true);
  const ouvert = tchatOuvert(statut);

  async function envoyer() {
    const t = texte.trim();
    if (!t || envoi) return;
    setEnvoi(true);
    try {
      await envoyerMessage(mid, cid, t);
      setTexte("");
      enBas.current = true;
    } catch (e) {
      Alert.alert("Le message n'est pas parti", e instanceof Error ? e.message : undefined);
    } finally {
      setEnvoi(false);
    }
  }

  async function agir(id: string, action: "supprimer" | "signaler") {
    setEnCours(id);
    try {
      if (action === "supprimer") await supprimerMessage(mid, cid, id);
      else {
        await signalerMessage(mid, cid, id);
        Alert.alert("Message signalé", "L'équipe KoppaFoot va le regarder.");
      }
    } catch (e) {
      Alert.alert("Une erreur est survenue", e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(null);
    }
  }

  function supprimer(id: string) {
    Alert.alert("Supprimer ce message ?", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => void agir(id, "supprimer") },
    ]);
  }

  return (
    <View style={styles.cadre}>
      {!ouvert ? (
        <Text style={styles.bandeau}>Le match est terminé : le tchat se relit, il ne s&apos;écrit plus.</Text>
      ) : null}

      <ScrollView
        ref={liste}
        nestedScrollEnabled
        style={styles.liste}
        contentContainerStyle={styles.listeContenu}
        onContentSizeChange={() => {
          if (enBas.current) liste.current?.scrollToEnd({ animated: false });
        }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          enBas.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 40;
        }}
        scrollEventThrottle={64}
        accessibilityLiveRegion="polite"
      >
        {messages.length === 0 ? (
          <Text style={styles.vide}>Personne n&apos;a encore écrit. Lance la discussion !</Text>
        ) : (
          messages.map((m) => {
            const sien = utilisateur?.uid === m.auteurUid;
            return (
              <View key={m.id} style={styles.message}>
                <View style={styles.messageTextes}>
                  <Text style={styles.meta}>
                    <Text style={[styles.auteur, sien && styles.auteurSien]}>{m.auteurNom}</Text>
                    {`  ${heure(m.creeLeMs)}`}
                  </Text>
                  {m.supprime ? (
                    <Text style={styles.supprime}>Message supprimé</Text>
                  ) : (
                    <Text style={styles.texte}>{m.texte}</Text>
                  )}
                </View>
                {!m.supprime && utilisateur ? (
                  <View style={styles.actions}>
                    {sien || peutModerer ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Supprimer ce message" disabled={enCours === m.id} onPress={() => supprimer(m.id)} hitSlop={6} style={styles.action}>
                        {enCours === m.id ? <ActivityIndicator size="small" color={couleurs.texteDiscret} /> : <Ionicons name="trash-outline" size={14} color={couleurs.texteDiscret} />}
                      </Pressable>
                    ) : null}
                    {!sien ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Signaler ce message" disabled={enCours === m.id} onPress={() => void agir(m.id, "signaler")} hitSlop={6} style={styles.action}>
                        <Ionicons name="flag-outline" size={14} color={couleurs.texteDiscret} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {ouvert ? (
        <View style={styles.pied}>
          {utilisateur ? (
            <>
              <View style={styles.saisie}>
                <TextInput
                  value={texte}
                  onChangeText={(t) => setTexte(t.slice(0, TCHAT_MAX))}
                  placeholder="Écris pendant le match…"
                  placeholderTextColor={couleurs.texteDiscret}
                  maxLength={TCHAT_MAX}
                  returnKeyType="send"
                  onSubmitEditing={() => void envoyer()}
                  keyboardAppearance="dark"
                  selectionColor={couleurs.primaire}
                  accessibilityLabel="Message"
                  style={styles.champ}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Envoyer"
                  disabled={envoi || !texte.trim()}
                  onPress={() => void envoyer()}
                  style={({ pressed }) => [styles.envoyer, (envoi || !texte.trim()) && styles.inactif, pressed && styles.presse]}
                >
                  {envoi ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
                </Pressable>
              </View>
              {texte.length > TCHAT_MAX - 40 ? <Text style={styles.compteur}>{`${texte.length}/${TCHAT_MAX}`}</Text> : null}
            </>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: "/connexion", params: { raison: "tchat" } })}
              style={({ pressed }) => [styles.connexion, pressed && styles.presse]}
            >
              <Text style={styles.connexionTexte}>Connecte-toi pour écrire</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  cadre: { marginHorizontal: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  bandeau: {
    paddingHorizontal: 16, paddingVertical: 10, fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire,
    backgroundColor: couleurs.surfaceHaute,
  },
  liste: { maxHeight: 420, minHeight: 180 },
  listeContenu: { padding: 16, gap: 12 },
  vide: { paddingVertical: 40, textAlign: "center", fontFamily: polices.texte, fontSize: 14, color: couleurs.texteDiscret },
  message: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  messageTextes: { flex: 1, minWidth: 0 },
  meta: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
  auteur: { fontFamily: polices.texteGras, color: couleurs.texte },
  auteurSien: { color: couleurs.primaire },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texte },
  supprime: { fontFamily: polices.texte, fontSize: 14, fontStyle: "italic", color: couleurs.texteDiscret },
  actions: { flexDirection: "row", gap: 2 },
  action: { padding: 6 },
  pied: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  saisie: { flexDirection: "row", alignItems: "center", gap: 8 },
  champ: {
    flex: 1, minWidth: 0, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.fond,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: polices.texte, fontSize: 15, color: couleurs.texte,
  },
  envoyer: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.bouton },
  inactif: { opacity: 0.4 },
  presse: { opacity: 0.8 },
  compteur: { marginTop: 4, textAlign: "right", fontFamily: polices.texte, fontSize: 11, color: couleurs.texteDiscret },
  connexion: { paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: couleurs.bordure, alignItems: "center" },
  connexionTexte: { fontFamily: polices.texteDemi, fontSize: 14, color: couleurs.texteSecondaire },
}));
