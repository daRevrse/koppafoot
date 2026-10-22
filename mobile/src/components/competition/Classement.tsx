import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { COLONNES_CLASSEMENT } from "@/i18n/foot";
import { computeStandings } from "@/lib/poules";
import type { Competition, CompMatch, CompTeam } from "@/types";
import { Bloc } from "~/components/competition/Bloc";
import { Puces } from "~/components/competition/Puces";
import { Ecusson } from "~/components/Ecusson";
import { EtatVide } from "~/components/EtatVide";
import { couleurs, espacement, polices } from "~/theme";

const c = COLONNES_CLASSEMENT.fr;
const diff = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Le classement (StandingsTab du site) : une pastille par poule, puis la
 * poule choisie. Sur téléphone, les buts marqués et encaissés s'effacent
 * (la différence les résume) pour que les points tiennent à l'écran ; les
 * qualifiés sont en vert, une équipe disqualifiée barrée.
 */
export function Classement({ competition, matchs, equipes }: {
  competition: Competition;
  matchs: CompMatch[] | null;
  equipes: CompTeam[];
}) {
  const router = useRouter();
  const [choix, setChoix] = useState<string | null>(null);
  if (matchs === null) return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;

  const poules = computeStandings(matchs, equipes, competition.format);
  if (poules.length === 0) {
    return <EtatVide icone="list-outline" texte="Classement vide : aucune poule ni aucun résultat pour l'instant." />;
  }
  const poule = poules.find((p) => p.group === choix) ?? poules[0];
  const qualifies = competition.format.qualifiers_per_group ?? 0;

  return (
    <View>
      {poules.length > 1 ? (
        <Puces puces={poules.map((p) => ({ cle: p.group, libelle: `Poule ${p.group}` }))} actif={poule.group} onChange={setChoix} />
      ) : null}
      <Bloc titre={`Groupe ${poule.group}`}>
        <View style={[styles.rangee, styles.entete]}>
          <Text style={[styles.colRang, styles.enteteTexte]}>#</Text>
          <Text style={[styles.colEquipe, styles.enteteTexte]}>{c.equipe.toUpperCase()}</Text>
          {([["j", c.jTitre], ["g", c.gTitre], ["n", c.nTitre], ["p", c.pTitre]] as const).map(([cle, titre]) => (
            <Text key={cle} style={[styles.colChiffre, styles.enteteTexte]} accessibilityLabel={titre}>{c[cle].toUpperCase()}</Text>
          ))}
          <Text style={[styles.colDiff, styles.enteteTexte]} accessibilityLabel={c.diffTitre}>{c.diff.toUpperCase()}</Text>
          <Text style={[styles.colPts, styles.enteteTexte]} accessibilityLabel={c.ptsTitre}>{c.pts.toUpperCase()}</Text>
        </View>
        {poule.rows.map((ligne, i) => {
          const qualifie = i < qualifies;
          const dq = !!ligne.team.disqualified;
          return (
            <Pressable
              key={ligne.team.id}
              accessibilityRole="link"
              accessibilityLabel={`${i + 1}, ${ligne.team.name}, ${ligne.points} points`}
              onPress={() => router.push({ pathname: "/equipe/[cid]/[tid]", params: { cid: competition.id, tid: ligne.team.id } })}
              style={({ pressed }) => [styles.rangee, styles.ligne, qualifie && styles.ligneQualifiee, pressed && styles.presse]}
            >
              <View style={styles.colRang}>
                <Text style={[styles.rang, qualifie && styles.rangQualifie]}>{i + 1}</Text>
              </View>
              <View style={[styles.colEquipe, styles.equipe]}>
                <Ecusson url={ligne.team.logoUrl} nom={ligne.team.name} taille={20} />
                <Text style={[styles.nom, dq && styles.barre]} numberOfLines={1}>{ligne.team.name}</Text>
                {dq ? <Text style={styles.dq}>DQ</Text> : null}
              </View>
              {[ligne.played, ligne.won, ligne.drawn, ligne.lost].map((n, k) => (
                <Text key={k} style={[styles.colChiffre, styles.chiffre]}>{n}</Text>
              ))}
              <Text style={[styles.colDiff, styles.chiffre]}>{diff(ligne.goalDiff)}</Text>
              <Text style={[styles.colPts, styles.points]}>{ligne.points}</Text>
            </Pressable>
          );
        })}
        {qualifies > 0 ? (
          <View style={styles.legende}>
            <View style={styles.pastille} />
            <Text style={styles.legendeTexte}>{qualifies === 1 ? "Qualifié" : `${qualifies} premiers qualifiés`}</Text>
          </View>
        ) : null}
      </Bloc>
    </View>
  );
}

const styles = StyleSheet.create({
  chargement: { paddingVertical: 40 },
  rangee: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  entete: { paddingBottom: 8 },
  enteteTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.1), color: couleurs.texteDiscret },
  ligne: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  ligneQualifiee: { backgroundColor: couleurs.primaireVoile },
  presse: { backgroundColor: couleurs.surfaceHaute },
  colRang: { width: 28, alignItems: "center" },
  colEquipe: { flex: 1, minWidth: 0 },
  colChiffre: { width: 24, textAlign: "center" },
  colDiff: { width: 36, textAlign: "center" },
  colPts: { width: 32, textAlign: "center" },
  rang: { fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.texteDiscret },
  rangQualifie: { color: couleurs.primaire },
  equipe: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4 },
  nom: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  barre: { color: couleurs.texteDiscret, textDecorationLine: "line-through" },
  dq: { fontFamily: polices.texteNoir, fontSize: 9, color: couleurs.erreur },
  chiffre: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteSecondaire },
  points: { fontFamily: polices.texteNoir, fontSize: 14, color: couleurs.texte },
  legende: {
    flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  pastille: { width: 10, height: 10, backgroundColor: couleurs.primaire },
  legendeTexte: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire },
});
