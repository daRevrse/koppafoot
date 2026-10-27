import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { nombreFr } from "@/lib/audience";
import { matchsQuiComptent } from "@/lib/exhibition";
import { computeForm, computeTopAssisters, computeTopScorers, type ResultatDeForme } from "@/lib/performances-competition";
import { couvertureLisible, parMatchLisible, statsDeJeu, titreDuRecord } from "@/lib/stats-competition";
import type { Competition, CompMatch, CompTeam } from "@/types";
import { Bloc, useStylesBloc } from "~/components/competition/Bloc";
import { Ecusson } from "~/components/Ecusson";
import { creerStyles, espacement, polices, useCouleurs, type Couleurs } from "~/theme";

/** Au-delà, la liste se replie : « Voir les 34 buteurs ». */
const REPLI = 10;

// Les couleurs du podium (ScorersTab du site) : or, argent, bronze.
const couleursDuPodium = (couleurs: Couleurs) => [couleurs.accent, couleurs.argent, couleurs.bronze];

// La forme du rail du site, avec les lettres et les pastilles de l'application.
const pastillesDeForme = (couleurs: Couleurs): Record<ResultatDeForme, { lettre: string; mot: string; fond: string; texte: string }> => ({
  W: { lettre: "V", mot: "Victoire", fond: "#059669", texte: "#fff" },
  D: { lettre: "N", mot: "Nul", fond: couleurs.pastilleNeutre, texte: couleurs.texteSecondaire },
  L: { lettre: "D", mot: "Défaite", fond: "#ef4444", texte: "#fff" },
});

interface LigneJoueur { cle: string; nom: string; equipe: CompTeam | undefined; valeur: number }

function ListeDeJoueurs({ titre, lignes, unite, podium, vide }: {
  titre: string;
  lignes: LigneJoueur[];
  unite: (n: number) => string;
  podium?: boolean;
  vide: string;
}) {
  const stylesBloc = useStylesBloc();
  const styles = useStyles();
  const couleurs = useCouleurs();
  const [tout, setTout] = useState(false);
  const montrees = tout ? lignes : lignes.slice(0, REPLI);
  return (
    <Bloc titre={titre}>
      {lignes.length === 0 ? <Text style={stylesBloc.vide}>{vide}</Text> : null}
      {montrees.map((l, i) => (
        <View key={l.cle} style={stylesBloc.ligne} accessible accessibilityLabel={`${i + 1}, ${l.nom}, ${l.valeur} ${unite(l.valeur)}`}>
          <Text style={[styles.rang, podium && i < 3 && { color: couleursDuPodium(couleurs)[i] }]}>{i + 1}</Text>
          <View style={styles.joueur}>
            <Text style={styles.nom} numberOfLines={1}>{l.nom}</Text>
            {l.equipe ? (
              <View style={styles.equipe}>
                <Ecusson url={l.equipe.logoUrl} nom={l.equipe.name} taille={14} />
                <Text style={styles.nomEquipe} numberOfLines={1}>{l.equipe.name.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.valeur}>{l.valeur}</Text>
        </View>
      ))}
      {lignes.length > REPLI ? (
        <Pressable accessibilityRole="button" onPress={() => setTout(!tout)} style={styles.plus}>
          <Text style={styles.plusTexte}>{tout ? "RÉDUIRE" : `VOIR LES ${lignes.length}`}</Text>
          <Ionicons name={tout ? "chevron-up" : "chevron-down"} size={14} color={couleurs.primaire} />
        </Pressable>
      ) : null}
    </Bloc>
  );
}

/**
 * Les stats d'une compétition : les buteurs (l'onglet Buteurs du site), les
 * passeurs et la forme des équipes (son rail), puis les statistiques de jeu
 * si l'organisateur les a publiées (PanneauStatsDeJeu).
 */
export function StatsCompetition({ competition, matchs, equipes, onOuvrir }: {
  competition: Competition;
  matchs: CompMatch[] | null;
  equipes: CompTeam[];
  onOuvrir: (mid: string) => void;
}) {
  const stylesBloc = useStylesBloc();
  const styles = useStyles();
  const couleurs = useCouleurs();
  if (matchs === null) return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;
  const parId = new Map(equipes.map((e) => [e.id, e]));
  const officiels = matchsQuiComptent(matchs);
  const buteurs = computeTopScorers(matchs).map((b) => ({
    cle: `${b.teamId}-${b.playerName}`, nom: b.playerName, equipe: parId.get(b.teamId), valeur: b.goals,
  }));
  const passeurs = computeTopAssisters(officiels).map((p) => ({
    cle: `${p.teamId}-${p.playerName}`, nom: p.playerName, equipe: parId.get(p.teamId), valeur: p.assists,
  }));
  const formes = computeForm(officiels, equipes);
  const FORME = pastillesDeForme(couleurs);
  const jeu = competition.statsPubliques ? statsDeJeu(matchs) : null;

  return (
    <View style={styles.colonne}>
      <ListeDeJoueurs
        titre="Meilleurs buteurs" lignes={buteurs} unite={(n) => (n > 1 ? "buts" : "but")} podium
        vide="Aucun buteur enregistré pour l'instant : les buts nommés apparaîtront ici."
      />
      {passeurs.length > 0 ? (
        <ListeDeJoueurs
          titre="Meilleurs passeurs" lignes={passeurs} unite={(n) => (n > 1 ? "passes décisives" : "passe décisive")}
          vide=""
        />
      ) : null}
      {formes.length > 0 ? (
        <Bloc titre="Forme des équipes">
          {formes.map((fo) => (
            <View
              key={fo.team.id}
              style={stylesBloc.ligne}
              accessible
              accessibilityLabel={`${fo.team.name}, du plus ancien au plus récent : ${fo.results.map((r) => FORME[r].mot).join(", ")}`}
            >
              <Ecusson url={fo.team.logoUrl} nom={fo.team.name} taille={20} />
              <Text style={[styles.nom, styles.flexible]} numberOfLines={1}>{fo.team.name}</Text>
              <View style={styles.pastilles}>
                {fo.results.map((r, i) => (
                  <View key={i} style={[styles.pastille, { backgroundColor: FORME[r].fond }]}>
                    <Text style={[styles.pastilleTexte, { color: FORME[r].texte }]}>{FORME[r].lettre}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Bloc>
      ) : null}
      {jeu && jeu.joues > 0 ? (
        <>
          <Bloc titre="Les totaux">
            <Text style={stylesBloc.vide}>{couvertureLisible(jeu)}</Text>
            <View style={styles.grille}>
              {jeu.totaux.map((t) => (
                <View key={t.cle} style={styles.case}>
                  <Text style={styles.caseLabel}>{t.label}</Text>
                  <Text style={styles.caseTotal}>{nombreFr(t.total)}</Text>
                  <Text style={styles.caseMoyenne}>{`${parMatchLisible(t.parMatch)} par match`}</Text>
                </View>
              ))}
            </View>
          </Bloc>
          {jeu.records.length > 0 ? (
            <Bloc titre="Les records">
              {jeu.records.map((r) => (
                <Pressable
                  key={r.cle}
                  accessibilityRole="link"
                  onPress={() => onOuvrir(r.matchId)}
                  style={({ pressed }) => [stylesBloc.ligne, pressed && styles.presse]}
                >
                  <Text style={styles.record}>{r.n}</Text>
                  <View style={styles.joueur}>
                    <Text style={styles.nomEquipe}>{titreDuRecord(r.label).toUpperCase()}</Text>
                    <Text style={styles.nom} numberOfLines={1}>{r.affiche}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={couleurs.texteDiscret} />
                </Pressable>
              ))}
            </Bloc>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  chargement: { paddingVertical: 40 },
  colonne: { gap: 16 },
  rang: { width: 20, textAlign: "right", fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.texteDiscret },
  joueur: { flex: 1, minWidth: 0, gap: 3 },
  flexible: { flex: 1 },
  nom: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  equipe: { flexDirection: "row", alignItems: "center", gap: 6 },
  nomEquipe: { flexShrink: 1, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  valeur: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  plus: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  plusTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
  pastilles: { flexDirection: "row", gap: 4 },
  pastille: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 10 },
  grille: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  case: {
    width: "50%", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: couleurs.bordure,
  },
  caseLabel: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire },
  caseTotal: { marginTop: 4, fontFamily: polices.titre, fontSize: 24, color: couleurs.texte },
  caseMoyenne: { marginTop: 2, fontFamily: polices.texte, fontSize: 11, color: couleurs.texteDiscret },
  presse: { backgroundColor: couleurs.surfaceHaute },
  record: { width: 36, textAlign: "center", fontFamily: polices.titre, fontSize: 20, color: couleurs.primaire },
}));
