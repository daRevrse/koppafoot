import { Ionicons } from "@expo/vector-icons";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { messageDInvitation } from "~/lib/compte";
import { couleurs, espacement, polices } from "~/theme";

/**
 * « Invite tes amis » (InviteCard du site) : le bloc vert, le mégaphone en
 * filigrane, et la feuille de partage du téléphone.
 */
export function CarteInvitation({ prenom }: { prenom: string | null }) {
  return (
    <View style={styles.carte}>
      <Ionicons name="megaphone-outline" size={84} color="rgba(255,255,255,0.1)" style={styles.filigrane} aria-hidden />
      <Text style={styles.titre}>INVITE TES AMIS</Text>
      <Text style={styles.texte}>Le foot se suit à plusieurs. Partage KoppaFoot à ceux qui jouent avec toi.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void Share.share({ message: messageDInvitation(prenom) }).catch(() => {})}
        style={({ pressed }) => [styles.bouton, pressed && styles.presse]}
      >
        <Ionicons name="share-social-outline" size={14} color="#111827" />
        <Text style={styles.boutonTexte}>PARTAGER LE LIEN</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { overflow: "hidden", padding: 16, gap: 6, backgroundColor: couleurs.bouton },
  filigrane: { position: "absolute", right: -12, bottom: -14 },
  titre: { fontFamily: polices.titre, fontSize: 17, color: couleurs.surBouton },
  texte: { maxWidth: 260, fontFamily: polices.texteGras, fontSize: 12, lineHeight: 17, color: "rgba(255,255,255,0.78)" },
  bouton: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: "#ffffff",
  },
  presse: { backgroundColor: "#a7f3d0" },
  boutonTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: "#111827" },
});
