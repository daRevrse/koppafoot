import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { LayoutAnimation, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cleDuJour, libelleDuJour } from "@/lib/dates";
import { competitionHref, entryKey, matchHref, type Entry } from "@/lib/direct-shared";
import { FRIENDLY_COMP_ID } from "@/lib/friendlies-shared";
import { isWorldComp } from "@/lib/world-board-shared";
import { Bouton } from "~/components/Bouton";
import { EnTeteCompetition } from "~/components/direct/EnTeteCompetition";
import { FiltresDirect } from "~/components/direct/FiltresDirect";
import { FriseDesJours } from "~/components/direct/FriseDesJours";
import { LigneMatch } from "~/components/direct/LigneMatch";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EtatVide } from "~/components/EtatVide";
import { useDirect } from "~/hooks/useDirect";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";
import { useSuivi } from "~/hooks/useSuivi";
import {
  basculerRepli, compterEnDirect, groupesDuTableau, jourLePlusProche, joursAvecMatchs, joursDeLaFrise, sectionsDuDirect,
  type FiltreDirect, type SectionDuDirect,
} from "~/lib/direct-tableau";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { retourSelection } from "~/lib/retour";
import { routeDuMatch } from "~/lib/routes";
import { couleurs, polices } from "~/theme";

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const AUCUN_JOUR: ReadonlySet<string> = new Set();

export default function EcranDirect() {
  const { feed, majA, horsLigne, chargement, rafraichir } = useDirect();
  const suivi = useSuivi();
  const router = useRouter();
  const [aujourdhui] = useState(() => cleDuJour(new Date()));
  const [jour, setJour] = useState(aujourdhui);
  const [filtre, setFiltre] = useState<FiltreDirect>("tous");
  // Les compétitions repliées. Pas mémorisées d'une ouverture à l'autre :
  // c'est le comportement du Direct du site.
  const [replies, setReplies] = useState<ReadonlySet<string>>(() => new Set());
  const mouvementReduit = useMouvementReduit();

  const sections = useMemo<SectionDuDirect[]>(
    () => (feed ? sectionsDuDirect(groupesDuTableau(feed, { jour, filtre, suivies: suivi.ids }), replies) : []),
    [feed, jour, filtre, suivi.ids, replies],
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

  function basculer(cid: string) {
    retourSelection();
    if (!mouvementReduit) LayoutAnimation.configureNext(LayoutAnimation.create(180, "easeInEaseOut", "opacity"));
    setReplies((r) => basculerRepli(r, cid));
  }

  function choisirFiltre(f: FiltreDirect) {
    if (f === filtre) return;
    retourSelection();
    setFiltre(f);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <Text style={styles.titre}>DIRECT</Text>
      <FriseDesJours
        jours={jours}
        jour={jour}
        aujourdhui={aujourdhui}
        avecMatchs={avecMatchs}
        actif={filtre === "tous"}
        onChange={choisirJour}
      />
      <FiltresDirect filtre={filtre} enDirect={enDirect} onChange={choisirFiltre} />
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
          <SectionList<Entry, SectionDuDirect>
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
                  repli={{ nombre: section.nombre, repliee: section.repliee, onBasculer: () => basculer(c.id) }}
                />
              );
            }}
            renderItem={({ item }) => (
              <LigneMatch
                entree={item}
                onPress={() => {
                  // La fiche native ; un match du monde n'en a pas, il ouvre sa compétition sur le site.
                  const route = routeDuMatch(item);
                  if (route) router.push(route);
                  else ouvrirSurLeSite(matchHref(item));
                }}
              />
            )}
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
  // Les titres du site : font-display font-black, en capitales.
  titre: { fontFamily: polices.titre, fontSize: 28, lineHeight: 32, color: couleurs.texte, paddingHorizontal: 16, paddingTop: 8 },
  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: couleurs.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  bandeauTexte: { flex: 1, fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteSecondaire },
  liste: { paddingBottom: 24 },
});
