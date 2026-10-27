import { StyleSheet, Text, View } from "react-native";
import { COLONNES_CLASSEMENT } from "@/i18n/foot";
import type { GroupStanding } from "@/lib/poules";
import { Ecusson } from "~/components/Ecusson";
import { creerStyles, espacement, polices } from "~/theme";

const c = COLONNES_CLASSEMENT.fr;

/**
 * La poule du match (components/match/MatchStandings). Sur téléphone, le
 * site garde le nombre de matchs, la différence et les points : G, N et P
 * poussaient Pts hors de l'écran. Les deux équipes du match sont en avant.
 */
export function ClassementDeLaPoule({ poule, domicile, exterieur }: {
  poule: GroupStanding;
  domicile: string | null;
  exterieur: string | null;
}) {
  const styles = useStyles();
  return (
    <View style={styles.cadre}>
      <Text style={styles.titre}>{`POULE ${poule.group}`}</Text>
      <View style={[styles.rangee, styles.entete]}>
        <Text style={[styles.colEquipe, styles.enteteTexte]}>{c.equipe.toUpperCase()}</Text>
        <Text style={[styles.colJ, styles.enteteTexte]} accessibilityLabel={c.jTitre}>{c.j}</Text>
        <Text style={[styles.colDiff, styles.enteteTexte]} accessibilityLabel={c.diffTitre}>{c.diff.toUpperCase()}</Text>
        <Text style={[styles.colPts, styles.enteteTexte]} accessibilityLabel={c.ptsTitre}>{c.pts.toUpperCase()}</Text>
      </View>
      {poule.rows.map((row, i) => {
        const concerne = row.team.id === domicile || row.team.id === exterieur;
        return (
          <View key={row.team.id} style={[styles.rangee, styles.ligne, concerne && styles.enAvant]}>
            <View style={[styles.colEquipe, styles.equipe]}>
              <Text style={styles.rang}>{i + 1}</Text>
              <Ecusson url={row.team.logoUrl} nom={row.team.name} taille={18} />
              <Text style={[styles.nom, concerne && styles.nomEnAvant]} numberOfLines={1}>{row.team.name}</Text>
            </View>
            <Text style={[styles.colJ, styles.chiffre]}>{row.played}</Text>
            <Text style={[styles.colDiff, styles.chiffre]}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</Text>
            <Text style={[styles.colPts, styles.points]}>{row.points}</Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  cadre: { marginHorizontal: 16, padding: 16, backgroundColor: couleurs.surface },
  titre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret, marginBottom: 8 },
  rangee: { flexDirection: "row", alignItems: "center" },
  entete: { paddingBottom: 6 },
  enteteTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.1), color: couleurs.texteDiscret },
  ligne: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  enAvant: { backgroundColor: couleurs.primaireVoile },
  colEquipe: { flex: 1, minWidth: 0 },
  colJ: { width: 32, textAlign: "right" },
  colDiff: { width: 48, textAlign: "right" },
  colPts: { width: 40, textAlign: "right" },
  equipe: { flexDirection: "row", alignItems: "center", gap: 8 },
  rang: { width: 16, textAlign: "right", fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteDiscret },
  nom: { flex: 1, fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texteSecondaire },
  nomEnAvant: { fontFamily: polices.texteNoir, color: couleurs.texte },
  chiffre: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texteSecondaire, fontVariant: ["tabular-nums"] },
  points: { fontFamily: polices.texteNoir, fontSize: 13, color: couleurs.texte, fontVariant: ["tabular-nums"] },
}));
