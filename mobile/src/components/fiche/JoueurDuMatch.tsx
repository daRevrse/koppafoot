import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { accorder, type Genre } from "@/lib/genre";
import { formaterNote, tonNote } from "@/lib/notes";
import type { Fiche } from "~/lib/fiche-match";
import { espacement, polices } from "~/theme";

const AMBRE = "#FBBF24";

// La note, sur le fond que lui donne le site (components/forme/badges, `FOND_NOTE`).
const FOND_NOTE: Record<ReturnType<typeof tonNote>, { fond: string; texte: string }> = {
  absente: { fond: "#26322e", texte: "#9ba6a1" },
  faible: { fond: "#ef4444", texte: "#fff" },
  moyenne: { fond: "#6b7280", texte: "#fff" },
  bonne: { fond: "#059669", texte: "#fff" },
  excellente: { fond: "#10b981", texte: "#fff" },
};

export function PastilleNote({ note }: { note: number | null }) {
  const ton = FOND_NOTE[tonNote(note)];
  return (
    <View style={[styles.note, { backgroundColor: ton.fond }]}>
      <Text style={[styles.noteTexte, { color: ton.texte }]}>{formaterNote(note, "fr")}</Text>
    </View>
  );
}

/**
 * L'homme du match (components/match/MvpDuMatch), en tête du fil : le
 * dénouement du récit vit avec le récit. Son visage, son équipe, ce qu'il a
 * fait, et la note que la console lui a vue.
 */
export function JoueurDuMatch({ fiche, photo, genre }: { fiche: Fiche; photo: string | null; genre: Genre | null }) {
  const { mvp } = fiche;
  if (!mvp.nom) return null;
  const equipe = mvp.teamId
    ? mvp.teamId === fiche.domicile.teamId ? fiche.domicile.nom : fiche.exterieur.nom
    : null;
  const ligne = [equipe, mvp.motif].filter(Boolean).join(" · ");

  return (
    <View style={styles.carte}>
      {photo ? (
        <View>
          <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" accessibilityIgnoresInvertColors />
          <View style={styles.trophee}>
            <Ionicons name="trophy" size={11} color="#fff" />
          </View>
        </View>
      ) : (
        <View style={styles.sansPhoto}>
          <Ionicons name="trophy" size={20} color="#fff" />
        </View>
      )}
      <View style={styles.textes}>
        <Text style={styles.titre}>{accorder(genre, "Homme du match", "Joueuse du match").toUpperCase()}</Text>
        <Text style={styles.nom} numberOfLines={1}>{mvp.nom}</Text>
        {ligne ? <Text style={styles.ligne} numberOfLines={1}>{ligne}</Text> : null}
      </View>
      {mvp.note && mvp.note.valeur !== null ? (
        <View
          style={styles.colonneNote}
          accessible
          accessibilityLabel={`Note du match ${formaterNote(mvp.note.valeur, "fr")}, sur ${mvp.note.faits} fait${mvp.note.faits > 1 ? "s" : ""}`}
        >
          <PastilleNote note={mvp.note.valeur} />
          <Text style={styles.faits}>{`${mvp.note.faits} fait${mvp.note.faits > 1 ? "s" : ""}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 16, marginBottom: 16, padding: 14,
    borderWidth: 1, borderColor: "rgba(251,191,36,0.35)", backgroundColor: "rgba(251,191,36,0.06)",
  },
  photo: { width: 52, height: 52, borderRadius: 26 },
  trophee: {
    position: "absolute", right: -4, bottom: -4, width: 20, height: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: AMBRE,
  },
  sansPhoto: { width: 44, height: 44, alignItems: "center", justifyContent: "center", backgroundColor: AMBRE },
  textes: { flex: 1, minWidth: 0 },
  titre: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: AMBRE },
  nom: { marginTop: 2, fontFamily: polices.titre, fontSize: 18, color: "#eef3f0" },
  ligne: { fontFamily: polices.texteDemi, fontSize: 12, color: "#b7c1bc" },
  colonneNote: { alignItems: "center", gap: 4 },
  note: { width: 40, height: 28, alignItems: "center", justifyContent: "center" },
  noteTexte: { fontFamily: polices.texteNoir, fontSize: 13, fontVariant: ["tabular-nums"] },
  faits: { fontFamily: polices.texteNoir, fontSize: 9, color: "#7f8a85" },
});
