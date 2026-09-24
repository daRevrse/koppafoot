import { Pressable, StyleSheet, Text, View } from "react-native";
import { liveMinute, type Entry } from "@/lib/direct-shared";
import { Ecusson } from "~/components/Ecusson";
import { couleurs, polices } from "~/theme";

function Camp({ nom, logo, score, devant }: { nom: string; logo: string | null; score: number | null; devant: boolean }) {
  return (
    <View style={styles.camp}>
      <Ecusson url={logo} nom={nom} />
      <Text style={[styles.nom, devant && styles.gras]} numberOfLines={1}>{nom}</Text>
      <Text style={[styles.score, devant && styles.gras]}>{score ?? ""}</Text>
    </View>
  );
}

// Écussons : la copie posée sur le match. Le site corrige par la fiche
// comp_teams et le club (useEcussons) ; pas dans ce lot — un écusson périmé
// retombe sur les initiales.
export function LigneMatch({ entree, onPress }: { entree: Entry; onPress: () => void }) {
  const { match } = entree;
  const enDirect = match.status === "live";
  const joue = match.status === "completed";
  const domicile = match.scoreHome;
  const exterieur = match.scoreAway;
  const aScore = domicile != null && exterieur != null;
  const domicileDevant = aScore && domicile > exterieur;
  const exterieurDevant = aScore && exterieur > domicile;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.homeTeamName} contre ${match.awayTeamName}`}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, pressed && styles.presse]}
    >
      <View style={styles.temps}>
        {enDirect ? (
          <Text style={styles.minute}>{liveMinute(match)}′</Text>
        ) : (
          <Text style={styles.heure}>{joue ? "Terminé" : match.time ?? "—"}</Text>
        )}
      </View>
      <View style={styles.camps}>
        <Camp nom={match.homeTeamName} logo={match.homeTeamLogo} score={aScore ? domicile : null} devant={domicileDevant} />
        <Camp nom={match.awayTeamName} logo={match.awayTeamLogo} score={aScore ? exterieur : null} devant={exterieurDevant} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: couleurs.fond, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.fondSecondaire },
  temps: { width: 56 },
  minute: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.direct },
  heure: { fontFamily: polices.texteMoyen, fontSize: 12, color: couleurs.texteDiscret },
  camps: { flex: 1, gap: 6 },
  camp: { flexDirection: "row", alignItems: "center", gap: 8 },
  nom: { flex: 1, fontFamily: polices.texte, fontSize: 14, color: couleurs.texte },
  score: { minWidth: 20, textAlign: "right", fontFamily: polices.texteMoyen, fontSize: 14, color: couleurs.texte },
  gras: { fontFamily: polices.texteGras },
});
