import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bouton } from "~/components/Bouton";
import { PAGES_DU_SITE } from "~/lib/espace-casquette";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { couleurs, espacement, polices } from "~/theme";

const CASQUETTES: {
  icone: ComponentProps<typeof Ionicons>["name"];
  titre: string;
  texte: string;
  candidature: string;
  presentation: string;
}[] = [
  {
    icone: "trophy-outline",
    titre: "Organiser des compétitions",
    texte: "Calendrier, classement, direct : ta compétition de bout en bout.",
    candidature: PAGES_DU_SITE.candidatureOrganisateur,
    presentation: "/organisateurs",
  },
  {
    icone: "radio-outline",
    titre: "Tenir la console live",
    texte: "Raconte les matchs en direct, depuis le bord du terrain.",
    candidature: PAGES_DU_SITE.candidatureScoreur,
    presentation: "/scoreurs",
  },
  {
    icone: "location-outline",
    titre: "Référencer ton terrain",
    texte: "Reçois les demandes de créneau des équipes.",
    candidature: PAGES_DU_SITE.candidatureTerrain,
    presentation: "/terrains",
  },
];

/**
 * L'onglet d'un compte sans casquette : ce qu'elles sont, et où les demander.
 * Connecté, chaque casquette mène à sa candidature sur le site ; sans compte,
 * à sa présentation, et l'on propose d'abord d'en créer un.
 */
export function SansCasquette({ connecte }: { connecte: boolean }) {
  const router = useRouter();
  return (
    <View style={styles.cadre}>
      <Text style={styles.titre} accessibilityRole="header">LES CASQUETTES</Text>
      <Text style={styles.texte}>
        Ton rôle dit qui tu es sur le terrain. Une casquette dit ce que tu fais en plus : organiser, raconter les
        matchs en direct, accueillir des équipes. Elles se cumulent, et se demandent sur le site.
      </Text>
      {CASQUETTES.map((c) => (
        <Pressable
          key={c.titre}
          accessibilityRole="link"
          accessibilityLabel={`${c.titre}. ${c.texte}`}
          onPress={() => ouvrirSurLeSite(connecte ? c.candidature : c.presentation)}
          style={({ pressed }) => [styles.casquette, pressed && styles.presse]}
        >
          <View style={styles.icone}>
            <Ionicons name={c.icone} size={18} color={couleurs.primaire} />
          </View>
          <View style={styles.textes}>
            <Text style={styles.casquetteTitre}>{c.titre}</Text>
            <Text style={styles.casquetteTexte}>{c.texte}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={couleurs.texteDiscret} />
        </Pressable>
      ))}
      {connecte ? null : (
        <View style={styles.compte}>
          <Bouton
            titre="Créer mon compte"
            onPress={() => router.push({ pathname: "/connexion", params: { raison: "casquette" } })}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { marginHorizontal: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  titre: {
    paddingHorizontal: 16, paddingTop: 16, fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11),
    color: couleurs.texteDiscret,
  },
  texte: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, fontFamily: polices.texte, fontSize: 14, lineHeight: 20,
    color: couleurs.texteSecondaire,
  },
  casquette: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  icone: { width: 36, height: 36, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.primaireVoile },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  casquetteTitre: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  casquetteTexte: { fontFamily: polices.texte, fontSize: 12, lineHeight: 16, color: couleurs.texteDiscret },
  compte: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
});
