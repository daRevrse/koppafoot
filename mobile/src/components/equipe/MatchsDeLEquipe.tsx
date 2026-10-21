import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { rangerLesMatchs, resultatDuMatch, type MatchDuClub } from "@/lib/fiche-club";
import { PointDirect } from "~/components/direct/PointDirect";
import { Ecusson } from "~/components/Ecusson";
import { EtatVide } from "~/components/EtatVide";
import { couleurs, espacement, polices } from "~/theme";

const PASTILLE: Record<"V" | "N" | "D", { fond: string; texte: string }> = {
  V: { fond: "#059669", texte: "#fff" },
  N: { fond: couleurs.surfaceHaute, texte: couleurs.texteSecondaire },
  D: { fond: "#ef4444", texte: "#fff" },
};
const LISERE: Record<"V" | "N" | "D", string> = { V: "#10b981", N: couleurs.bordureForte, D: "#fca5a5" };

/** Une ligne (MatchsDuClub du site) : le jour, l'adversaire, l'étape et le terrain, le score et le résultat. */
function Ligne({ m, premiere, onOuvrir }: { m: MatchDuClub; premiere: boolean; onOuvrir: (id: string) => void }) {
  const resultat = resultatDuMatch(m);
  const enDirect = m.statut === "en_direct";
  const contexte = [m.etape, m.domicile ? "Domicile" : "Extérieur"].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${m.adversaire.nom}, ${contexte}${resultat ? `, ${m.pour} à ${m.contre}` : ""}`}
      onPress={() => onOuvrir(m.id)}
      style={({ pressed }) => [
        styles.ligne,
        premiere && styles.premiere,
        { borderLeftColor: enDirect ? couleurs.direct : resultat ? LISERE[resultat] : "transparent" },
        pressed && styles.presse,
      ]}
    >
      <View style={styles.quand}>
        <Text style={styles.jour} numberOfLines={2}>{(m.date ? libelleDuJour(m.date) : "Date à venir").toUpperCase()}</Text>
        {m.heure && m.statut === "a_venir" ? <Text style={styles.heure}>{m.heure}</Text> : null}
      </View>
      <Ecusson url={m.adversaire.logo} nom={m.adversaire.nom} taille={24} />
      <View style={styles.textes}>
        <Text style={styles.adversaire} numberOfLines={1}>{m.adversaire.nom}</Text>
        <Text style={styles.contexte} numberOfLines={1}>{contexte}</Text>
      </View>
      {enDirect ? (
        <View style={styles.direct}>
          <PointDirect taille={4} />
          <Text style={styles.scoreDirect}>{`${m.pour ?? 0}–${m.contre ?? 0}`}</Text>
        </View>
      ) : resultat ? (
        <View style={styles.resultat}>
          <Text style={styles.score}>{`${m.pour}–${m.contre}`}</Text>
          <View style={[styles.pastille, { backgroundColor: PASTILLE[resultat].fond }]}>
            <Text style={[styles.pastilleTexte, { color: PASTILLE[resultat].texte }]}>{resultat}</Text>
          </View>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={15} color={couleurs.texteDiscret} />
    </Pressable>
  );
}

/** Les matchs de l'équipe : à venir (le direct d'abord, puis le plus proche), puis joués (le plus récent d'abord). */
export function MatchsDeLEquipe({ matchs, onOuvrir }: { matchs: MatchDuClub[]; onOuvrir: (id: string) => void }) {
  const { aVenir, joues } = rangerLesMatchs(matchs);
  if (aVenir.length === 0 && joues.length === 0) return <EtatVide icone="calendar-outline" texte="Aucun match pour l'instant." />;
  return (
    <View style={styles.colonne}>
      {[{ titre: "À venir", liste: aVenir }, { titre: "Joués", liste: joues }].filter((b) => b.liste.length > 0).map((b) => (
        <View key={b.titre}>
          <Text style={styles.titre} accessibilityRole="header">
            {b.titre.toUpperCase()}
            <Text style={styles.nombre}>{`  ${b.liste.length}`}</Text>
          </Text>
          <View style={styles.cadre}>
            {b.liste.map((m, i) => <Ligne key={m.id} m={m} premiere={i === 0} onOuvrir={onOuvrir} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: 16, paddingHorizontal: 16 },
  titre: { marginBottom: 6, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.15), color: couleurs.texteDiscret },
  nombre: { color: couleurs.bordureForte },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderLeftWidth: 2,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  premiere: { borderTopWidth: 0 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  quand: { width: 66 },
  jour: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: 0.5, color: couleurs.texteDiscret },
  heure: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 10, color: couleurs.texteSecondaire },
  textes: { flex: 1, minWidth: 0 },
  adversaire: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  contexte: { marginTop: 2, fontFamily: polices.texteDemi, fontSize: 11, color: couleurs.texteDiscret },
  direct: { flexDirection: "row", alignItems: "center", gap: 6 },
  scoreDirect: { fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.direct },
  resultat: { flexDirection: "row", alignItems: "center", gap: 8 },
  score: { fontFamily: polices.titre, fontSize: 16, color: couleurs.texte },
  pastille: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 10 },
});
