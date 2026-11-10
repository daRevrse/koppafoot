import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Post } from "@/types";
import { Bouton } from "~/components/Bouton";
import { DefilementClavier } from "~/components/DefilementClavier";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
import { EtatVide } from "~/components/EtatVide";
import { CartePublication } from "~/components/tribune/CartePublication";
import { Composeur } from "~/components/tribune/Composeur";
import { useAuth } from "~/lib/auth";
import { prevenir } from "~/lib/confirmer";
import { apresJaime, trierLeFil } from "~/lib/tribune";
import { basculerLeJaime, ecouterLaTribune } from "~/lib/tribune-firestore";
import { creerStyles, polices } from "~/theme";

/** Le temps que la publication visée par un lien reste cerclée. */
const SURBRILLANCE_MS = 2400;

/**
 * La Tribune (/feed du site) : le fil des publications, en direct, sous le
 * composeur. Elle se lit sans compte, comme le tchat d'un match ; aimer,
 * commenter, publier, repartager et signaler demandent un compte. Un lien
 * (`/feed?post=<id>&commentaires=1`, la notification d'un commentaire) amène
 * sur sa publication, commentaires ouverts.
 */
export default function EcranTribune() {
  const styles = useStyles();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const { post: visee, commentaires } = useLocalSearchParams<{ post?: string; commentaires?: string }>();
  const [fil, setFil] = useState<Post[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(0);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [versY, setVersY] = useState<number | null>(null);
  const [cerclee, setCerclee] = useState<string | null>(null);
  // Le lien n'amène qu'une fois sur sa publication : le fil bouge ensuite sans y ramener.
  const amenee = useRef<string | null>(null);

  useEffect(
    () =>
      ecouterLaTribune(
        utilisateur,
        (posts) => {
          setFil(trierLeFil(posts));
          setErreur(false);
        },
        () => setErreur(true),
      ),
    [utilisateur, essai],
  );

  // « Il y a 3min » avance tout seul.
  useEffect(() => {
    const horloge = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(horloge);
  }, []);

  useEffect(() => {
    if (!cerclee) return;
    const fin = setTimeout(() => setCerclee(null), SURBRILLANCE_MS);
    return () => clearTimeout(fin);
  }, [cerclee]);

  const sansCompte = () => router.push({ pathname: "/connexion", params: { raison: "tribune" } });

  function aimer(postId: string, aimait: boolean) {
    if (!utilisateur) return;
    const uid = utilisateur.uid;
    setFil((f) => (f ? apresJaime(f, postId, uid, aimait) : f));
    basculerLeJaime(postId, uid, aimait).catch(() => {
      // Un cœur qui se remplit puis se vide sans un mot : on le dit.
      setFil((f) => (f ? apresJaime(f, postId, uid, !aimait) : f));
      prevenir("J'aime non enregistré", "Impossible d'enregistrer ton j'aime. Réessaie.");
    });
  }

  let contenu;
  if (fil === null) {
    contenu = erreur ? (
      <EtatVide icone="cloud-offline-outline" texte="La Tribune ne se charge pas. Vérifie ta connexion.">
        <Bouton titre="Réessayer" variante="contour" onPress={() => setEssai((n) => n + 1)} />
      </EtatVide>
    ) : (
      <SqueletteDirect />
    );
  } else if (fil.length === 0) {
    contenu = <EtatVide icone="chatbubbles-outline" texte="Aucune publication. Sois le premier à publier quelque chose !" />;
  } else {
    contenu = (
      <View style={styles.fil}>
        {fil.map((p) => (
          <View
            key={p.id}
            onLayout={(e) => {
              if (p.id !== visee || amenee.current === p.id) return;
              amenee.current = p.id;
              setVersY(Math.max(0, e.nativeEvent.layout.y));
              setCerclee(p.id);
            }}
          >
            <CartePublication
              post={p}
              utilisateur={utilisateur}
              profil={profil}
              maintenant={maintenant}
              onJaime={aimer}
              onSansCompte={sansCompte}
              commentairesOuverts={p.id === visee && commentaires === "1"}
              visee={p.id === cerclee}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTeteOnglet titre="Tribune" />
      {/* Le composeur suit la lecture : il reste calé en haut du fil. */}
      <DefilementClavier contentContainerStyle={styles.contenu} stickyHeaderIndices={[0]} versY={versY}>
        <Composeur utilisateur={utilisateur} profil={profil} onSansCompte={sansCompte} />
        {contenu}
        {fil && fil.length > 0 ? <Text style={styles.fin}>Les trente dernières publications.</Text> : null}
      </DefilementClavier>
    </SafeAreaView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingBottom: 32 },
  fil: { gap: 12, paddingHorizontal: 12, paddingTop: 12 },
  fin: { paddingTop: 20, textAlign: "center", fontFamily: polices.texte, fontSize: 11, color: couleurs.texteDiscret },
}));
