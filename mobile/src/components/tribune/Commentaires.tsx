import { Ionicons } from "@expo/vector-icons";
import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { COMMENTAIRE_MAX } from "@/lib/tribune-commentaires";
import type { Comment } from "@/types";
import { Visage } from "~/components/tribune/Visage";
import { usePhotosDesComptes } from "~/hooks/usePhotos";
import { prevenir } from "~/lib/confirmer";
import { ilYA } from "~/lib/tribune";
import { commenter } from "~/lib/tribune-api";
import { lireLesCommentaires } from "~/lib/tribune-firestore";
import { creerStyles, polices, useCouleurs } from "~/theme";

/**
 * Les commentaires d'une publication (CommentSection du site) : la saisie,
 * réservée à qui a un compte, puis le fil, le plus récent d'abord. Le visage
 * d'un auteur est LU, pas recopié : un commentaire n'enregistre que son nom,
 * la photo vient de /api/public/photos et suit l'auteur quand il en change.
 */
export function Commentaires({ postId, utilisateur, monNom, maPhoto, maintenant, onSansCompte }: {
  postId: string;
  utilisateur: User | null;
  monNom: string;
  maPhoto: string | null;
  maintenant: Date;
  /** Sans compte, toucher le champ mène à la connexion. */
  onSansCompte: () => void;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const [commentaires, setCommentaires] = useState<Comment[] | null>(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let vivant = true;
    lireLesCommentaires(postId)
      .then((c) => {
        if (vivant) setCommentaires(c);
      })
      .catch(() => {
        if (vivant) setCommentaires([]);
      });
    return () => {
      vivant = false;
    };
  }, [postId]);

  const photos = usePhotosDesComptes([...(commentaires ?? []).map((c) => c.authorId), utilisateur?.uid]);

  async function envoyer() {
    const contenu = texte.trim();
    if (!utilisateur || !contenu || envoi) return;
    setEnvoi(true);
    try {
      const { id, authorName } = await commenter(utilisateur, postId, contenu);
      setCommentaires((avant) => [
        { id, authorId: utilisateur.uid, authorName: authorName || monNom, content: contenu, createdAt: new Date().toISOString() },
        ...(avant ?? []),
      ]);
      setTexte("");
    } catch {
      // L'échec ne se tait pas : le texte reste dans le champ, et on le dit.
      prevenir("Commentaire non envoyé", "Ton commentaire n'est pas parti. Réessaie.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <View style={styles.bloc}>
      {utilisateur ? (
        <View style={styles.saisie}>
          <Visage nom={monNom} photo={maPhoto || photos[utilisateur.uid]} taille={32} />
          <View style={styles.champ}>
            <TextInput
              value={texte}
              onChangeText={setTexte}
              placeholder="Écrire un commentaire..."
              placeholderTextColor={couleurs.texteDiscret}
              maxLength={COMMENTAIRE_MAX}
              accessibilityLabel="Écrire un commentaire"
              returnKeyType="send"
              submitBehavior="blurAndSubmit"
              onSubmitEditing={() => void envoyer()}
              selectionColor={couleurs.primaire}
              style={styles.texteSaisi}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Envoyer le commentaire"
              disabled={!texte.trim() || envoi}
              onPress={() => void envoyer()}
              hitSlop={8}
            >
              {envoi
                ? <ActivityIndicator size="small" color={couleurs.texteDiscret} />
                : <Ionicons name="send" size={16} color={texte.trim() ? couleurs.primaire : couleurs.bordureForte} />}
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onSansCompte} style={styles.inviter}>
          <Text style={styles.inviterTexte}>Connecte-toi pour commenter</Text>
        </Pressable>
      )}

      {commentaires === null ? (
        <ActivityIndicator color={couleurs.texteDiscret} style={styles.attente} />
      ) : commentaires.length === 0 ? (
        <Text style={styles.aucun}>{utilisateur ? "Aucun commentaire. Sois le premier !" : "Aucun commentaire."}</Text>
      ) : (
        commentaires.map((c) => (
          <View key={c.id} style={styles.commentaire}>
            <Visage nom={c.authorName} photo={photos[c.authorId]} taille={28} />
            <View style={styles.corps}>
              <View style={styles.bulle}>
                <Text style={styles.auteur}>{c.authorName}</Text>
                <Text style={styles.contenu}>{c.content}</Text>
              </View>
              <Text style={styles.quand}>{ilYA(c.createdAt, maintenant)}</Text>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  bloc: { paddingHorizontal: 14, paddingVertical: 12, gap: 12 },
  saisie: { flexDirection: "row", alignItems: "center", gap: 8 },
  champ: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, minHeight: 38,
    borderRadius: 19, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surfaceHaute,
  },
  texteSaisi: { flex: 1, paddingVertical: 8, fontFamily: polices.texte, fontSize: 14, color: couleurs.texte },
  inviter: { paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: couleurs.bordure },
  inviterTexte: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.primaire },
  attente: { paddingVertical: 8 },
  aucun: { paddingVertical: 4, textAlign: "center", fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
  commentaire: { flexDirection: "row", gap: 8 },
  corps: { flex: 1, minWidth: 0, alignItems: "flex-start" },
  bulle: { maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: couleurs.surfaceHaute },
  auteur: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texte },
  contenu: { marginTop: 1, fontFamily: polices.texte, fontSize: 13, lineHeight: 18, color: couleurs.texteSecondaire },
  quand: { marginTop: 2, marginLeft: 8, fontFamily: polices.texte, fontSize: 10, color: couleurs.texteDiscret },
}));
