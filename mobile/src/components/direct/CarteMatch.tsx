import { Pressable, StyleSheet, Text, View } from "react-native";
import { FOOT } from "@/i18n/foot";
import { minuteDuDirect, type Entry } from "@/lib/direct-shared";
import { Ecusson } from "~/components/Ecusson";
import { PointDirect } from "~/components/direct/PointDirect";
import { couleurs, polices, rayons } from "~/theme";

/** Le vocabulaire du site : « MT », « TAB », « Fin », « Annulé ». */
const f = FOOT.fr;

/** « devant » en gras, à tout moment ; « derrière » estompé, une fois le match joué seulement. */
type Rang = "devant" | "derriere" | "egal";

function Camp({ nom, logo, score, rang }: { nom: string; logo: string | null; score: number | null; rang: Rang }) {
  return (
    <View style={styles.camp}>
      <Ecusson url={logo} nom={nom} taille={24} />
      <Text
        style={[styles.nom, rang === "devant" && styles.nomDevant, rang === "derriere" && styles.estompe]}
        numberOfLines={1}
      >
        {nom}
      </Text>
      <Text style={[styles.score, rang === "derriere" && styles.estompe]}>{score ?? ""}</Text>
    </View>
  );
}

// Écussons : la copie posée sur le match. Le site corrige par la fiche
// comp_teams et le club (useEcussons) ; pas dans ce lot — un écusson périmé
// retombe sur les initiales.
export function CarteMatch({ entree, onPress }: { entree: Entry; onPress: () => void }) {
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

  const rang = (pour: number | null, contre: number | null): Rang => {
    if (pour == null || contre == null || pour === contre) return "egal";
    if (pour > contre) return "devant";
    return joue ? "derriere" : "egal";
  };

  const etat = enDirect
    ? `, en direct${minute ? `, ${minute}` : ""}`
    : joue ? ", terminé" : annule ? ", annulé" : match.time ? `, à ${match.time}` : "";
  const score = aScore ? `, ${domicile} à ${exterieur}` : "";

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${match.homeTeamName} contre ${match.awayTeamName}${score}${etat}`}
      onPress={onPress}
      style={({ pressed }) => [styles.carte, enDirect && styles.carteDirect, pressed && styles.presse]}
    >
      <View style={styles.temps}>
        {enDirect ? (
          <View style={styles.minute}>
            <PointDirect />
            <Text style={styles.minuteTexte}>{minute}</Text>
          </View>
        ) : (
          <Text style={joue || annule ? styles.fin : styles.heure}>
            {joue ? f.fin.toUpperCase() : annule ? f.annule.toUpperCase() : match.time ?? "—"}
          </Text>
        )}
      </View>
      <View style={styles.camps}>
        <Camp nom={match.homeTeamName} logo={match.homeTeamLogo} score={aScore ? domicile : null} rang={rang(domicile, exterieur)} />
        <Camp nom={match.awayTeamName} logo={match.awayTeamLogo} score={aScore ? exterieur : null} rang={rang(exterieur, domicile)} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    flexDirection: "row", alignItems: "center", marginHorizontal: 12, marginBottom: 8,
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: rayons.carte, backgroundColor: couleurs.surface,
  },
  // Le filet rouge d'un match en cours ; la marge intérieure compense sa largeur.
  carteDirect: { borderLeftWidth: 3, borderLeftColor: couleurs.direct, paddingLeft: 11 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  temps: { width: 56 },
  minute: { flexDirection: "row", alignItems: "center", gap: 5 },
  minuteTexte: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.direct },
  heure: { fontFamily: polices.texteMoyen, fontSize: 13, color: couleurs.texte },
  fin: { fontFamily: polices.texteGras, fontSize: 11, letterSpacing: 0.5, color: couleurs.texteDiscret },
  camps: { flex: 1, gap: 8 },
  camp: { flexDirection: "row", alignItems: "center", gap: 10 },
  nom: { flex: 1, fontFamily: polices.texte, fontSize: 15, color: couleurs.texte },
  nomDevant: { fontFamily: polices.texteGras },
  score: { minWidth: 24, textAlign: "right", fontFamily: polices.titreMoyen, fontSize: 20, color: couleurs.texte },
  estompe: { color: couleurs.texteSecondaire },
});
