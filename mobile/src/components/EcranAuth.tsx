import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/** Le cadre commun aux fenêtres de connexion, d'inscription et de mot de passe. */
export function EcranAuth({ titre, phrase, children }: { titre: string; phrase: string; children: ReactNode }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  return (
    <SafeAreaView style={styles.ecran} edges={["top", "bottom"]}>
      <View style={styles.barre}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => [styles.fermer, pressed && styles.fermerPresse]}
        >
          <Ionicons name="close" size={20} color={couleurs.texte} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.ecran} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
          <Text style={styles.titre}>{titre.toUpperCase()}</Text>
          <Text style={styles.phrase}>{phrase}</Text>
          <View style={styles.formulaire}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export const useStylesAuth = creerStyles((couleurs) => ({
  erreur: { fontFamily: polices.texte, fontSize: 13, color: couleurs.erreur },
  info: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
}));

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  barre: { paddingHorizontal: 16, paddingVertical: 8, alignItems: "flex-end" },
  // Un petit bouton-icône : rond, comme ceux du site (rounded-full).
  fermer: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: couleurs.bordure,
    alignItems: "center", justifyContent: "center",
  },
  fermerPresse: { backgroundColor: couleurs.surfaceHaute },
  contenu: { paddingHorizontal: 24, paddingBottom: 32 },
  // classeTitreAuth : font-display font-black, capitales, interlignage 0,95.
  titre: { fontFamily: polices.titre, fontSize: 30, lineHeight: 30, letterSpacing: espacement(30, -0.02), color: couleurs.texte },
  phrase: { fontFamily: polices.texte, fontSize: 14, lineHeight: 22, color: couleurs.texteSecondaire, marginTop: 12, marginBottom: 32 },
  formulaire: { gap: 16 },
}));
