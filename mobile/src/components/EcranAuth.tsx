import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { couleurs, polices } from "~/theme";

/** Le cadre commun aux fenêtres de connexion, d'inscription et de mot de passe. */
export function EcranAuth({ titre, phrase, children }: { titre: string; phrase: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.fermer}>Fermer</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>{titre}</Text>
          <Text style={styles.phrase}>{phrase}</Text>
          <View style={styles.formulaire}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const stylesAuth = StyleSheet.create({
  erreur: { fontFamily: polices.texte, fontSize: 13, color: couleurs.erreur },
  info: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
});

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  barre: { paddingHorizontal: 20, paddingVertical: 12, alignItems: "flex-end" },
  fermer: { fontFamily: polices.texteMoyen, fontSize: 15, color: couleurs.texteSecondaire },
  contenu: { paddingHorizontal: 24, paddingBottom: 32 },
  titre: { fontFamily: polices.titre, fontSize: 26, color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteDiscret, marginTop: 4, marginBottom: 28 },
  formulaire: { gap: 16 },
});
