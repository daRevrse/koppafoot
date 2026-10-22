import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "~/lib/auth";
import { initiales } from "~/lib/initiales";
import { useNotifications } from "~/lib/notifications";
import { couleurs, espacement, polices } from "~/theme";

/** La cloche et sa pastille : le nombre de notifications non lues, « 9+ » au-delà. */
function Cloche() {
  const router = useRouter();
  const { nonLues } = useNotifications();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nonLues > 0 ? `Notifications, ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
      onPress={() => router.push("/notifications")}
      hitSlop={6}
      style={({ pressed }) => [styles.bouton, pressed && styles.presse]}
    >
      <Ionicons name="notifications-outline" size={20} color={couleurs.texte} />
      {nonLues > 0 ? (
        <View style={styles.pastille}>
          <Text style={styles.pastilleTexte}>{nonLues > 9 ? "9+" : nonLues}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Le compte : la photo ou les initiales ; sans compte, la silhouette. */
function BoutonCompte() {
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const nom = profil ? `${profil.firstName} ${profil.lastName}`.trim() : "";
  const photo = profil?.profilePictureUrl?.startsWith("http") ? profil.profilePictureUrl : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={utilisateur ? "Mon compte" : "Se connecter"}
      onPress={() => router.push("/compte")}
      hitSlop={6}
      style={({ pressed }) => [styles.bouton, pressed && styles.presse]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : utilisateur && nom ? (
        <View style={[styles.avatar, styles.avatarVide]}>
          <Text style={styles.avatarTexte}>{initiales(nom)}</Text>
        </View>
      ) : (
        <Ionicons name="person-circle-outline" size={26} color={couleurs.texte} />
      )}
    </Pressable>
  );
}

/**
 * L'en-tête d'un onglet : son titre, et à droite la cloche puis le compte,
 * comme l'en-tête du site. Sans compte, pas de cloche : rien à sonner.
 */
export function EnTeteOnglet({ titre, surTitre }: { titre: string; surTitre?: string }) {
  const { utilisateur } = useAuth();
  return (
    <View style={styles.entete}>
      <View style={styles.titres}>
        {surTitre ? <Text style={styles.surTitre}>{surTitre.toUpperCase()}</Text> : null}
        <Text style={styles.titre} accessibilityRole="header" numberOfLines={1}>{titre.toUpperCase()}</Text>
      </View>
      <View style={styles.actions}>
        {utilisateur ? <Cloche /> : null}
        <BoutonCompte />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  entete: { flexDirection: "row", alignItems: "flex-end", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  titres: { flex: 1, minWidth: 0 },
  surTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.22), color: couleurs.primaire },
  // Les titres du site : font-display font-black, en capitales.
  titre: { fontFamily: polices.titre, fontSize: 28, lineHeight: 32, color: couleurs.texte },
  actions: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 2 },
  bouton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  presse: { backgroundColor: couleurs.surfaceHaute },
  pastille: {
    position: "absolute", top: 4, right: 3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    alignItems: "center", justifyContent: "center", backgroundColor: couleurs.boutonDanger,
  },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 9, color: "#fff" },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  avatarVide: { backgroundColor: couleurs.primaireVoile, alignItems: "center", justifyContent: "center" },
  avatarTexte: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.primaire },
});
