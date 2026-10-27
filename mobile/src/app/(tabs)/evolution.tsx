import { ActivityIndicator, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bouton } from "~/components/Bouton";
import { FicheDuClubContenu } from "~/components/club/EcranClub";
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
import { EtatVide } from "~/components/EtatVide";
import { ChoixDuRole } from "~/components/evolution/ChoixDuRole";
import { ContenuFicheJoueur } from "~/components/joueur/EcranJoueur";
import { useFicheDuClub } from "~/hooks/useFicheDuClub";
import { useFicheJoueur } from "~/hooks/useFicheJoueur";
import { useAuth } from "~/lib/auth";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { titreDeLOnglet } from "~/lib/roles";
import { creerStyles, polices, useCouleurs } from "~/theme";

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

/** Un manager : la fiche du club qu'il dirige. */
function MonClub({ uid }: { uid: string }) {
  const styles = useStyles();
  const { fiche: moi } = useFicheJoueur(uid);
  const club = moi?.genre === "fiche" ? moi.equipes.find((e) => e.dirige) ?? null : null;
  const fiche = useFicheDuClub(club?.id ?? null);
  if (moi === undefined || (club && fiche === undefined)) return <Chargement />;
  if (!club || !fiche) {
    return (
      <EtatVide icone="briefcase-outline" texte="Tu ne diriges pas encore d'équipe. Crée-la sur le site, ou un organisateur t'invitera à gérer une équipe de sa compétition.">
        <Bouton titre="Créer mon équipe sur le site" variante="contour" onPress={() => ouvrirSurLeSite("/mon-equipe")} />
      </EtatVide>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <FicheDuClubContenu fiche={fiche} />
    </ScrollView>
  );
}

/**
 * L'onglet Évolution : sans rôle, l'écran où l'on choisit le sien (joueur,
 * manager, arbitre) ; le rôle choisi, l'onglet prend son nom et montre la
 * fiche qui va avec — la sienne pour un joueur ou un arbitre, celle de son
 * club pour un manager. Changer de rôle ensuite se fait sur le site : ses
 * conséquences (KoppaFoot+, les équipes gelées) n'ont pas encore leur parcours.
 */
export default function EcranEvolution() {
  const styles = useStyles();
  const { utilisateur, profil } = useAuth();
  const role = profil?.evolutionRole ?? null;
  const uid = utilisateur?.uid ?? null;

  let contenu;
  if (uid && (role === "player" || role === "referee")) contenu = <MaFiche uid={uid} />;
  else if (uid && role === "manager") contenu = <MonClub uid={uid} />;
  else {
    contenu = (
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <ChoixDuRole />
      </ScrollView>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTeteOnglet titre={titreDeLOnglet(profil)} />
      {role ? null : <Text style={styles.soustitre}>TON RÔLE SUR KOPPAFOOT</Text>}
      {contenu}
    </SafeAreaView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingBottom: 48 },
  chargement: { paddingVertical: 48 },
  soustitre: { paddingHorizontal: 16, paddingTop: 2, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: 2, color: couleurs.primaire },
}));
