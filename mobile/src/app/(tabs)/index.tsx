import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cleDuJour, libelleDuJour } from "@/lib/dates";
import { competitionHref, entryKey, matchHref, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import type { Competition } from "@/types";
import { Bouton } from "~/components/Bouton";
import { CarteMatch } from "~/components/direct/CarteMatch";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { FiltresDirect } from "~/components/direct/FiltresDirect";
import { FriseDesJours } from "~/components/direct/FriseDesJours";
import { PointDirect } from "~/components/direct/PointDirect";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EtatVide } from "~/components/EtatVide";
import { useDirect } from "~/hooks/useDirect";
import { useSuivi } from "~/hooks/useSuivi";
import {
  compterEnDirect, groupesDuTableau, jourLePlusProche, joursAvecMatchs, joursDeLaFrise, type FiltreDirect,
} from "~/lib/direct-tableau";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { retourSelection } from "~/lib/retour";
import { couleurs, polices, rayons } from "~/theme";

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

type Section = { key: string; competition: Competition; data: Entry[] };

const AUCUN_JOUR: ReadonlySet<string> = new Set();

export default function EcranDirect() {
  const { feed, majA, horsLigne, chargement, rafraichir } = useDirect();
  const suivi = useSuivi();
  const [aujourdhui] = useState(() => cleDuJour(new Date()));
  const [jour, setJour] = useState(aujourdhui);
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
  const jours = useMemo(() => joursDeLaFrise(aujourdhui, jour), [aujourdhui, jour]);
  const avecMatchs = useMemo(() => (feed ? joursAvecMatchs(feed) : AUCUN_JOUR), [feed]);
  const enDirect = feed ? compterEnDirect(feed) : 0;
  const proche = feed && sections.length === 0 && filtre === "tous" ? jourLePlusProche(feed, jour) : null;

  function choisirJour(j: string) {
    if (j === jour) return;
    retourSelection();
    setJour(j);
  }

  function choisirFiltre(f: FiltreDirect) {
    if (f === filtre) return;
    retourSelection();
    setFiltre(f);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <View style={styles.entete}>
        <Text style={styles.titre}>Direct</Text>
        {enDirect > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${enDirect} en direct : voir les matchs en cours`}
            onPress={() => choisirFiltre("direct")}
            hitSlop={8}
            style={styles.pastille}
          >
            <PointDirect />
            <Text style={styles.pastilleTexte}>{enDirect} en direct</Text>
          </Pressable>
        ) : null}
      </View>
      <FriseDesJours
        jours={jours}
        jour={jour}
        aujourdhui={aujourdhui}
        avecMatchs={avecMatchs}
        actif={filtre === "tous"}
        onChange={choisirJour}
      />
      <FiltresDirect filtre={filtre} onChange={choisirFiltre} />
      {!feed ? (
        horsLigne ? (
          <EtatVide icone="cloud-offline-outline" texte="Impossible de charger le Direct.">
            <Bouton titre="Réessayer" variante="contour" onPress={rafraichir} occupe={chargement} />
          </EtatVide>
        ) : (
          <SqueletteDirect />
        )
      ) : (
        <>
          {horsLigne && majA ? (
            <View style={styles.bandeau}>
              <Ionicons name="cloud-offline-outline" size={16} color={couleurs.texteSecondaire} />
              <Text style={styles.bandeauTexte}>Pas de connexion — mis à jour à {heure(majA)}</Text>
            </View>
          ) : null}
          <SectionList<Entry, Section>
            sections={sections}
            keyExtractor={entryKey}
            stickySectionHeadersEnabled
            contentContainerStyle={styles.liste}
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
            renderItem={({ item }) => <CarteMatch entree={item} onPress={() => ouvrirSurLeSite(matchHref(item))} />}
            refreshControl={
              <RefreshControl
                refreshing={chargement}
                onRefresh={rafraichir}
                tintColor={couleurs.primaire}
                colors={[couleurs.primaire]}
                progressBackgroundColor={couleurs.surface}
              />
            }
            ListEmptyComponent={
              <EtatVide
                icone={filtre === "favoris" ? "star-outline" : filtre === "direct" ? "pulse-outline" : "calendar-outline"}
                texte={
                  filtre === "favoris"
                    ? "Touche l'étoile d'une compétition pour la retrouver ici."
                    : filtre === "direct"
                      ? "Aucun match en cours."
                      : "Aucun match ce jour-là."
                }
              >
                {proche ? (
                  <Bouton
                    titre={`Voir ${libelleDuJour(proche).toLowerCase()}`}
                    variante="contour"
                    onPress={() => choisirJour(proche)}
                  />
                ) : null}
              </EtatVide>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  entete: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8,
  },
  titre: { fontFamily: polices.titre, fontSize: 28, color: couleurs.texte },
  pastille: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: couleurs.surface,
  },
  pastilleTexte: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texte },
  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: rayons.champ, backgroundColor: couleurs.surface,
  },
  bandeauTexte: { flex: 1, fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteSecondaire },
  liste: { paddingBottom: 24 },
});
