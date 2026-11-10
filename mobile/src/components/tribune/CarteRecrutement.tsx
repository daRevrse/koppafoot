import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { User } from "firebase/auth";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { LIBELLE_POSTE, POSTES_RECHERCHES } from "@/lib/annonce-recrutement";
import type { Post, UserProfile } from "@/types";
import { prevenir } from "~/lib/confirmer";
import { demanderARejoindre } from "~/lib/tribune-firestore";
import { creerStyles, polices, useCouleurs } from "~/theme";

/**
 * La carte d'une annonce de recrutement (CarteRecrutement du site) : l'équipe,
 * les postes cherchés, et le bouton qui envoie la même demande que le
 * mercato, sans quitter la Tribune. Une annonce d'avant (sans `teamId`) garde
 * sa carte, sans bouton : on ne saurait pas à quelle équipe adresser la demande.
 */
export function CarteRecrutement({ post, utilisateur, profil, onSansCompte }: {
  post: Post;
  utilisateur: User | null;
  profil: UserProfile | null;
  onSansCompte: () => void;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const meta = post.metadata;
  const [ouvert, setOuvert] = useState(false);
  const [mot, setMot] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [envoyee, setEnvoyee] = useState(false);
  if (!meta?.teamName) return null;

  const postes = POSTES_RECHERCHES.filter((p) => meta.postes?.includes(p));
  const teamId = meta.teamId;
  const estAuteur = !!utilisateur && utilisateur.uid === post.authorId;
  const prenomAuteur = post.authorName.split(" ")[0] || post.authorName;
  const ligne = meta.closed
    ? "Recrutement terminé"
    : `${postes.length ? `Cherche : ${postes.map((p) => LIBELLE_POSTE[p]).join(" · ")}` : "Recherche de joueurs"}${meta.teamCity ? ` · ${meta.teamCity}` : ""}`;

  async function envoyer() {
    if (!utilisateur || !profil || !teamId || envoi) return;
    setEnvoi(true);
    try {
      const issue = await demanderARejoindre(utilisateur, profil, teamId, mot.trim() || "Vu ton annonce dans la Tribune, je suis partant !");
      if (issue.genre === "fermee") prevenir("Recrutement terminé", "Cette équipe ne recrute plus.");
      else if (issue.genre === "membre") prevenir("Déjà dans l'équipe", `Tu fais déjà partie de ${issue.equipe}.`);
      else {
        setEnvoyee(true);
        setOuvert(false);
      }
    } catch {
      prevenir("Demande non envoyée", "La demande n'est pas partie. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  const ouvrirLEquipe = () => teamId && router.push({ pathname: "/club/[id]", params: { id: teamId } });

  return (
    <View style={[styles.carte, meta.closed && styles.carteFermee]}>
      <Pressable accessibilityRole={teamId ? "link" : undefined} disabled={!teamId} onPress={ouvrirLEquipe} style={styles.equipe}>
        {meta.teamLogo ? (
          <Image source={{ uri: meta.teamLogo }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={[styles.logo, styles.sansLogo]}>
            <Ionicons name="shield-outline" size={20} color={couleurs.info} />
          </View>
        )}
        <View style={styles.textes}>
          <Text style={styles.nom} numberOfLines={1}>{meta.teamName}</Text>
          <Text style={[styles.ligne, meta.closed && styles.ligneFermee]}>{ligne}</Text>
        </View>
      </Pressable>

      {teamId && !meta.closed ? (
        estAuteur ? (
          <Pressable accessibilityRole="link" onPress={() => router.push("/evolution")} style={styles.contour}>
            <Text style={styles.contourTexte}>Voir les demandes</Text>
          </Pressable>
        ) : envoyee ? (
          <View style={styles.envoyee}>
            <Ionicons name="checkmark" size={16} color={couleurs.primaire} />
            <Text style={styles.envoyeeTexte}>Demande envoyée</Text>
          </View>
        ) : ouvert ? (
          <View style={styles.formulaire}>
            <TextInput
              value={mot}
              onChangeText={setMot}
              maxLength={500}
              multiline
              placeholder={`Un mot pour ${prenomAuteur} (facultatif)`}
              placeholderTextColor={couleurs.texteDiscret}
              accessibilityLabel={`Un mot pour ${prenomAuteur} (facultatif)`}
              selectionColor={couleurs.primaire}
              style={styles.mot}
            />
            <View style={styles.boutons}>
              <Pressable accessibilityRole="button" disabled={envoi} onPress={() => void envoyer()} style={[styles.plein, styles.flexible]}>
                {envoi ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />}
                <Text style={styles.pleinTexte}>Envoyer la demande</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setOuvert(false)} style={styles.annuler}>
                <Text style={styles.annulerTexte}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => (utilisateur && profil ? setOuvert(true) : onSansCompte())}
            style={styles.plein}
          >
            <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
            <Text style={styles.pleinTexte}>Demander à rejoindre</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

// Le bleu du recrutement, celui du site (blue-600) : lisible sous un texte blanc sur les deux thèmes.
const BLEU = "#2563eb";

const useStyles = creerStyles((couleurs) => ({
  carte: { marginHorizontal: 14, marginBottom: 8, padding: 12, gap: 12, backgroundColor: couleurs.infoVoile },
  carteFermee: { backgroundColor: couleurs.surfaceHaute },
  equipe: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 40, height: 40 },
  sansLogo: { alignItems: "center", justifyContent: "center", backgroundColor: couleurs.surface },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  nom: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  ligne: { fontFamily: polices.texte, fontSize: 12, color: couleurs.info },
  ligneFermee: { color: couleurs.texteDiscret },
  plein: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: BLEU },
  flexible: { flex: 1 },
  pleinTexte: { fontFamily: polices.texteGras, fontSize: 13, color: "#FFFFFF" },
  contour: { paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: couleurs.bordureForte, backgroundColor: couleurs.surface },
  contourTexte: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.info },
  envoyee: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  envoyeeTexte: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.primaire },
  formulaire: { gap: 8 },
  mot: {
    minHeight: 56, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: "top",
    borderWidth: 1, borderColor: couleurs.bordureForte, backgroundColor: couleurs.surface,
    fontFamily: polices.texte, fontSize: 14, color: couleurs.texte,
  },
  boutons: { flexDirection: "row", gap: 8 },
  annuler: { paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surface },
  annulerTexte: { fontFamily: polices.texteDemi, fontSize: 13, color: couleurs.texteSecondaire },
}));
