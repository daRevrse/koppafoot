import { useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SansCasquette } from "~/components/casquette/SansCasquette";
import { SectionATenir } from "~/components/casquette/SectionATenir";
import { SectionCompetitions } from "~/components/casquette/SectionCompetitions";
import { SectionTerrains } from "~/components/casquette/SectionTerrains";
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
import { useEspaceCasquette } from "~/hooks/useEspaceCasquette";
import { useAuth } from "~/lib/auth";
import { couleurs } from "~/theme";

/**
 * L'onglet Espace casquette : ce que le compte a à faire avec ses casquettes
 * (organisateur, scoreur, propriétaire de terrain), autour du jour de match.
 * Les matchs à tenir, ses compétitions, ses réservations ; on agit sur le
 * site (la console, l'espace organisateur, les terrains). Sans casquette,
 * ce qu'elles sont et où les demander.
 */
export default function EcranEspace() {
  const { utilisateur } = useAuth();
  const e = useEspaceCasquette();
  const [tire, setTire] = useState(false);

  async function tirer() {
    setTire(true);
    await e.rafraichir();
    setTire(false);
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTeteOnglet titre="Espace casquette" />
      {e.chargement ? (
        <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.contenu}
          refreshControl={
            e.connecte ? (
              <RefreshControl
                refreshing={tire}
                onRefresh={tirer}
                tintColor={couleurs.primaire}
                colors={[couleurs.primaire]}
                progressBackgroundColor={couleurs.surface}
              />
            ) : undefined
          }
        >
          {utilisateur && e.sections.aTenir ? (
            <SectionATenir uid={utilisateur.uid} confies={e.confies} journees={e.journees} amicaux={e.amicaux} />
          ) : null}
          {e.sections.competitions ? (
            <SectionCompetitions competitions={e.competitions} organisateur={e.organisateur} />
          ) : null}
          {e.sections.terrains ? <SectionTerrains reservations={e.reservations} /> : null}
          {e.sections.sansCasquette ? <SansCasquette connecte={e.connecte} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  chargement: { paddingVertical: 48 },
  contenu: { gap: 16, paddingTop: 8, paddingBottom: 48 },
});
