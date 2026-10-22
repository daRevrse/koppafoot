import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Competition } from "@/types";
import { Bouton } from "~/components/Bouton";
import { CarteAnnuaire } from "~/components/CarteAnnuaire";
import { EnTetePage } from "~/components/EnTetePage";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EtatVide } from "~/components/EtatVide";
import { useSuivi } from "~/hooks/useSuivi";
import { competitionsPubliques, rechercher, sectionsDeLAnnuaire } from "~/lib/annuaire";
import { lireToutesLesCompetitions } from "~/lib/fiche-firestore";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { couleurs, espacement, polices } from "~/theme";

/**
 * L'annuaire des compétitions (/competitions du site), ouvert depuis le bout
 * des filtres du Direct : une recherche, puis
 * en cours, à venir, terminées. Les grands championnats du monde restent sur
 * le site : ils n'ont pas d'écran ici.
 */
export default function EcranAnnuaire() {
  const router = useRouter();
  const suivi = useSuivi();
  const [toutes, setToutes] = useState<Competition[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [recharge, setRecharge] = useState(false);
  const [recherche, setRecherche] = useState("");

  const lire = useCallback(async () => {
    try {
      setToutes(competitionsPubliques(await lireToutesLesCompetitions()));
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, []);
  useEffect(() => {
    let vivant = true;
    lireToutesLesCompetitions()
      .then((c) => {
        if (vivant) setToutes(competitionsPubliques(c));
      })
      .catch(() => {
        if (vivant) setErreur(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const trouvees = toutes ? rechercher(toutes, recherche) : [];
  const sections = sectionsDeLAnnuaire(trouvees);

  let contenu;
  if (toutes === null) {
    contenu = erreur ? (
      <EtatVide icone="cloud-offline-outline" texte="Les compétitions ne se chargent pas. Vérifie ta connexion.">
        <Bouton titre="Réessayer" variante="contour" onPress={() => void lire()} />
      </EtatVide>
    ) : (
      <SqueletteDirect />
    );
  } else if (sections.length === 0) {
    contenu = (
      <EtatVide
        icone={recherche.trim() ? "search-outline" : "trophy-outline"}
        texte={recherche.trim() ? `Aucun résultat pour « ${recherche.trim()} ».` : "Aucune compétition pour le moment."}
      />
    );
  } else {
    contenu = sections.map((s) => (
      <View key={s.titre} style={styles.section}>
        <Text style={styles.sectionTitre} accessibilityRole="header">
          {s.titre.toUpperCase()}
          <Text style={styles.nombre}>{`  ${s.competitions.length}`}</Text>
        </Text>
        <View style={styles.cartes}>
          {s.competitions.map((c) => (
            <CarteAnnuaire
              key={c.id}
              competition={c}
              suivie={suivi.ids.has(c.id)}
              onEtoile={() => void suivi.basculer(c.id)}
              onPress={() => router.push({ pathname: "/competition/[cid]", params: { cid: c.id } })}
            />
          ))}
        </View>
      </View>
    ));
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTetePage titre="Compétitions" />
      <ScrollView
        contentContainerStyle={styles.contenu}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={recharge}
            onRefresh={async () => {
              setRecharge(true);
              await lire();
              setRecharge(false);
            }}
            tintColor={couleurs.primaire}
          />
        }
      >
        <View style={styles.recherche}>
          <Ionicons name="search" size={16} color={couleurs.texteDiscret} />
          <TextInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Nom, ville, catégorie…"
            placeholderTextColor={couleurs.texteDiscret}
            autoCorrect={false}
            returnKeyType="search"
            keyboardAppearance="dark"
            selectionColor={couleurs.primaire}
            accessibilityLabel="Chercher une compétition"
            style={styles.champ}
          />
          {recherche ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Effacer la recherche" onPress={() => setRecherche("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={couleurs.texteDiscret} />
            </Pressable>
          ) : null}
        </View>

        {contenu}

        <Pressable
          accessibilityRole="link"
          onPress={() => ouvrirSurLeSite("/competitions")}
          style={({ pressed }) => [styles.monde, pressed && styles.presse]}
        >
          <Ionicons name="globe-outline" size={20} color={couleurs.texteSecondaire} />
          <View style={styles.flexible}>
            <Text style={styles.mondeTitre}>LES GRANDS CHAMPIONNATS</Text>
            <Text style={styles.mondeTexte}>Premier League, Liga, Ligue des champions… sur le site.</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={couleurs.texteDiscret} />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 20 },
  recherche: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12,
    backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.bordure,
  },
  champ: { flex: 1, paddingVertical: 12, fontFamily: polices.texte, fontSize: 15, color: couleurs.texte },
  section: { gap: 8 },
  sectionTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret },
  nombre: { color: couleurs.bordureForte },
  cartes: { gap: 8 },
  monde: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  flexible: { flex: 1, minWidth: 0 },
  mondeTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.texteSecondaire },
  mondeTexte: { marginTop: 2, fontFamily: polices.texte, fontSize: 13, color: couleurs.texteDiscret },
});
