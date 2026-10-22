import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { matchDuration } from "@/lib/competition-format";
import { estLigneDossard } from "@/lib/dossards";
import { computeSquadStats } from "@/lib/player-stats";
import type { Competition, CompMatch, CompTeam } from "@/types";
import { stylesBloc } from "~/components/competition/Bloc";
import { Ecusson } from "~/components/Ecusson";
import { EtatVide } from "~/components/EtatVide";
import { usePhotosDesLignes } from "~/hooks/usePhotos";
import { initiales } from "~/lib/initiales";
import { equipesRangees } from "~/lib/page-competition";
import { couleurs, espacement, polices } from "~/theme";

const joueurs = (n: number, feminin: boolean) => `${n} ${feminin ? "joueuse" : "joueur"}${n > 1 ? "s" : ""}`;

/** L'effectif chiffré d'une équipe (EffectifChiffre) : matchs joués, buts, passes, cartons. */
function Effectif({ competition, equipe, matchs, feminin }: {
  competition: Competition;
  equipe: CompTeam;
  matchs: CompMatch[];
  feminin: boolean;
}) {
  const router = useRouter();
  const lignes = computeSquadStats(matchs, equipe.id, equipe.players, matchDuration(competition.format));
  const photos = usePhotosDesLignes(equipe.players, equipe.claimedByTeamId);
  return (
    <View style={styles.effectif}>
      {lignes.length === 0 ? (
        <Text style={styles.aucun}>Effectif non communiqué.</Text>
      ) : (
        <>
          <View style={styles.rangee}>
            <Text style={[styles.colJoueur, styles.entete]}>{feminin ? "JOUEUSE" : "JOUEUR"}</Text>
            <Text style={[styles.colChiffre, styles.entete]} accessibilityLabel="Matchs joués">MJ</Text>
            <Text style={[styles.colChiffre, styles.entete]} accessibilityLabel="Buts">B</Text>
            <Text style={[styles.colChiffre, styles.entete]} accessibilityLabel="Passes décisives">PD</Text>
            <View style={styles.colChiffre} accessible accessibilityLabel="Cartons jaunes"><View style={[styles.carton, styles.jaune]} /></View>
            <View style={styles.colChiffre} accessible accessibilityLabel="Cartons rouges"><View style={[styles.carton, styles.rouge]} /></View>
          </View>
          {lignes.map(({ player, stats }) => {
            const photo = photos[player.id];
            // Une ligne au dossard s'appelle déjà « N°10 » : son numéro ne se répète pas.
            const dossard = estLigneDossard(player.id);
            return (
              <View key={player.id} style={[styles.rangee, styles.ligneJoueur]}>
                <View style={[styles.colJoueur, styles.joueur]}>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.visage} contentFit="cover" />
                  ) : (
                    // Sans photo, la pastille garde son numéro, comme sur le terrain de la fiche.
                    <View style={[styles.visage, styles.sansVisage]}>
                      <Text style={styles.initiales}>{player.number || initiales(player.name)}</Text>
                    </View>
                  )}
                  <Text style={styles.nomJoueur} numberOfLines={1}>{player.name}</Text>
                  {player.number && !dossard ? <Text style={styles.numero}>{`#${player.number}`}</Text> : null}
                </View>
                <Text style={[styles.colChiffre, styles.chiffre]}>{stats.matchesPlayed}</Text>
                <Text style={[styles.colChiffre, styles.chiffre, stats.goals > 0 && styles.buts]}>{stats.goals}</Text>
                {[stats.assists, stats.yellowCards, stats.redCards].map((n, i) => (
                  <Text key={i} style={[styles.colChiffre, styles.chiffre, n === 0 && styles.zero]}>{n}</Text>
                ))}
              </View>
            );
          })}
        </>
      )}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: "/equipe/[cid]/[tid]", params: { cid: competition.id, tid: equipe.id } })}
        style={styles.fiche}
        hitSlop={6}
      >
        <Text style={styles.ficheTexte}>FICHE DE L&apos;ÉQUIPE</Text>
        <Ionicons name="chevron-forward" size={13} color={couleurs.primaire} />
      </Pressable>
    </View>
  );
}

/** Les équipes (TeamsTab du site) : une ligne par équipe, qui déplie son effectif chiffré. */
export function Equipes({ competition, matchs, equipes }: {
  competition: Competition;
  matchs: CompMatch[] | null;
  equipes: CompTeam[];
}) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  if (equipes.length === 0) return <EtatVide icone="people-outline" texte="Aucune équipe inscrite." />;
  const feminin = competition.category === "women";
  const plusieursPoules = new Set(equipes.map((e) => e.group).filter(Boolean)).size > 1;

  return (
    <View style={styles.cadre}>
      {equipesRangees(equipes).map((e, i) => {
        const ouvert = ouverte === e.id;
        const details = [plusieursPoules && e.group ? `Groupe ${e.group}` : null, joueurs(e.players.length, feminin)].filter(Boolean);
        return (
          <View key={e.id}>
            <Pressable
              accessibilityRole="button"
              aria-expanded={ouvert}
              onPress={() => setOuverte(ouvert ? null : e.id)}
              style={({ pressed }) => [stylesBloc.ligne, i === 0 && styles.premiere, pressed && styles.presse]}
            >
              <Ecusson url={e.logoUrl} nom={e.name} taille={32} />
              <View style={styles.textes}>
                <Text style={styles.nom} numberOfLines={1}>{e.name}</Text>
                <View style={styles.details}>
                  <Text style={styles.detail}>{details.join(" · ")}</Text>
                  {e.invitee ? <Text style={[styles.badge, styles.invitee]}>INVITÉE</Text> : null}
                  {e.disqualified ? <Text style={[styles.badge, styles.disqualifiee]}>DISQUALIFIÉE</Text> : null}
                </View>
              </View>
              <Ionicons name={ouvert ? "chevron-up" : "chevron-down"} size={18} color={couleurs.texteDiscret} />
            </Pressable>
            {ouvert ? <Effectif competition={competition} equipe={e} matchs={matchs ?? []} feminin={feminin} /> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { marginHorizontal: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  premiere: { borderTopWidth: 0 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  textes: { flex: 1, minWidth: 0 },
  nom: { fontFamily: polices.titreMoyen, fontSize: 16, color: couleurs.texte },
  details: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 },
  detail: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  badge: { paddingHorizontal: 5, paddingVertical: 1, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: 0.5 },
  invitee: { color: "#7dd3fc", backgroundColor: "rgba(56,189,248,0.12)" },
  disqualifiee: { color: couleurs.erreur, backgroundColor: "rgba(248,113,113,0.12)" },

  effectif: { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: couleurs.fond, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  aucun: { paddingVertical: 12, textAlign: "center", fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteDiscret },
  rangee: { flexDirection: "row", alignItems: "center" },
  ligneJoueur: { paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  colJoueur: { flex: 1, minWidth: 0 },
  colChiffre: { width: 28, alignItems: "center", textAlign: "center" },
  entete: { paddingBottom: 6, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  carton: { width: 9, height: 12, marginBottom: 6 },
  jaune: { backgroundColor: "#FBBF24" },
  rouge: { backgroundColor: "#dc2626" },
  joueur: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 4 },
  visage: { width: 26, height: 26, borderRadius: 13 },
  sansVisage: { backgroundColor: couleurs.surfaceHaute, alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteGras, fontSize: 10, color: couleurs.texteSecondaire },
  nomJoueur: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  numero: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  chiffre: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteSecondaire },
  buts: { fontFamily: polices.texteNoir, color: couleurs.primaire },
  zero: { color: couleurs.texteDiscret },
  fiche: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  ficheTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
});
