import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { LayoutAnimation, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
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
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
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
import { routeDeLaCompetition, routeDuMatch } from "~/lib/routes";
import { creerStyles, polices, useCouleurs } from "~/theme";

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const AUCUN_JOUR: ReadonlySet<string> = new Set();

export default function EcranDirect() {
  const styles = useStyles();
  const couleurs = useCouleurs();
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
      <EnTeteOnglet titre="Direct" recherche />
      <FriseDesJours
        jours={jours}
        jour={jour}
        aujourdhui={aujourdhui}
        avecMatchs={avecMatchs}
        actif={filtre === "tous"}
        onChange={choisirJour}
      />
      <FiltresDirect
        filtre={filtre}
        enDirect={enDirect}
        onChange={choisirFiltre}
        apres={
          // Le classement, comme sur le site en téléphone : une pastille ambre
          // au bout des filtres. Ce n'est pas un filtre, c'est un départ.
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Top performances, le classement des joueurs"
            onPress={() => router.push("/classement")}
            style={({ pressed }) => [styles.versClassement, pressed && styles.versClassementPresse]}
          >
            <Ionicons name="flame" size={13} color={couleurs.accent} />
            <Text style={styles.versClassementTexte}>Top performances</Text>
            <Ionicons name="chevron-forward" size={12} color={couleurs.accent} />
          </Pressable>
        }
        fin={
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Toutes les compétitions"
            onPress={() => router.push("/competitions")}
            hitSlop={6}
            style={({ pressed }) => [styles.versAnnuaire, pressed && styles.versAnnuairePresse]}
          >
            <Ionicons name="trophy-outline" size={13} color={couleurs.texteSecondaire} />
            <Text style={styles.versAnnuaireTexte}>Compétitions</Text>
          </Pressable>
        }
      />
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
                  onPress={() => {
                    // La page native ; une compétition du monde n'a que sa page du site.
                    const route = routeDeLaCompetition(c);
                    if (route) router.push(route);
                    else ouvrirSurLeSite(competitionHref(c));
                  }}
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

const useStyles = creerStyles((couleurs) => ({
  // L'entrée vers l'annuaire, au bout des filtres : une pastille cerclée, pas
  // remplie — elle mène ailleurs, elle ne filtre pas.
  versAnnuaire: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: couleurs.bordureForte,
  },
  versAnnuairePresse: { backgroundColor: couleurs.surfaceHaute },
  versAnnuaireTexte: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteSecondaire },
  versClassement: {
    flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, backgroundColor: couleurs.accentVoile,
  },
  versClassementPresse: { opacity: 0.7 },
  versClassementTexte: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.accent },
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  // Les titres du site : font-display font-black, en capitales.
  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: couleurs.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  bandeauTexte: { flex: 1, fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteSecondaire },
  liste: { paddingBottom: 24 },
}));
