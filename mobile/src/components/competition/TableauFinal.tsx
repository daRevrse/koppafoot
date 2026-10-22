import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FOOT } from "@/i18n/foot";
import { describeBracketSlotSource } from "@/lib/competition-format";
import type { CompMatch } from "@/types";
import { PointDirect } from "~/components/direct/PointDirect";
import { Ecusson } from "~/components/Ecusson";
import { EtatVide } from "~/components/EtatVide";
import { colonnesDuTableau } from "~/lib/page-competition";
import { couleurs, espacement, polices } from "~/theme";

const f = FOOT.fr;

/** La largeur d'un tour : deux tiennent côte à côte sur un téléphone de 390 points. */
const LARGEUR_TOUR = 168;

function Camp({ equipeId, nom, logo, score, montrerScore, gagnant, estompe, place }: {
  equipeId: string | null;
  nom: string;
  logo: string | null;
  score: number | null;
  montrerScore: boolean;
  gagnant: boolean;
  estompe: boolean;
  place: string | null;
}) {
  return (
    <View style={[styles.camp, gagnant && styles.campGagnant, estompe && styles.estompe]}>
      {equipeId ? (
        <>
          <Ecusson url={logo} nom={nom} taille={20} />
          <Text style={[styles.nom, gagnant && styles.nomGagnant]} numberOfLines={1}>{nom}</Text>
        </>
      ) : (
        <>
          <View style={styles.inconnu}><Text style={styles.inconnuTexte}>?</Text></View>
          <Text style={[styles.nom, styles.place]} numberOfLines={1}>{place ?? "À déterminer"}</Text>
        </>
      )}
      {montrerScore ? <Text style={[styles.score, gagnant && styles.nomGagnant]}>{score ?? 0}</Text> : null}
    </View>
  );
}

/** Un match du tableau (BracketMatch) : les deux camps, le vainqueur en avant, le perdant estompé. */
function MatchDuTableau({ m, onOuvrir }: { m: CompMatch; onOuvrir: (m: CompMatch) => void }) {
  const enDirect = m.status === "live";
  const joue = m.status === "completed";
  const domicileGagne = joue && m.winnerTeamId != null && m.winnerTeamId === m.homeTeamId;
  const exterieurGagne = joue && m.winnerTeamId != null && m.winnerTeamId === m.awayTeamId;
  const vainqueur = joue && m.winnerTeamId != null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${m.homeTeamName || "À déterminer"} contre ${m.awayTeamName || "À déterminer"}`}
      onPress={() => onOuvrir(m)}
      style={({ pressed }) => [styles.match, enDirect && styles.matchDirect, pressed && styles.presse]}
    >
      <Camp
        equipeId={m.homeTeamId} nom={m.homeTeamName} logo={m.homeTeamLogo} score={m.scoreHome}
        montrerScore={enDirect || joue} gagnant={domicileGagne} estompe={vainqueur && !domicileGagne}
        place={m.homeSource ? describeBracketSlotSource(m.homeSource) : null}
      />
      <View style={styles.separation} />
      <Camp
        equipeId={m.awayTeamId} nom={m.awayTeamName} logo={m.awayTeamLogo} score={m.scoreAway}
        montrerScore={enDirect || joue} gagnant={exterieurGagne} estompe={vainqueur && !exterieurGagne}
        place={m.awaySource ? describeBracketSlotSource(m.awaySource) : null}
      />
      {enDirect ? (
        <View style={styles.bandeDirect}>
          <PointDirect taille={4} />
          <Text style={styles.texteDirect}>{f.enDirect.toUpperCase()}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Le tableau final (BracketTab du site) : une colonne par tour, qui défile
 * de côté, les matchs d'un tour répartis pour s'aligner sur le tour suivant ;
 * la petite finale à part, dessous.
 */
export function TableauFinal({ matchs, onOuvrir }: { matchs: CompMatch[] | null; onOuvrir: (m: CompMatch) => void }) {
  if (matchs === null) return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;
  const { colonnes, petiteFinale } = colonnesDuTableau(matchs);
  if (colonnes.length === 0 && !petiteFinale) {
    return <EtatVide icone="git-branch-outline" texte="La phase finale n'a pas encore commencé." />;
  }
  return (
    <View style={styles.colonne}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tours}>
        {colonnes.map((c) => (
          <View key={c.tour} style={styles.tour}>
            <Text style={styles.titreTour}>{f.tours(c.tour).toUpperCase()}</Text>
            <View style={styles.matchsDuTour}>
              {c.matchs.map((m) => <MatchDuTableau key={m.id} m={m} onOuvrir={onOuvrir} />)}
            </View>
          </View>
        ))}
      </ScrollView>
      {petiteFinale ? (
        <View style={styles.petiteFinale}>
          <Text style={styles.titreTour}>{f.tours("third_place").toUpperCase()}</Text>
          <MatchDuTableau m={petiteFinale} onOuvrir={onOuvrir} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chargement: { paddingVertical: 40 },
  colonne: { gap: 24 },
  tours: { gap: 16, paddingHorizontal: 16 },
  tour: { width: LARGEUR_TOUR, gap: 12 },
  titreTour: {
    textAlign: "center", fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.1), color: couleurs.texte,
  },
  // Les colonnes prennent toutes la hauteur de la plus haute : répartis, les
  // matchs d'une demi-finale tombent en face de leurs quarts.
  matchsDuTour: { flex: 1, justifyContent: "space-around", gap: 12 },
  match: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  matchDirect: { borderColor: couleurs.direct },
  presse: { backgroundColor: couleurs.surfaceHaute },
  separation: { height: StyleSheet.hairlineWidth, backgroundColor: couleurs.bordure },
  camp: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 8 },
  campGagnant: { backgroundColor: couleurs.primaireVoile },
  estompe: { opacity: 0.5 },
  nom: { flex: 1, fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteSecondaire },
  nomGagnant: { fontFamily: polices.texteNoir, color: couleurs.texte },
  place: { fontFamily: polices.texteMoyen, fontStyle: "italic", color: couleurs.primaire },
  inconnu: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: couleurs.bordureForte,
    alignItems: "center", justifyContent: "center",
  },
  inconnuTexte: { fontFamily: polices.texteNoir, fontSize: 10, color: couleurs.texteDiscret },
  score: { fontFamily: polices.texteNoir, fontSize: 13, color: couleurs.texteDiscret },
  bandeDirect: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 4,
    backgroundColor: couleurs.directVoile,
  },
  texteDirect: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: 1, color: couleurs.direct },
  petiteFinale: { alignSelf: "center", width: LARGEUR_TOUR, gap: 12 },
});
