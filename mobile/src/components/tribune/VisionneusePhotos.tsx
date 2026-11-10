import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { polices } from "~/theme";

/**
 * La photo en grand, quand on la touche (VisionneuseMedia du site). Le fil
 * pose les photos dans un cadre carré et les RECADRE pour l'y faire tenir :
 * ce n'est acceptable que si la photo entière reste atteignable. Elle ne fait
 * que montrer : pas de zoom, pas de partage. Toujours sur fond noir.
 */
export function VisionneusePhotos({ urls, index, onIndex, onFermer }: {
  urls: string[];
  /** La photo ouverte, ou `null` : la visionneuse est fermée. */
  index: number | null;
  onIndex: (i: number) => void;
  onFermer: () => void;
}) {
  const ouverte = index !== null && index >= 0 && index < urls.length;
  return (
    <Modal visible={ouverte} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      {ouverte ? (
        <View style={styles.fond} accessibilityViewIsModal accessibilityLabel="Photo en grand">
          <Pressable style={StyleSheet.absoluteFill} onPress={onFermer} accessibilityLabel="Fermer la photo" />
          <Image source={{ uri: urls[index] }} style={styles.photo} contentFit="contain" pointerEvents="none" />
          <SafeAreaView style={styles.barre} edges={["top"]} pointerEvents="box-none">
            {urls.length > 1 ? <Text style={styles.compteur}>{`${index + 1} / ${urls.length}`}</Text> : <View />}
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onFermer} hitSlop={10} style={styles.rond}>
              <Ionicons name="close" size={20} color="#FFFFFF" />
            </Pressable>
          </SafeAreaView>
          {urls.length > 1 ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Photo précédente"
                onPress={() => onIndex((index - 1 + urls.length) % urls.length)}
                hitSlop={10}
                style={[styles.rond, styles.fleche, styles.gauche]}
              >
                <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Photo suivante"
                onPress={() => onIndex((index + 1) % urls.length)}
                hitSlop={10}
                style={[styles.rond, styles.fleche, styles.droite]}
              >
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: "rgba(0,0,0,0.94)", justifyContent: "center" },
  photo: { width: "100%", height: "100%" },
  barre: {
    position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  compteur: { fontFamily: polices.texteGras, fontSize: 13, color: "#FFFFFF" },
  rond: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)" },
  fleche: { position: "absolute", top: "50%", marginTop: -20 },
  gauche: { left: 12 },
  droite: { right: 12 },
});
