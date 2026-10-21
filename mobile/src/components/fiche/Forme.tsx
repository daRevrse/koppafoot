import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { RESULTATS, type Resultat, type ResultatDeForme } from "@/lib/forme";
import { Ecusson } from "~/components/Ecusson";
import type { Fiche } from "~/lib/fiche-match";
import { couleurs, espacement, polices } from "~/theme";

const { mot, lettre } = RESULTATS.fr;

// Les pastilles de l'en-tête (MatchHero, `PointsDeForme`) : sur le bandeau noir.
const PASTILLE_ENTETE: Record<Resultat, { fond: string; texte: string }> = {
  V: { fond: "#34d399", texte: "#000" },
  N: { fond: "rgba(255,255,255,0.25)", texte: "#fff" },
  D: { fond: "#ef4444", texte: "#fff" },
};

/** La forme sous le nom d'un camp, dans l'en-tête : la plus récente soulignée. */
export function PointsDeForme({ forme }: { forme: Resultat[] }) {
  if (forme.length === 0) return null;
  return (
    <View
      style={styles.points}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Forme, du plus ancien au plus récent : ${forme.map((r) => mot[r]).join(", ")}`}
    >
      {forme.map((r, i) => (
        <View key={i} style={styles.pointBloc}>
          <View style={[styles.point, { backgroundColor: PASTILLE_ENTETE[r].fond }]}>
            <Text style={[styles.pointTexte, { color: PASTILLE_ENTETE[r].texte }]}>{lettre[r]}</Text>
          </View>
          <View style={[styles.souligne, i === forme.length - 1 && { backgroundColor: PASTILLE_ENTETE[r].fond }]} />
        </View>
      ))}
    </View>
  );
}

// Les pastilles de l'onglet Infos (components/match/MatchForme), sur fond sombre.
const PASTILLE: Record<Resultat, { fond: string; texte: string }> = {
  V: { fond: "#059669", texte: "#fff" },
  N: { fond: couleurs.surfaceHaute, texte: couleurs.texteSecondaire },
  D: { fond: "#ef4444", texte: "#fff" },
};

function Colonne({ nom, resultats, cid, droite }: { nom: string; resultats: ResultatDeForme[]; cid: string; droite: boolean }) {
  const router = useRouter();
  return (
    <View style={[styles.colonne, droite ? styles.colonneDroite : null]}>
      <Text style={styles.nomEquipe} numberOfLines={1}>{nom.toUpperCase()}</Text>
      {resultats.length === 0 ? (
        <Text style={styles.aucun}>Aucun match joué</Text>
      ) : (
        <View style={styles.resultats}>
          {resultats.map((r, i) => {
            const dernier = i === resultats.length - 1;
            const detail = `${mot[r.resultat]} ${r.score} contre ${r.adversaire.nom}${dernier ? ", le plus récent" : ""}`;
            return (
              <Pressable
                key={r.matchId}
                accessibilityRole="link"
                accessibilityLabel={detail}
                onPress={() => router.push({ pathname: "/match/[cid]/[mid]", params: { cid, mid: r.matchId } })}
                style={styles.resultat}
              >
                <Ecusson url={r.adversaire.logo} nom={r.adversaire.nom} taille={20} />
                <View style={[styles.pastille, { backgroundColor: PASTILLE[r.resultat].fond }]}>
                  <Text style={[styles.pastilleTexte, { color: PASTILLE[r.resultat].texte }]}>{lettre[r.resultat]}</Text>
                </View>
                <View style={[styles.souligneInfos, dernier && { backgroundColor: PASTILLE[r.resultat].fond }]} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Les derniers résultats des deux équipes, dans l'onglet Infos. Avant la première journée, rien. */
export function FormeDesEquipes({ fiche }: { fiche: Fiche }) {
  const { formes } = fiche.contexte;
  if (!fiche.competition || (formes.domicile.length === 0 && formes.exterieur.length === 0)) return null;
  return (
    <View style={styles.cadre}>
      <Text style={styles.titre}>DERNIERS RÉSULTATS</Text>
      <View style={styles.colonnes}>
        <Colonne nom={fiche.domicile.nom} resultats={formes.domicile} cid={fiche.competition.id} droite={false} />
        <Colonne nom={fiche.exterieur.nom} resultats={formes.exterieur} cid={fiche.competition.id} droite />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  points: { flexDirection: "row", justifyContent: "center", gap: 2, marginTop: 2 },
  pointBloc: { alignItems: "center", gap: 2 },
  point: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  pointTexte: { fontFamily: polices.texteNoir, fontSize: 8 },
  souligne: { width: 14, height: 2 },

  cadre: { marginHorizontal: 16, padding: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  titre: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: couleurs.texteDiscret },
  colonnes: { flexDirection: "row", marginTop: 12 },
  colonne: { flex: 1, minWidth: 0, paddingRight: 12 },
  colonneDroite: { paddingRight: 0, paddingLeft: 12, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: couleurs.bordure },
  nomEquipe: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.texteSecondaire },
  aucun: { marginTop: 12, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  resultats: { flexDirection: "row", justifyContent: "flex-end", gap: 4, marginTop: 12 },
  resultat: { alignItems: "center", gap: 6 },
  pastille: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 10 },
  souligneInfos: { width: 20, height: 2 },
});
