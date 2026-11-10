import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { User } from "firebase/auth";
import { useState } from "react";
import { Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { avecVia } from "@/lib/audience";
import { SYSTEM_AUTHOR_ID, type Post, type UserProfile } from "@/types";
import { CarteRecrutement } from "~/components/tribune/CarteRecrutement";
import { Commentaires } from "~/components/tribune/Commentaires";
import { FeuilleDActions, type ActionDeFeuille } from "~/components/tribune/FeuilleDActions";
import { Visage } from "~/components/tribune/Visage";
import { VisionneusePhotos } from "~/components/tribune/VisionneusePhotos";
import { SITE_URL, urlDuSite } from "~/lib/config";
import { confirmer, prevenir } from "~/lib/confirmer";
import { ouvrirLeLien } from "~/lib/push";
import { retourSelection } from "~/lib/retour";
import { etiquetteDuType, ilYA, initialesDAuteur, lienDeLaPublication, roleAffiche, signature } from "~/lib/tribune";
import { signaler } from "~/lib/tribune-api";
import { modifierLaPublication, publier, supprimerLaPublication } from "~/lib/tribune-firestore";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

const ROUGE_DU_COEUR = "#ef4444";

/**
 * Une publication de la Tribune (PostCard du site) : son auteur, son texte,
 * ce qu'elle porte (un résultat, une annonce de recrutement, une citation,
 * des photos), puis son pied — ce qu'elle a reçu à gauche (j'aime,
 * commentaires, repartages), ce qu'on en fait à droite (la partager dehors).
 * Sans compte elle se lit ; les gestes qui écrivent mènent à la connexion.
 */
export function CartePublication({ post, utilisateur, profil, maintenant, onJaime, onSansCompte, commentairesOuverts = false, visee = false }: {
  post: Post;
  utilisateur: User | null;
  profil: UserProfile | null;
  maintenant: Date;
  onJaime: (postId: string, aimait: boolean) => void;
  onSansCompte: () => void;
  /** Les commentaires ouverts d'emblée : on arrive de la notification d'un commentaire. */
  commentairesOuverts?: boolean;
  /** La publication qu'un lien visait : cerclée un instant. */
  visee?: boolean;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const [commentaires, setCommentaires] = useState(commentairesOuverts);
  const [edition, setEdition] = useState<string | null>(null);
  const [repartage, setRepartage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [menu, setMenu] = useState(false);
  const [photo, setPhoto] = useState<number | null>(null);
  const [supprimee, setSupprimee] = useState(false);

  const officiel = post.authorId === SYSTEM_AUTHOR_ID;
  const aMoi = !!utilisateur && post.authorId === utilisateur.uid;
  const moi = profil ? signature(profil) : null;
  const type = etiquetteDuType(post.type);
  const role = roleAffiche(post.authorRole);
  const photos = post.mediaUrls ?? [];

  const ouvrirLAuteur = () => router.push({ pathname: "/joueur/[uid]", params: { uid: post.authorId } });

  async function sauvegarder() {
    const texte = (edition ?? "").trim();
    if (!texte || texte === post.content) {
      setEdition(null);
      return;
    }
    setOccupe(true);
    try {
      await modifierLaPublication(post.id, texte);
      setEdition(null);
    } catch {
      prevenir("Modification impossible", "Ta publication n'a pas été modifiée. Réessaie.");
    } finally {
      setOccupe(false);
    }
  }

  async function supprimer() {
    if (!(await confirmer({ titre: "Supprimer cette publication ?", message: "Elle disparaît de la Tribune pour tout le monde.", action: "Supprimer" }))) return;
    setSupprimee(true);
    try {
      await supprimerLaPublication(post.id);
    } catch {
      setSupprimee(false);
      prevenir("Suppression impossible", "Ta publication n'a pas été supprimée. Réessaie.");
    }
  }

  async function signalerLaPublication() {
    if (!utilisateur) {
      onSansCompte();
      return;
    }
    try {
      const { duplicate } = await signaler(utilisateur, post.id);
      prevenir(duplicate ? "Déjà signalée" : "Signalement envoyé", duplicate ? "Tu as déjà signalé cette publication." : "Merci : la modération va la regarder.");
    } catch (e) {
      prevenir("Signalement non envoyé", e instanceof Error ? e.message : "Le signalement a échoué.");
    }
  }

  async function repartager() {
    if (!utilisateur || !moi || occupe) return;
    setOccupe(true);
    try {
      await publier(utilisateur.uid, moi, (repartage ?? "").trim(), { postId: post.id, authorName: post.authorName, content: post.content });
      setRepartage(null);
    } catch {
      prevenir("Partage impossible", "La publication n'a pas été repartagée. Réessaie.");
    } finally {
      setOccupe(false);
    }
  }

  const partager = () =>
    void Share.share({
      message: `${post.authorName} sur KoppaFoot\n${post.content.slice(0, 160)}\n${urlDuSite(avecVia(lienDeLaPublication(post.id), "partage"))}`,
    }).catch(() => {});

  const actions: ActionDeFeuille[] = aMoi
    ? [
      { libelle: "Modifier", icone: "pencil-outline", onPress: () => setEdition(post.content) },
      { libelle: "Supprimer", icone: "trash-outline", danger: true, onPress: () => void supprimer() },
    ]
    : [{ libelle: "Signaler", icone: "flag-outline", onPress: () => void signalerLaPublication() }];

  if (supprimee) return null;

  return (
    <View style={[styles.carte, post.pinned && styles.carteEpinglee, visee && styles.carteVisee]}>
      {post.pinned ? (
        <View style={styles.epingle}>
          <Ionicons name="pin" size={11} color={couleurs.primaire} />
          <Text style={styles.epingleTexte}>Épinglé</Text>
        </View>
      ) : null}

      <View style={styles.entete}>
        {/* Le compte officiel n'a pas de fiche à visiter : ni son nom ni son visage ne sont des liens. */}
        <Pressable
          accessibilityRole={officiel ? undefined : "link"}
          accessibilityLabel={officiel ? undefined : `Ouvrir la fiche de ${post.authorName}`}
          disabled={officiel}
          onPress={ouvrirLAuteur}
          style={styles.auteur}
        >
          <Visage
            nom={post.authorName}
            photo={officiel && !post.authorAvatar?.startsWith("http") ? `${SITE_URL}/icons/icon-192.png` : post.authorAvatar}
            initiales={initialesDAuteur(post)}
          />
          <View style={styles.identite}>
            <View style={styles.nomEtRole}>
              <Text style={styles.nom} numberOfLines={1}>{post.authorName}</Text>
              {officiel ? (
                <View style={styles.officiel} accessibilityLabel="Compte officiel KoppaFoot">
                  <Ionicons name="checkmark-circle" size={14} color={couleurs.primaire} />
                </View>
              ) : role ? (
                <Text style={styles.role}>{role.toUpperCase()}</Text>
              ) : null}
            </View>
            <Text style={styles.quand}>{ilYA(post.createdAt, maintenant)}</Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Options de la publication"
          onPress={() => setMenu(true)}
          hitSlop={8}
          style={styles.options}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={couleurs.texteDiscret} />
        </Pressable>
      </View>

      {type ? (
        <View style={styles.type}>
          <Text style={styles.typeTexte}>{type.toUpperCase()}</Text>
        </View>
      ) : null}

      <View style={styles.contenu}>
        {edition !== null ? (
          <View style={styles.edition}>
            <TextInput
              value={edition}
              onChangeText={setEdition}
              multiline
              autoFocus
              accessibilityLabel="Modifier la publication"
              selectionColor={couleurs.primaire}
              style={styles.zoneDeTexte}
            />
            <View style={styles.boutons}>
              <Pressable accessibilityRole="button" disabled={occupe} onPress={() => void sauvegarder()} style={styles.plein}>
                <Text style={styles.pleinTexte}>Sauvegarder</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setEdition(null)} style={styles.contour}>
                <Text style={styles.contourTexte}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        ) : post.content ? (
          <Text style={styles.texte}>{post.content}</Text>
        ) : null}
        {/* Une publication officielle mène quelque part : une annonce dont on ne peut rien faire n'est que du bruit. */}
        {edition === null && post.link ? (
          <Pressable accessibilityRole="link" onPress={() => void ouvrirLeLien(post.link as string, true)} hitSlop={6} style={styles.voir}>
            <Text style={styles.voirTexte}>Voir</Text>
            <Ionicons name="chevron-forward" size={13} color={couleurs.primaire} />
          </Pressable>
        ) : null}
      </View>

      {post.metadata?.repostOf ? (
        <View style={styles.citation}>
          <Text style={styles.citationAuteur}>{`↩ ${post.metadata.repostOf.authorName}`}</Text>
          <Text style={styles.citationTexte} numberOfLines={3}>{post.metadata.repostOf.content}</Text>
        </View>
      ) : null}

      {post.type === "match_result" && post.metadata ? (
        <View style={styles.resultat} accessible accessibilityLabel={`${post.metadata.homeTeam} ${post.metadata.scoreHome}, ${post.metadata.awayTeam} ${post.metadata.scoreAway}`}>
          <Text style={[styles.equipe, styles.equipeDomicile]} numberOfLines={2}>{post.metadata.homeTeam}</Text>
          <View style={styles.score}>
            <Text style={styles.scoreTexte}>{`${post.metadata.scoreHome ?? "–"} - ${post.metadata.scoreAway ?? "–"}`}</Text>
          </View>
          <Text style={styles.equipe} numberOfLines={2}>{post.metadata.awayTeam}</Text>
        </View>
      ) : null}

      {post.type === "team_announcement" && post.metadata?.teamName ? (
        <CarteRecrutement post={post} utilisateur={utilisateur} profil={profil} onSansCompte={onSansCompte} />
      ) : null}

      {/* Les photos dans un cadre carré : deux publications d'affilée gardent le même rythme.
          Ce que le cadre coupe reste atteignable : un appui ouvre la photo entière. */}
      {photos.length > 0 ? (
        <View style={styles.photos}>
          {photos.map((url, i) => (
            <Pressable
              key={url}
              accessibilityRole="imagebutton"
              accessibilityLabel={`Voir la photo ${i + 1} en grand`}
              onPress={() => setPhoto(i)}
              style={photos.length === 1 ? styles.photoSeule : styles.photoDeux}
            >
              <Image source={{ uri: url }} style={styles.photo} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.pied}>
        <View style={styles.recu}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="J'aime"
            aria-pressed={post.isLiked}
            onPress={() => {
              if (!utilisateur) {
                onSansCompte();
                return;
              }
              retourSelection();
              onJaime(post.id, post.isLiked);
            }}
            hitSlop={4}
            style={styles.geste}
          >
            <Ionicons name={post.isLiked ? "heart" : "heart-outline"} size={18} color={post.isLiked ? ROUGE_DU_COEUR : couleurs.texteSecondaire} />
            {post.likes.length > 0 ? <Text style={[styles.compte, post.isLiked && { color: ROUGE_DU_COEUR }]}>{post.likes.length}</Text> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Commentaires"
            aria-expanded={commentaires}
            onPress={() => setCommentaires((v) => !v)}
            hitSlop={4}
            style={styles.geste}
          >
            <Ionicons name="chatbubble-outline" size={17} color={commentaires ? couleurs.primaire : couleurs.texteSecondaire} />
            {post.commentCount > 0 ? <Text style={[styles.compte, commentaires && { color: couleurs.primaire }]}>{post.commentCount}</Text> : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Repartager dans la Tribune"
            onPress={() => (utilisateur && moi ? setRepartage("") : onSansCompte())}
            hitSlop={4}
            style={styles.geste}
          >
            <Ionicons name="repeat-outline" size={19} color={repartage !== null ? couleurs.primaire : couleurs.texteSecondaire} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Partager" onPress={partager} hitSlop={4} style={styles.geste}>
          <Ionicons name="share-social-outline" size={17} color={couleurs.texteSecondaire} />
          <Text style={styles.partager}>Partager</Text>
        </Pressable>
      </View>

      {repartage !== null ? (
        <View style={styles.repartage}>
          <Text style={styles.repartageTitre}>
            {"Ajouter un commentaire "}
            <Text style={styles.optionnel}>(optionnel)</Text>
          </Text>
          <View style={[styles.citation, styles.citationDuRepartage]}>
            <Text style={styles.citationAuteur}>{post.authorName}</Text>
            <Text style={styles.citationTexte} numberOfLines={2}>{post.content}</Text>
          </View>
          <TextInput
            value={repartage}
            onChangeText={setRepartage}
            multiline
            autoFocus
            placeholder="Ton commentaire..."
            placeholderTextColor={couleurs.texteDiscret}
            accessibilityLabel="Ton commentaire sur ce repartage"
            selectionColor={couleurs.primaire}
            style={styles.zoneDeTexte}
          />
          <View style={styles.boutons}>
            <Pressable accessibilityRole="button" disabled={occupe} onPress={() => void repartager()} style={styles.plein}>
              <Ionicons name="repeat-outline" size={14} color={couleurs.surBouton} />
              <Text style={styles.pleinTexte}>Repartager</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setRepartage(null)} style={styles.contour}>
              <Text style={styles.contourTexte}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {commentaires ? (
        <View style={styles.commentaires}>
          <Commentaires
            postId={post.id}
            utilisateur={utilisateur}
            monNom={moi?.authorName ?? ""}
            maPhoto={profil?.profilePictureUrl ?? null}
            maintenant={maintenant}
            onSansCompte={onSansCompte}
          />
        </View>
      ) : null}

      <FeuilleDActions ouverte={menu} actions={actions} onFermer={() => setMenu(false)} />
      <VisionneusePhotos urls={photos} index={photo} onIndex={setPhoto} onFermer={() => setPhoto(null)} />
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  carte: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  carteEpinglee: { borderWidth: 1, borderColor: couleurs.primaire },
  carteVisee: { borderWidth: 2, borderColor: couleurs.primaire },
  epingle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: couleurs.primaireVoile },
  epingleTexte: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.primaire },
  entete: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", padding: 14, paddingBottom: 0, gap: 8 },
  auteur: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
  identite: { flex: 1, minWidth: 0, gap: 1 },
  nomEtRole: { flexDirection: "row", alignItems: "center", gap: 8 },
  nom: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  officiel: { justifyContent: "center" },
  role: {
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: couleurs.bordure, backgroundColor: couleurs.surfaceHaute,
    fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.1), color: couleurs.texteSecondaire,
  },
  quand: { fontFamily: polices.texte, fontSize: 12, color: couleurs.texteDiscret },
  options: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  type: { alignSelf: "flex-start", marginLeft: 14, marginTop: 10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: couleurs.primaireVoile },
  typeTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.08), color: couleurs.primaire },
  contenu: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, gap: 8 },
  texte: { fontFamily: polices.texte, fontSize: 14, lineHeight: 21, color: couleurs.texte },
  voir: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  voirTexte: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.primaire },
  edition: { gap: 8 },
  zoneDeTexte: {
    minHeight: 64, paddingHorizontal: 12, paddingVertical: 8, textAlignVertical: "top",
    borderWidth: 1, borderColor: couleurs.bordureForte, backgroundColor: couleurs.surfaceHaute,
    fontFamily: polices.texte, fontSize: 14, color: couleurs.texte,
  },
  boutons: { flexDirection: "row", gap: 8 },
  plein: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: couleurs.bouton },
  pleinTexte: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.surBouton },
  contour: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: couleurs.bordure },
  contourTexte: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire },
  citation: {
    marginHorizontal: 14, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 3,
    borderLeftWidth: 4, borderLeftColor: couleurs.primaire, backgroundColor: couleurs.surfaceHaute,
  },
  citationDuRepartage: { marginHorizontal: 0, marginBottom: 0 },
  citationAuteur: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteSecondaire },
  citationTexte: { fontFamily: polices.texte, fontSize: 12, lineHeight: 17, fontStyle: "italic", color: couleurs.texteSecondaire },
  resultat: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 14, marginBottom: 8, padding: 12, backgroundColor: couleurs.surfaceHaute },
  equipe: { flex: 1, fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  equipeDomicile: { textAlign: "right" },
  score: { paddingHorizontal: 12, paddingVertical: 4, backgroundColor: couleurs.surface },
  scoreTexte: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  photos: { flexDirection: "row", gap: 4, marginHorizontal: 14, marginBottom: 8 },
  photoSeule: { flex: 1, aspectRatio: 1, backgroundColor: couleurs.surfaceHaute },
  photoDeux: { flex: 1, aspectRatio: 1, backgroundColor: couleurs.surfaceHaute },
  photo: { flex: 1 },
  pied: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  recu: { flexDirection: "row", alignItems: "center" },
  geste: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 11 },
  compte: { fontFamily: polices.texteDemi, fontSize: 13, fontVariant: ["tabular-nums"], color: couleurs.texteSecondaire },
  partager: { fontFamily: polices.texteDemi, fontSize: 13, color: couleurs.texteSecondaire },
  repartage: { gap: 8, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  repartageTitre: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire },
  optionnel: { color: couleurs.texteDiscret },
  commentaires: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
}));
