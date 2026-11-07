import { ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
import { EtatVide } from "~/components/EtatVide";
import { ChoixDuRole } from "~/components/evolution/ChoixDuRole";
import { ContenuFicheJoueur } from "~/components/joueur/EcranJoueur";
import { EcranMonClub } from "~/components/mon-club/EcranMonClub";
import { useFicheJoueur } from "~/hooks/useFicheJoueur";
import { useAuth } from "~/lib/auth";
import { titreDeLOnglet } from "~/lib/roles";
import { creerStyles, useCouleurs } from "~/theme";

function Chargement() {
  const styles = useStyles();
  const couleurs = useCouleurs();
  return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;
}

/** Un joueur, un arbitre : sa propre fiche, celle que les autres voient. */
function MaFiche({ uid }: { uid: string }) {
  const styles = useStyles();
  const { fiche, forme } = useFicheJoueur(uid);
  if (fiche === undefined) return <Chargement />;
  if (fiche?.genre !== "fiche") {
    return <EtatVide icone="person-outline" texte="Ta fiche n'est pas encore publique. Elle le sera dès que tu joueras dans une équipe." />;
  }
  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <ContenuFicheJoueur fiche={fiche} forme={forme} />
    </ScrollView>
  );
}

/**
 * L'onglet Évolution : sans rôle, l'écran où l'on choisit le sien, une pile
 * de cartes joueur, manager, arbitre (ChoixDuRole) ; le rôle choisi, l'onglet prend son nom et montre la
 * fiche qui va avec — la sienne pour un joueur ou un arbitre — ou, pour un
 * manager, le club qu'il gère (EcranMonClub). Changer de rôle ensuite se fait
 * sur le site : ses conséquences (KoppaFoot+, les équipes gelées) n'ont pas
 * encore leur parcours.
 */
export default function EcranEvolution() {
  const styles = useStyles();
  const { utilisateur, profil } = useAuth();
  const role = profil?.evolutionRole ?? null;
  const uid = utilisateur?.uid ?? null;

  let contenu;
  if (uid && (role === "player" || role === "referee")) contenu = <MaFiche uid={uid} />;
  else if (uid && role === "manager") contenu = <EcranMonClub uid={uid} />;
  // La pile tient l'écran ; le dos de la carte défile seul, au-dessus du clavier.
  else contenu = <ChoixDuRole />;

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTeteOnglet titre={titreDeLOnglet(profil)} />
      {contenu}
    </SafeAreaView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingBottom: 48 },
  chargement: { paddingVertical: 48 },
}));
