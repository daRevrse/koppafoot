import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { filParJour, type Article } from "@/lib/fil-actus";
import { CarteArticle } from "~/components/actus/CarteArticle";
import { SqueletteActus } from "~/components/actus/SqueletteActus";
import { UneDuJour } from "~/components/actus/UneDuJour";
import { Bouton } from "~/components/Bouton";
import { EnTeteOnglet } from "~/components/EnTeteOnglet";
import { EtatVide } from "~/components/EtatVide";
import { useActus } from "~/hooks/useActus";
import { nombreDArticles, titreDeLaJournee } from "~/lib/actus";
import { ouvrirChezLEditeur } from "~/lib/navigateur";
import { couleurs, espacement, polices } from "~/theme";

const heure = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

interface Journee {
  cle: string;
  titre: string;
  data: Article[];
}

/**
 * L'onglet Actus : la page /actus du site. La une du jour en grand, puis une
 * journée après l'autre ; titre, média et heure, et l'article s'ouvre chez
 * son éditeur. Le découpage est celui du site (lib/fil-actus).
 */
export default function EcranActus() {
  const { articles, majA, horsLigne, chargement, rafraichir } = useActus();

  // Les journées se comptent depuis le chargement : c'est lui qui dit « aujourd'hui ».
  const fil = useMemo(() => (articles && majA ? filParJour(articles, majA) : null), [articles, majA]);
  const journees = useMemo<Journee[]>(
    () =>
      fil && majA
        ? fil.journees.map((j) => ({ cle: j.cle ?? "plus-tot", titre: titreDeLaJournee(j.cle, majA), data: j.articles }))
        : [],
    [fil, majA],
  );

  const injoignable = (
    <EtatVide icone="cloud-offline-outline" texte="Le fil d'actualité est injoignable pour le moment.">
      <Bouton titre="Réessayer" variante="contour" onPress={rafraichir} occupe={chargement} />
    </EtatVide>
  );

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTeteOnglet titre="Actus" />
      {!fil ? (
        horsLigne ? injoignable : <SqueletteActus />
      ) : (
        <>
          {horsLigne && majA ? (
            <View style={styles.bandeau}>
              <Ionicons name="cloud-offline-outline" size={16} color={couleurs.texteSecondaire} />
              <Text style={styles.bandeauTexte}>Pas de connexion — mis à jour à {heure(majA)}</Text>
            </View>
          ) : null}
          <SectionList<Article, Journee>
            sections={journees}
            keyExtractor={(a) => a.id}
            stickySectionHeadersEnabled
            contentContainerStyle={styles.liste}
            ListHeaderComponent={<UneDuJour articles={fil.une} onOuvrir={(a) => ouvrirChezLEditeur(a.url)} />}
            renderSectionHeader={({ section }) => (
              <View style={styles.journee} accessibilityRole="header">
                <Text style={styles.journeeTitre}>{section.titre}</Text>
                <Text style={styles.journeeNombre}>{nombreDArticles(section.data.length)}</Text>
              </View>
            )}
            renderItem={({ item }) => <CarteArticle article={item} onPress={() => ouvrirChezLEditeur(item.url)} />}
            refreshControl={
              <RefreshControl
                refreshing={chargement}
                onRefresh={rafraichir}
                tintColor={couleurs.primaire}
                colors={[couleurs.primaire]}
                progressBackgroundColor={couleurs.surface}
              />
            }
            // La route rend un fil vide quand les flux se taisent : c'est le même « injoignable ».
            ListEmptyComponent={fil.une.length === 0 ? injoignable : null}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  bandeau: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: couleurs.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  bandeauTexte: { flex: 1, fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteSecondaire },
  liste: { paddingBottom: 24 },
  // L'en-tête d'une journée reste collé en haut : il doit être opaque.
  journee: {
    flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16,
    paddingHorizontal: 16, paddingTop: 24, paddingBottom: 10, backgroundColor: couleurs.fond,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  journeeTitre: { flexShrink: 1, fontFamily: polices.titre, fontSize: 22, color: couleurs.texte },
  journeeNombre: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), textTransform: "uppercase",
    color: couleurs.texteDiscret,
  },
});
