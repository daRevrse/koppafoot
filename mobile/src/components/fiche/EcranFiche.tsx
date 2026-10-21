import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { aDesStats } from "@/lib/stats-match";
import { BarreFiche, EnTeteMatch } from "~/components/fiche/EnTeteMatch";
import { FilDuMatch } from "~/components/fiche/FilDuMatch";
import { OngletsFiche } from "~/components/fiche/OngletsFiche";
import { useMaintenant } from "~/hooks/useFiche";
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

  // PR A : ni tchat, ni stats, ni classement, ni face-à-face (PR B et C).
  const donnees: DonneesDesOnglets = { tchatVisible: false, hasStats: false, hasStandings: false, hasH2H: false };
  const onglets = ongletsDeLaFiche(fiche, donnees);
  // L'onglet par défaut suit déjà la règle du site, stats comprises : un
  // match joué avec ses faits s'ouvre sur le fil, même avant l'onglet Stats.
  const avecStats = aDesStats(
    fiche.liveState?.events ?? [],
    fiche.liveState?.possession ?? null,
    fiche.statut === "live" && !!fiche.liveState?.isTimerRunning,
  );
  const actif = ongletAffiche(choix, onglets, ongletParDefaut(fiche, avecStats));

  const retour = () => (router.canGoBack() ? router.back() : router.replace("/"));

  let panneau: ReactNode;
  switch (actif) {
    case "feed":
      panneau = <FilDuMatch fiche={fiche} />;
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
