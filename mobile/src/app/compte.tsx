import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Alert, Animated, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { competitionHref } from "@/lib/direct-shared";
import type { UserProfile } from "@/types";
import { Bouton } from "~/components/Bouton";
import { CarteInvitation } from "~/components/compte/CarteInvitation";
import { GroupeCompte, LigneCompte } from "~/components/compte/MenuCompte";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { EnTetePage } from "~/components/EnTetePage";
import { EtatVide } from "~/components/EtatVide";
import { useCompetitionsSuivies } from "~/hooks/useCompetitionsSuivies";
import { useRespiration } from "~/hooks/useRespiration";
import { useSuivi } from "~/hooks/useSuivi";
import { useAuth } from "~/lib/auth";
import { nomDeLOffre, PAGES_D_AIDE } from "~/lib/compte";
import { initiales } from "~/lib/initiales";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { routeDeLaCompetition } from "~/lib/routes";
import { couleurs, espacement, polices } from "~/theme";

/**
 * L'écran Compte : ce que la feuille du bouton Compte du site propose
 * (components/layout/AvatarBottomSheet). Qui l'on est, ou l'invitation à le
 * devenir ; sa fiche et ses compétitions suivies ; l'invitation des amis,
 * l'aide, les paramètres et l'offre, qui ne demandent aucun compte ; puis la
 * déconnexion et, loin du reste, la suppression du compte.
 */
export default function EcranCompte() {
  const { utilisateur, profil, deconnexion } = useAuth();
  const router = useRouter();

  function seDeconnecter() {
    Alert.alert("Se déconnecter ?", undefined, [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => void deconnexion() },
    ]);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTetePage titre="Compte" />
      <ScrollView contentContainerStyle={styles.contenu}>
        {!utilisateur ? (
          <CarteVisiteur />
        ) : profil ? (
          <CarteProfil profil={profil} email={profil.email ?? utilisateur.email} />
        ) : (
          <Text style={styles.texte}>Profil indisponible pour l&apos;instant. Vérifie ta connexion.</Text>
        )}

        {utilisateur ? (
          <GroupeCompte>
            <LigneCompte
              premiere
              icone="person-outline"
              libelle="Ma fiche"
              detail="Ce que les autres voient de toi"
              onPress={() => router.push({ pathname: "/joueur/[uid]", params: { uid: utilisateur.uid } })}
            />
            <LigneCompte icone="create-outline" libelle="Modifier mon profil" surLeSite onPress={() => ouvrirSurLeSite("/profile")} />
          </GroupeCompte>
        ) : null}

        {utilisateur && profil ? <CompetitionsSuivies suivies={profil.followedCompetitionIds ?? []} /> : null}

        <CarteInvitation prenom={profil?.firstName || null} />

        <GroupeCompte titre="Support">
          {PAGES_D_AIDE.map((p, i) => (
            <LigneCompte key={p.chemin} premiere={i === 0} icone={p.icone} libelle={p.libelle} surLeSite onPress={() => ouvrirSurLeSite(p.chemin)} />
          ))}
        </GroupeCompte>

        <GroupeCompte titre="Réglages">
          <LigneCompte premiere icone="settings-outline" libelle="Paramètres" detail="Notifications" onPress={() => router.push("/parametres")} />
          <LigneCompte icone="diamond-outline" libelle={nomDeLOffre(profil)} onPress={() => router.push("/offre")} />
        </GroupeCompte>

        {utilisateur ? (
          <>
            <GroupeCompte>
              <LigneCompte premiere danger icone="log-out-outline" libelle="Se déconnecter" onPress={seDeconnecter} />
            </GroupeCompte>
            {/* La zone sensible du profil, sur le site : loin du reste, et en lien, pas en bouton. */}
            <View style={styles.zone}>
              <Text style={styles.sectionTitre}>ZONE SENSIBLE</Text>
              <Bouton titre="Supprimer mon compte" variante="lien" onPress={() => router.push("/supprimer-compte")} />
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Sans compte : « Visiteur », et ce qu'un compte ouvre (compte.faitesPlus du site). */
function CarteVisiteur() {
  const router = useRouter();
  return (
    <View style={styles.visiteur}>
      <View style={styles.carteLigne}>
        <View style={[styles.avatar, styles.avatarVide]}>
          <Ionicons name="person-outline" size={24} color={couleurs.primaire} />
        </View>
        <View style={styles.identite}>
          <Text style={styles.nom}>Visiteur</Text>
          <Text style={styles.texte}>Aucun compte sur cet appareil</Text>
        </View>
      </View>
      <Text style={styles.invitation}>FAIS-EN PLUS AVEC KOPPAFOOT.</Text>
      <Text style={styles.texte}>
        Suivre tes compétitions, donner ton pronostic, écrire dans le tchat d&apos;un match : tout cela demande un
        compte. Le reste se lit sans.
      </Text>
      <View style={styles.boutons}>
        <Bouton titre="Se connecter" onPress={() => router.push("/connexion")} />
        <Bouton titre="Créer un compte" variante="contour" onPress={() => router.push("/inscription")} />
      </View>
    </View>
  );
}

function CarteProfil({ profil, email }: { profil: UserProfile; email: string | null }) {
  const nom = `${profil.firstName} ${profil.lastName}`.trim();
  return (
    <View style={styles.carte}>
      {profil.profilePictureUrl?.startsWith("http") ? (
        <Image
          source={{ uri: profil.profilePictureUrl }}
          style={styles.avatar}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.avatar, styles.avatarVide]}>
          <Text style={styles.avatarTexte}>{initiales(nom)}</Text>
        </View>
      )}
      <View style={styles.identite}>
        <Text style={styles.nom} numberOfLines={1}>{nom}</Text>
        {email ? <Text style={styles.texte} numberOfLines={1}>{email}</Text> : null}
        {profil.locationCity ? (
          <View style={styles.ville}>
            <Ionicons name="location-outline" size={14} color={couleurs.texteDiscret} />
            <Text style={styles.texteDiscret}>{profil.locationCity}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function CompetitionsSuivies({ suivies }: { suivies: readonly string[] }) {
  const router = useRouter();
  const suivi = useSuivi();
  const { competitions, erreur, garder } = useCompetitionsSuivies(suivies);

  let contenu: ReactNode;
  if (competitions === null) {
    contenu = erreur ? (
      <Text style={styles.texte}>Impossible de charger tes compétitions. Vérifie ta connexion.</Text>
    ) : (
      <SqueletteLignes />
    );
  } else if (competitions.length === 0) {
    contenu = (
      <EtatVide icone="star-outline" texte="Aucune compétition suivie. Touche l'étoile d'une compétition dans le Direct.">
        <Bouton titre="Aller au Direct" variante="contour" onPress={() => router.navigate("/")} />
      </EtatVide>
    );
  } else {
    contenu = (
      <View style={styles.liste}>
        {competitions.map((c) => (
          <EnTeteCompetition
            key={c.id}
            competition={c}
            suivable
            suivie={suivi.ids.has(c.id)}
            onEtoile={() => {
              if (suivi.ids.has(c.id)) garder(c.id);
              void suivi.basculer(c.id);
            }}
            onPress={() => {
              const route = routeDeLaCompetition(c);
              if (route) router.push(route);
              else ouvrirSurLeSite(competitionHref(c));
            }}
            style={styles.ligne}
          />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitre}>COMPÉTITIONS SUIVIES</Text>
      {contenu}
    </View>
  );
}

function SqueletteLignes() {
  const opacite = useRespiration();
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Chargement des compétitions"
      style={[styles.squelette, { opacity: opacite }]}
    >
      <View style={styles.ligneSquelette} />
      <View style={styles.ligneSquelette} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 20 },
  boutons: { alignSelf: "stretch", gap: 12 },
  carte: {
    flexDirection: "row", alignItems: "center", gap: 14, padding: 16,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  visiteur: {
    gap: 12, padding: 16,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  carteLigne: { flexDirection: "row", alignItems: "center", gap: 14 },
  invitation: { marginTop: 4, fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  // L'avatar du site : rounded-full bg-emerald-50 font-black text-emerald-600, en sombre.
  avatarVide: { backgroundColor: couleurs.primaireVoile, alignItems: "center", justifyContent: "center" },
  avatarTexte: { fontFamily: polices.texteNoir, fontSize: 20, color: couleurs.primaire },
  identite: { flex: 1, gap: 2 },
  nom: { fontFamily: polices.texteNoir, fontSize: 18, color: couleurs.texte },
  texte: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },
  ville: { flexDirection: "row", alignItems: "center", gap: 4 },
  texteDiscret: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteDiscret },
  section: { gap: 8 },
  zone: { marginTop: 8, gap: 4, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  sectionTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret },
  liste: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  ligne: { backgroundColor: couleurs.surface },
  squelette: { gap: 1 },
  ligneSquelette: { height: 50, backgroundColor: couleurs.surface },
});
