import { Pressable, StyleSheet, Text, View } from "react-native";
import { FOOT } from "@/i18n/foot";
import { minuteDuDirect, type Entry } from "@/lib/direct-shared";
import { Ecusson } from "~/components/Ecusson";
import { PointDirect } from "~/components/direct/PointDirect";
import { couleurs, polices } from "~/theme";

/** Le vocabulaire du site : « MT », « TAB », « Fin », « Annulé ». */
const f = FOOT.fr;

function Camp({ nom, logo, score, battu, enDirect }: {
  nom: string; logo: string | null; score: number | null; battu: boolean; enDirect: boolean;
}) {
  return (
    <View style={styles.camp}>
      <Ecusson url={logo} nom={nom} taille={20} />
      <Text style={[styles.nom, battu && styles.battu]} numberOfLines={1}>{nom}</Text>
      <Text style={[styles.score, battu && styles.battu, enDirect && styles.scoreDirect]}>{score ?? ""}</Text>
    </View>
  );
}

/**
 * Une ligne du Direct, celle du site (MatchRow) : l'heure ou la minute dans
 * une colonne étroite, les deux camps l'un sous l'autre, le score à droite.
 * Le camp battu s'estompe, comme sur un tableau d'affichage.
 *
 * Écussons : la copie posée sur le match. Le site corrige par la fiche
 * comp_teams et le club (useEcussons) ; pas dans ce lot — un écusson périmé
 * retombe sur les initiales.
 */
export function LigneMatch({ entree, onPress }: { entree: Entry; onPress: () => void }) {
  const { match } = entree;
  const enDirect = match.status === "live";
  const joue = match.status === "completed";
  const annule = match.status === "cancelled";
  const domicile = match.scoreHome;
  const exterieur = match.scoreAway;
  const aScore = domicile != null && exterieur != null;
  // « 13′ », « 45+2′ », « MT », « TAB » ; vide pour un match du monde, sans horloge.
  const minute = enDirect
    ? minuteDuDirect(entree, { pause: f.minutePause, avant: f.minuteAvant, interrompu: f.minuteInterrompu, tirs: f.minuteTirs })
    : "";

  const etat = enDirect
    ? `, en direct${minute ? `, ${minute}` : ""}`
    : joue ? ", terminé" : annule ? ", annulé" : match.time ? `, à ${match.time}` : "";
  const score = aScore ? `, ${domicile} à ${exterieur}` : "";

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.homeTeamName} contre ${match.awayTeamName}${score}${etat}`}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, pressed && styles.presse]}
    >
      <View style={styles.temps}>
        {enDirect ? (
          <>
            {minute ? <Text style={styles.minute}>{minute}</Text> : null}
            <PointDirect taille={4} />
          </>
        ) : (
          <Text style={styles.heure}>{joue ? f.fin : annule ? f.annule : match.time ?? "–"}</Text>
        )}
      </View>
      <View style={styles.camps}>
        <Camp
          nom={match.homeTeamName} logo={match.homeTeamLogo} score={aScore ? domicile : null} enDirect={enDirect}
          battu={joue && aScore && domicile < exterieur}
        />
        <Camp
          nom={match.awayTeamName} logo={match.awayTeamLogo} score={aScore ? exterieur : null} enDirect={enDirect}
          battu={joue && aScore && exterieur < domicile}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8, paddingRight: 12, paddingVertical: 8,
    backgroundColor: couleurs.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  temps: { width: 44, alignItems: "center", justifyContent: "center", gap: 3 },
  minute: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.direct },
  heure: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteDiscret },
  camps: { flex: 1, gap: 4 },
  camp: { flexDirection: "row", alignItems: "center", gap: 8 },
  nom: { flex: 1, fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  battu: { color: couleurs.texteDiscret },
  score: { minWidth: 14, textAlign: "right", fontFamily: polices.texteNoir, fontSize: 13, color: couleurs.texte },
  scoreDirect: { color: couleurs.direct },
});
