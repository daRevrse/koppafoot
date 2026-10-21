import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { ClassementDeLaPoule } from "~/components/fiche/ClassementDeLaPoule";
import { Compos } from "~/components/fiche/Compos";
import { BarreFiche, EnTeteMatch } from "~/components/fiche/EnTeteMatch";
import { FaceAFace } from "~/components/fiche/FaceAFace";
import { FilDuMatch } from "~/components/fiche/FilDuMatch";
import { InfosMatch } from "~/components/fiche/InfosMatch";
import { OngletsFiche } from "~/components/fiche/OngletsFiche";
import { StatsDuMatch } from "~/components/fiche/StatsDuMatch";
import { useMaintenant } from "~/hooks/useFiche";
import { usePhotosDeLaFiche } from "~/hooks/usePhotos";
import {
  ongletAffiche, ongletParDefaut, ongletsDeLaFiche, type DonneesDesOnglets, type Fiche, type Onglet,
} from "~/lib/fiche-match";
import { retourSelection } from "~/lib/retour";
import { couleurs, polices } from "~/theme";

/** Au-delà de ce défilement, le score du tableau est sorti de l'écran : la barre le reprend. */
const SEUIL_COMPACT = 150;

/**
 * L'écran d'une fiche de match : la barre du haut, le tableau qui défile, les
 * onglets qui restent collés sous la barre, et le panneau de l'onglet.
 */
export function EcranFiche({ fiche }: { fiche: Fiche }) {
  const router = useRouter();
  // Le chrono et le compte à rebours avancent seuls ; un match joué n'a plus besoin de l'heure.
  const maintenant = useMaintenant(fiche.statut === "live" || fiche.statut === "scheduled");
  const [choix, setChoix] = useState<Onglet | null>(null);
  const [compact, setCompact] = useState(false);
  const photos = usePhotosDeLaFiche(fiche);

  // Le tchat arrive avec la PR C ; le reste, la fiche le sait d'elle-même.
  const donnees: DonneesDesOnglets = { tchatVisible: false };
  const onglets = ongletsDeLaFiche(fiche, donnees);
  const actif = ongletAffiche(choix, onglets, ongletParDefaut(fiche));

  const retour = () => (router.canGoBack() ? router.back() : router.replace("/"));

  let panneau: ReactNode;
  switch (actif) {
    case "feed":
      panneau = <FilDuMatch fiche={fiche} photoHomme={photos.homme} genreHomme={photos.genreHomme} />;
      break;
    case "lineups":
      panneau = <Compos fiche={fiche} photos={photos.parLigne} />;
      break;
    case "infos":
      panneau = <InfosMatch fiche={fiche} />;
      break;
    case "stats":
      panneau = <StatsDuMatch fiche={fiche} />;
      break;
    case "standings":
      panneau = fiche.contexte.poule ? (
        <ClassementDeLaPoule poule={fiche.contexte.poule} domicile={fiche.domicile.teamId} exterieur={fiche.exterieur.teamId} />
      ) : null;
      break;
    case "h2h":
      panneau = <FaceAFace fiche={fiche} />;
      break;
    default:
      panneau = <Text style={styles.provisoire}>{actif}</Text>;
  }

  return (
    <View style={styles.ecran}>
      <StatusBar style="light" />
      <BarreFiche fiche={fiche} maintenant={maintenant} compact={compact} onRetour={retour} />
      <ScrollView
        stickyHeaderIndices={[1]}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const replie = e.nativeEvent.contentOffset.y > SEUIL_COMPACT;
          if (replie !== compact) setCompact(replie);
        }}
        contentContainerStyle={styles.contenu}
      >
        <EnTeteMatch fiche={fiche} maintenant={maintenant} />
        <OngletsFiche
          onglets={onglets}
          actif={actif}
          onChange={(o) => {
            if (o === actif) return;
            retourSelection();
            setChoix(o);
          }}
        />
        <View style={styles.panneau}>{panneau}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingBottom: 48 },
  panneau: { paddingTop: 16, minHeight: 400 },
  provisoire: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteDiscret, padding: 16 },
});
