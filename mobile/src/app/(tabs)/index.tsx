import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cleDuJour, libelleDuJour } from "@/lib/dates";
import { competitionHref, entryKey, matchHref, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { Competition } from "@/types";
import { Bouton } from "~/components/Bouton";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { FiltresDirect } from "~/components/direct/FiltresDirect";
import { LigneMatch } from "~/components/direct/LigneMatch";
import { SelecteurJour } from "~/components/direct/SelecteurJour";
import { useDirect } from "~/hooks/useDirect";
import { useSuivi } from "~/hooks/useSuivi";
import { urlDuSite } from "~/lib/config";
import { compterEnDirect, groupesDuTableau, jourLePlusProche, type FiltreDirect } from "~/lib/direct-tableau";
import { couleurs, polices } from "~/theme";

/** La page web, dans le navigateur intégré, jusqu'à la fiche native du lot suivant. */
function ouvrirSurLeSite(chemin: string) {
  void WebBrowser.openBrowserAsync(urlDuSite(chemin), { toolbarColor: couleurs.fond, controlsColor: couleurs.primaire });
}

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

type Section = { key: string; competition: Competition; data: Entry[] };

export default function EcranDirect() {
  const { feed, majA, horsLigne, chargement, rafraichir } = useDirect();
  const suivi = useSuivi();
  const [jour, setJour] = useState(() => cleDuJour(new Date()));
  const [filtre, setFiltre] = useState<FiltreDirect>("tous");

  const sections = useMemo<Section[]>(
    () =>
      feed
        ? groupesDuTableau(feed, { jour, filtre, suivies: suivi.ids }).map((g) => ({
            key: g.competition.id,
            competition: g.competition,
            data: g.entries,
          }))
        : [],
    [feed, jour, filtre, suivi.ids],
  );
  const proche = feed && sections.length === 0 && filtre === "tous" ? jourLePlusProche(feed, jour) : null;

  if (!feed) {
    return (
      <SafeAreaView style={[styles.ecran, styles.centre]}>
        {horsLigne ? (
          <>
            <Text style={styles.vide}>Impossible de charger le Direct.</Text>
            <Bouton titre="Réessayer" variante="contour" onPress={rafraichir} occupe={chargement} />
          </>
        ) : (
          <ActivityIndicator color={couleurs.primaire} />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <Text style={styles.titre}>Direct</Text>
      <SelecteurJour jour={jour} onChange={setJour} />
      <FiltresDirect filtre={filtre} enDirect={compterEnDirect(feed)} onChange={setFiltre} />
      {horsLigne && majA ? (
        <Text style={styles.bandeau}>Pas de connexion — mis à jour à {heure(majA)}</Text>
      ) : null}
      <SectionList<Entry, Section>
        sections={sections}
        keyExtractor={entryKey}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section }) => {
          const c = section.competition;
          return (
            <EnTeteCompetition
              competition={c}
              suivable={c.id !== FRIENDLY_COMP_ID && !isWorldComp(c.id)}
              suivie={suivi.ids.has(c.id)}
              onEtoile={() => void suivi.basculer(c.id)}
              onPress={() => ouvrirSurLeSite(competitionHref(c))}
            />
          );
        }}
        renderItem={({ item }) => <LigneMatch entree={item} onPress={() => ouvrirSurLeSite(matchHref(item))} />}
        refreshControl={<RefreshControl refreshing={chargement} onRefresh={rafraichir} colors={[couleurs.primaire]} />}
        ListEmptyComponent={
          <View style={styles.centre}>
            <Text style={styles.vide}>
              {filtre === "favoris"
                ? "Touche l'étoile d'une compétition pour la retrouver ici."
                : filtre === "direct"
                  ? "Aucun match en cours."
                  : "Aucun match ce jour-là."}
            </Text>
            {proche ? (
              <Bouton titre={`Voir ${libelleDuJour(proche).toLowerCase()}`} variante="contour" onPress={() => setJour(proche)} />
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte, paddingHorizontal: 16, paddingTop: 8 },
  bandeau: {
    fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteSecondaire,
    backgroundColor: couleurs.fondTertiaire, paddingHorizontal: 16, paddingVertical: 6,
  },
  vide: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire, textAlign: "center" },
});
