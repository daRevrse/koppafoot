import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import type { User } from "firebase/auth";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import type { UserProfile } from "@/types";
import { Visage } from "~/components/tribune/Visage";
import { prevenir } from "~/lib/confirmer";
import { retourImpact } from "~/lib/retour";
import { photoRefusee, signature } from "~/lib/tribune";
import { envoyerLaPhoto } from "~/lib/tribune-api";
import { attacherLaPhoto, publier } from "~/lib/tribune-firestore";
import { creerStyles, polices, useCouleurs } from "~/theme";

type Photo = { uri: string; mimeType?: string | null };

/**
 * Le composeur de la Tribune (celui de /feed) : un texte, une photo si l'on
 * veut, « Publier ». Il reste en haut du fil pendant qu'on lit — l'envie de
 * publier vient en lisant —, replié sur une ligne tant qu'on n'y écrit pas
 * pour laisser l'écran au fil. Sans compte, il invite à se connecter.
 */
export function Composeur({ utilisateur, profil, onSansCompte }: {
  utilisateur: User | null;
  profil: UserProfile | null;
  onSansCompte: () => void;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const [texte, setTexte] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [actif, setActif] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  if (!utilisateur || !profil) {
    return (
      <Pressable accessibilityRole="button" onPress={onSansCompte} style={[styles.bloc, styles.invite]}>
        <Ionicons name="create-outline" size={18} color={couleurs.primaire} />
        <Text style={styles.inviteTexte}>Connecte-toi pour publier dans la Tribune</Text>
      </Pressable>
    );
  }

  const moi = signature(profil);
  const deplie = actif || texte.length > 0 || photo !== null;

  async function choisirUnePhoto() {
    try {
      const choix = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      const image = choix.canceled ? null : choix.assets[0];
      if (!image) return;
      const refus = photoRefusee(image);
      if (refus) {
        prevenir("Photo refusée", refus);
        return;
      }
      setPhoto({ uri: image.uri, mimeType: image.mimeType });
    } catch {
      prevenir("Photos indisponibles", "Impossible d'ouvrir tes photos sur ce téléphone.");
    }
  }

  async function envoyer() {
    const contenu = texte.trim();
    if (!utilisateur || !contenu || envoi) return;
    setEnvoi(true);
    try {
      const id = await publier(utilisateur.uid, moi, contenu);
      if (photo) {
        try {
          await attacherLaPhoto(id, await envoyerLaPhoto(id, photo));
        } catch {
          prevenir("Photo non envoyée", "Ton texte est publié, mais la photo n'est pas partie.");
        }
      }
      retourImpact();
      setTexte("");
      setPhoto(null);
      setActif(false);
    } catch {
      prevenir("Publication impossible", "Ta publication n'est pas partie. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <View style={styles.bloc}>
      <View style={styles.ligne}>
        <Visage nom={moi.authorName} photo={moi.authorAvatar} taille={36} />
        <TextInput
          value={texte}
          onChangeText={setTexte}
          onFocus={() => setActif(true)}
          onBlur={() => setActif(false)}
          multiline
          placeholder="Quoi de neuf sur le terrain ?"
          placeholderTextColor={couleurs.texteDiscret}
          accessibilityLabel="Quoi de neuf sur le terrain ?"
          selectionColor={couleurs.primaire}
          style={[styles.champ, deplie && styles.champDeplie]}
        />
      </View>

      {photo ? (
        <View style={styles.apercu}>
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
          <Pressable accessibilityRole="button" accessibilityLabel="Retirer la photo" onPress={() => setPhoto(null)} hitSlop={8} style={styles.retirer}>
            <Ionicons name="close" size={12} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      {deplie ? (
        <View style={styles.pied}>
          <Pressable accessibilityRole="button" onPress={() => void choisirUnePhoto()} hitSlop={6} style={styles.ajouter}>
            <Ionicons name="image-outline" size={16} color={couleurs.texteSecondaire} />
            <Text style={styles.ajouterTexte}>Photo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Publier"
            aria-disabled={!texte.trim() || envoi}
            disabled={!texte.trim() || envoi}
            onPress={() => void envoyer()}
            style={[styles.publier, (!texte.trim() || envoi) && styles.inactif]}
          >
            {envoi ? <ActivityIndicator size="small" color={couleurs.surBouton} /> : <Ionicons name="send" size={12} color={couleurs.surBouton} />}
            <Text style={styles.publierTexte}>Publier</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  // Fond opaque obligatoire : le fil passe derrière lui.
  bloc: { gap: 10, padding: 12, backgroundColor: couleurs.surface, borderBottomWidth: 1, borderBottomColor: couleurs.bordure },
  invite: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  inviteTexte: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.primaire },
  ligne: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  champ: {
    flex: 1, minHeight: 36, maxHeight: 120, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: "top",
    backgroundColor: couleurs.surfaceHaute, fontFamily: polices.texte, fontSize: 14, color: couleurs.texte,
  },
  champDeplie: { minHeight: 64 },
  apercu: { alignSelf: "flex-start", marginLeft: 46 },
  photo: { width: 120, height: 120 },
  retirer: {
    position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10,
    alignItems: "center", justifyContent: "center", backgroundColor: "#1f2937",
  },
  pied: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginLeft: 46 },
  ajouter: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingRight: 10 },
  ajouterTexte: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire },
  publier: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: couleurs.bouton },
  inactif: { opacity: 0.4 },
  publierTexte: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.surBouton },
}));
