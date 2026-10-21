import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { cibleCompetition } from "@/lib/audience";
import type { CompMatch } from "@/types";
import { BarreOnglets } from "~/components/BarreOnglets";
import { Apercu } from "~/components/competition/Apercu";
import { BarreCompetition, EnTeteDeCompetition } from "~/components/competition/BandeauCompetition";
import { Calendrier } from "~/components/competition/Calendrier";
import { Classement } from "~/components/competition/Classement";
import { Equipes } from "~/components/competition/Equipes";
import { StatsCompetition } from "~/components/competition/StatsCompetition";
import { TableauFinal } from "~/components/competition/TableauFinal";
import { EtatFiche } from "~/components/fiche/EtatFiche";
import { useAudience } from "~/hooks/useAudience";
import { useCompetition } from "~/hooks/useCompetition";
import { libellesDesOnglets, ongletsDeLaCompetition, type OngletCompetition } from "~/lib/page-competition";
import { retourSelection } from "~/lib/retour";
import { couleurs } from "~/theme";

/** Au-delà de ce défilement, le nom de l'en-tête est sorti de l'écran : la barre le reprend. */
const SEUIL_COMPACT = 110;

/**
 * La page d'une compétition : la barre du haut, l'en-tête qui défile, les
 * onglets qui restent collés sous la barre, et le panneau de l'onglet.
 */
export function EcranCompetition({ cid }: { cid: string }) {
  const router = useRouter();
  const { competition, matchs, equipes, abonnes, introuvable } = useCompetition(cid);
  // Une visite par appareil et par jour, comme la page du site (lib/audience).
  useAudience(competition ? cibleCompetition(competition.id) : null);
  const [choix, setChoix] = useState<OngletCompetition>("apercu");
  const [compact, setCompact] = useState(false);

  if (!competition) {
    return <EtatFiche introuvable={introuvable} texte="Cette compétition n'existe pas ou n'est plus disponible." />;
  }

  const onglets = ongletsDeLaCompetition(competition);
  const actif = onglets.includes(choix) ? choix : "apercu";
  const retour = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const ouvrir = (mid: string) => router.push({ pathname: "/match/[cid]/[mid]", params: { cid: competition.id, mid } });
  const ouvrirMatch = (m: CompMatch) => ouvrir(m.id);
  const changer = (o: OngletCompetition) => {
    if (o === actif) return;
    retourSelection();
    setChoix(o);
  };

  let panneau: ReactNode;
  switch (actif) {
    case "apercu":
      panneau = <Apercu competition={competition} matchs={matchs} equipes={equipes} onOuvrir={ouvrirMatch} onOnglet={changer} />;
      break;
    case "matchs":
      panneau = <Calendrier competition={competition} matchs={matchs} onOuvrir={ouvrirMatch} />;
      break;
    case "classement":
      panneau = <Classement competition={competition} matchs={matchs} equipes={equipes} />;
      break;
    case "tableau":
      panneau = <TableauFinal matchs={matchs} onOuvrir={ouvrirMatch} />;
      break;
    case "stats":
      panneau = <StatsCompetition competition={competition} matchs={matchs} equipes={equipes} onOuvrir={ouvrir} />;
      break;
    case "equipes":
      panneau = <Equipes competition={competition} matchs={matchs} equipes={equipes} />;
      break;
  }

  return (
    <View style={styles.ecran}>
      <StatusBar style="light" />
      <BarreCompetition competition={competition} compact={compact} onRetour={retour} />
      <ScrollView
        stickyHeaderIndices={[1]}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const replie = e.nativeEvent.contentOffset.y > SEUIL_COMPACT;
          if (replie !== compact) setCompact(replie);
        }}
        contentContainerStyle={styles.contenu}
      >
        <EnTeteDeCompetition competition={competition} abonnes={abonnes} />
        <BarreOnglets onglets={onglets} libelles={libellesDesOnglets(competition.competitionType ?? null)} actif={actif} onChange={changer} />
        <View style={styles.panneau}>{panneau}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingBottom: 48 },
  panneau: { paddingTop: 16, minHeight: 400 },
});
