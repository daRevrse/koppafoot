import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Competition } from "@/types";
import { Ecusson } from "~/components/Ecusson";
import { useAuth } from "~/lib/auth";
import { lireTousLesClubs, lireToutesLesCompetitions } from "~/lib/fiche-firestore";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { clubsTrouves, competitionsTrouvees, rechercheLancee, type ClubTrouve } from "~/lib/recherche";
import { couleurs, espacement, polices } from "~/theme";

function Ligne({ visuel, titre, detail, externe, onPress }: {
  visuel: ReactNode;
  titre: string;
  detail: string | null;
  externe?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.ligne, pressed && styles.presse]}>
      <View style={styles.visuel}>{visuel}</View>
      <View style={styles.textes}>
        <Text style={styles.titre} numberOfLines={1}>{titre}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={1}>{detail}</Text> : null}
      </View>
      <Ionicons name={externe ? "open-outline" : "chevron-forward"} size={15} color={couleurs.texteDiscret} />
    </Pressable>
  );
}

/**
 * La recherche de l'en-tête du Direct (MobileSearchOverlay du site) : tout
 * l'écran, le champ prêt à taper. Les compétitions se trouvent sur place et
 * ouvrent leur page ; les clubs, avec un compte, ouvrent leur fiche sur le
 * site ; la dernière ligne passe la recherche à l'annuaire.
 */
export default function EcranRecherche() {
  const router = useRouter();
  const { utilisateur } = useAuth();
  const [terme, setTerme] = useState("");
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [clubs, setClubs] = useState<ClubTrouve[] | null>(null);
  const champ = useRef<TextInput>(null);

  // Les compétitions et les clubs sont des listes courtes : lues une fois à
  // l'ouverture, puis filtrées à chaque lettre plutôt que relues.
  useEffect(() => {
    let vivant = true;
    lireToutesLesCompetitions()
      .then((c) => {
        if (vivant) setCompetitions(c);
      })
      .catch(() => {
        if (vivant) setCompetitions([]);
      });
    return () => {
      vivant = false;
    };
  }, []);
  const uid = utilisateur?.uid ?? null;
  useEffect(() => {
    if (!uid) return;
    let vivant = true;
    lireTousLesClubs()
      .then((c) => {
        if (vivant) setClubs(c);
      })
      .catch(() => {
        if (vivant) setClubs([]);
      });
    return () => {
      vivant = false;
    };
  }, [uid]);

  const cherche = rechercheLancee(terme);
  const comps = cherche && competitions ? competitionsTrouvees(competitions, terme) : [];
  const equipes = cherche && uid && clubs ? clubsTrouves(clubs, terme) : [];
  const enCours = cherche && (competitions === null || (uid !== null && clubs === null));
  const rien = cherche && !enCours && comps.length === 0 && equipes.length === 0;

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <View style={styles.barre}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer la recherche" onPress={() => router.back()} hitSlop={8} style={styles.retour}>
          <Ionicons name="chevron-back" size={18} color={couleurs.texte} />
        </Pressable>
        <View style={styles.champ}>
          <Ionicons name="search" size={16} color={couleurs.texteDiscret} />
          <TextInput
            ref={champ}
            autoFocus
            value={terme}
            onChangeText={setTerme}
            placeholder="Équipe, compétition, ville…"
            placeholderTextColor={couleurs.texteDiscret}
            autoCorrect={false}
            returnKeyType="search"
            keyboardAppearance="dark"
            selectionColor={couleurs.primaire}
            accessibilityLabel="Rechercher"
            style={styles.saisie}
          />
          {terme ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Effacer" onPress={() => setTerme("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={couleurs.texteDiscret} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!cherche ? (
          <Text style={styles.consigne}>
            Tape le nom d&apos;une compétition{uid ? ", d'un club" : ""} ou d&apos;une ville.
          </Text>
        ) : null}
        {enCours && comps.length === 0 ? <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} /> : null}
        {rien ? <Text style={styles.consigne}>{`Aucun résultat pour « ${terme.trim()} ».`}</Text> : null}

        {comps.length > 0 ? (
          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>COMPÉTITIONS</Text>
            <View style={styles.cadre}>
              {comps.map((c) => (
                <Ligne
                  key={c.id}
                  visuel={c.logoUrl ? <Image source={{ uri: c.logoUrl }} style={styles.vignette} contentFit="cover" /> : <Ionicons name="trophy-outline" size={18} color={couleurs.primaire} />}
                  titre={c.name}
                  detail={c.venueCity}
                  onPress={() => router.push({ pathname: "/competition/[cid]", params: { cid: c.id } })}
                />
              ))}
            </View>
          </View>
        ) : null}

        {equipes.length > 0 ? (
          <View style={styles.bloc}>
            <Text style={styles.blocTitre}>CLUBS</Text>
            <View style={styles.cadre}>
              {equipes.map((c) => (
                <Ligne
                  key={c.id}
                  visuel={<Ecusson url={c.logo} nom={c.nom} taille={30} />}
                  titre={c.nom}
                  detail={[c.ville, c.recrute ? "Recrute" : null].filter(Boolean).join(" · ") || null}
                  externe
                  onPress={() => ouvrirSurLeSite(`/teams/${c.id}`)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {cherche ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push({ pathname: "/competitions", params: { q: terme.trim() } })}
            style={({ pressed }) => [styles.annuaire, pressed && styles.presse]}
          >
            <Ionicons name="trophy-outline" size={16} color={couleurs.primaire} />
            <Text style={styles.annuaireTexte}>{`CHERCHER « ${terme.trim().toUpperCase()} » DANS L'ANNUAIRE`}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  barre: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  retour: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: couleurs.bordure,
    alignItems: "center", justifyContent: "center",
  },
  champ: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 999,
    backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.bordure,
  },
  saisie: { flex: 1, paddingVertical: 10, fontFamily: polices.texte, fontSize: 15, color: couleurs.texte },
  contenu: { paddingHorizontal: 16, paddingBottom: 32, gap: 20 },
  consigne: { paddingTop: 24, textAlign: "center", fontFamily: polices.texte, fontSize: 14, color: couleurs.texteDiscret },
  chargement: { paddingVertical: 32 },
  bloc: { gap: 8 },
  blocTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.15), color: couleurs.texteDiscret },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  visuel: { width: 34, height: 34, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  vignette: { width: 34, height: 34 },
  textes: { flex: 1, minWidth: 0 },
  titre: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  detail: { marginTop: 1, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  annuaire: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  annuaireTexte: { flex: 1, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.1), color: couleurs.primaire },
});
