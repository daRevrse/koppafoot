import { Text, View } from "react-native";
import { couleursDesBarres } from "@/lib/couleurs-equipe";
import type { Fiche } from "~/lib/fiche-match";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/**
 * Les compteurs du match (components/match/MatchStats) : les deux nombres,
 * le libellé au centre, une barre aux couleurs des deux camps. Les lignes
 * viennent de lib/stats-match, comme sur le site et dans la console.
 */
export function StatsDuMatch({ fiche }: { fiche: Fiche }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const { stats, maillots } = fiche.contexte;
  if (stats.length === 0) return null;
  const teintes = maillots ? couleursDesBarres(maillots.home, maillots.away, couleurs.surfaceHaute) : null;
  const home = teintes?.home ?? "#10b981";
  const away = teintes?.away ?? couleurs.texteSecondaire;

  return (
    <View style={styles.cadre}>
      {stats.map((ligne) => {
        const total = ligne.home + ligne.away;
        const partDomicile = total === 0 ? 0 : (ligne.home / total) * 100;
        const valeur = (n: number) => (ligne.pourcent ? `${n} %` : String(n));
        return (
          <View key={ligne.cle} style={styles.ligne}>
            <View style={styles.chiffres}>
              <Text style={[styles.chiffre, styles.aGauche]}>{valeur(ligne.home)}</Text>
              <Text style={styles.libelle} numberOfLines={1}>{ligne.label.toUpperCase()}</Text>
              <Text style={[styles.chiffre, styles.aDroite]}>{valeur(ligne.away)}</Text>
            </View>
            <View style={styles.piste}>
              <View style={{ width: `${partDomicile}%`, backgroundColor: home }} />
              <View style={{ width: `${total === 0 ? 0 : 100 - partDomicile}%`, backgroundColor: away }} />
            </View>
          </View>
        );
      })}
      <View style={styles.legende}>
        <View style={styles.camp}>
          <View style={[styles.point, { backgroundColor: home }]} />
          <Text style={styles.legendeTexte} numberOfLines={1}>{fiche.domicile.nom.toUpperCase()}</Text>
        </View>
        <View style={styles.camp}>
          <Text style={styles.legendeTexte} numberOfLines={1}>{fiche.exterieur.nom.toUpperCase()}</Text>
          <View style={[styles.point, { backgroundColor: away }]} />
        </View>
      </View>
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  cadre: { marginHorizontal: 16, padding: 16, gap: 18, backgroundColor: couleurs.surface },
  ligne: { gap: 6 },
  chiffres: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  chiffre: { width: 48, fontFamily: polices.texteNoir, fontSize: 15, color: couleurs.texte, fontVariant: ["tabular-nums"] },
  aGauche: { textAlign: "left" },
  aDroite: { textAlign: "right" },
  libelle: {
    flex: 1, textAlign: "center", fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.05),
    color: couleurs.texteDiscret,
  },
  piste: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: couleurs.surfaceHaute },
  legende: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingTop: 2 },
  camp: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  point: { width: 8, height: 8, borderRadius: 4 },
  legendeTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.05), color: couleurs.texteSecondaire, flexShrink: 1 },
}));
