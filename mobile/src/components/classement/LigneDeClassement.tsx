import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LigneJoueurPubliee, TriClassement } from "@/lib/classement";
import { formaterNote } from "@/lib/notes";
import { PastilleNote } from "~/components/fiche/JoueurDuMatch";
import { initiales } from "~/lib/initiales";
import { creerStyles, espacement, polices, useCouleurs, type Couleurs } from "~/theme";

/** Le podium se voit : or, argent, bronze ; le reste se tait. */
const couleursDuPodium = (couleurs: Couleurs): Record<number, string> => ({
  1: couleurs.accent, 2: couleurs.argent, 3: couleurs.bronze,
});

/**
 * La flèche : les places gagnées depuis le calcul précédent. Rien du tout sur
 * une entrée nouvelle : elle n'a pas grimpé de vingt places, elle vient
 * d'arriver.
 */
function Mouvement({ mouvement }: { mouvement: number | null }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  if (mouvement === null) return <View style={styles.mouvement} />;
  if (mouvement === 0) {
    return (
      <View style={styles.mouvement} accessibilityLabel="Même place">
        <Text style={styles.mouvementNul}>–</Text>
      </View>
    );
  }
  const monte = mouvement > 0;
  const teinte = monte ? couleurs.primaire : couleurs.direct;
  return (
    <View
      style={[styles.mouvement, styles.mouvementPlein, { backgroundColor: monte ? couleurs.primaireVoile : couleurs.directVoile }]}
      accessibilityLabel={`${Math.abs(mouvement)} place${Math.abs(mouvement) > 1 ? "s" : ""} ${monte ? "gagnée" : "perdue"}${Math.abs(mouvement) > 1 ? "s" : ""}`}
    >
      <Ionicons name={monte ? "arrow-up" : "arrow-down"} size={10} color={teinte} />
      <Text style={[styles.mouvementTexte, { color: teinte }]}>{Math.abs(mouvement)}</Text>
    </View>
  );
}

/**
 * Une ligne du classement des joueurs (components/classement/LigneDeClassement
 * du site), dans sa version téléphone : sans la frise des notes ni le club,
 * que le site cache aussi à cette largeur.
 *
 * Un joueur et un gardien se lisent différemment, dans la même liste : des
 * buts et des passes pour un joueur de champ, des arrêts et des matchs sans
 * but encaissé pour un gardien, qui porte en plus son « G ».
 */
export function LigneDeClassement({ ligne, tri, toi, premiere, onPress }: {
  ligne: LigneJoueurPubliee;
  tri: TriClassement;
  /** La ligne du compte connecté. */
  toi: boolean;
  premiere: boolean;
  /** Absent : une ligne sans compte n'a pas de fiche. */
  onPress?: () => void;
}) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const rang = (tri === "note" ? ligne.rangNote : ligne.rangContribution) ?? 0;
  const mouvement = tri === "note" ? ligne.mouvementNote : ligne.mouvementContribution;
  const [premier, second] = ligne.gardien
    ? [`${ligne.arrets} arrêt${ligne.arrets > 1 ? "s" : ""}`, `${ligne.cleanSheets} sans but encaissé`]
    : [`${ligne.buts} but${ligne.buts > 1 ? "s" : ""}`, `${ligne.passes} passe${ligne.passes > 1 ? "s" : ""} décisive${ligne.passes > 1 ? "s" : ""}`];
  const valeur = tri === "note"
    ? `note ${formaterNote(ligne.note, "fr")}`
    : `${ligne.total} ${ligne.total > 1 ? "buts et passes" : "but ou passe"}`;

  return (
    <Pressable
      disabled={!onPress}
      accessibilityRole={onPress ? "link" : undefined}
      accessibilityLabel={`${rang === 1 ? "1er" : `${rang}e`}, ${ligne.nom}${ligne.gardien ? ", gardien" : ""}, ${valeur}, ${premier}, ${second}, sur ${ligne.matchs} matchs`}
      onPress={onPress}
      style={({ pressed }) => [styles.ligne, !premiere && styles.separee, pressed && styles.presse]}
    >
      <Text style={[styles.rang, { color: couleursDuPodium(couleurs)[rang] ?? couleurs.texteDiscret }]}>{rang}</Text>

      {ligne.photo ? (
        <Image source={{ uri: ligne.photo }} style={styles.visage} contentFit="cover" />
      ) : (
        <View style={[styles.visage, styles.sansVisage]}>
          <Text style={styles.initiales}>{initiales(ligne.nom)}</Text>
        </View>
      )}

      <View style={styles.joueur}>
        <View style={styles.titre}>
          <Text style={styles.nom} numberOfLines={1}>{ligne.nom}</Text>
          {ligne.gardien ? <Text style={styles.gardien}>G</Text> : null}
          {toi ? <Text style={styles.toi}>TOI</Text> : null}
        </View>
        <View style={styles.detail}>
          {ligne.gardien ? (
            <>
              <Text style={styles.chiffre}>{ligne.arrets}</Text>
              <Ionicons name="hand-left" size={11} color={couleurs.primaire} />
              <Text style={[styles.chiffre, styles.suivant]}>{ligne.cleanSheets}</Text>
              <Ionicons name="shield-checkmark" size={11} color={couleurs.info} />
            </>
          ) : (
            <>
              <Text style={styles.chiffre}>{ligne.buts}</Text>
              <Ionicons name="football" size={11} color={couleurs.primaire} />
              <Text style={[styles.chiffre, styles.suivant]}>{ligne.passes}</Text>
              <Ionicons name="footsteps" size={11} color={couleurs.bronze} />
            </>
          )}
          <Text style={[styles.matchs, styles.suivant]}>{`${ligne.matchs} m`}</Text>
        </View>
      </View>

      {tri === "note" ? (
        <PastilleNote note={ligne.note} />
      ) : (
        <Text style={styles.total}>
          {ligne.total}
          <Text style={styles.unite}> G/A</Text>
        </Text>
      )}

      <Mouvement mouvement={mouvement} />
    </Pressable>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ligne: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  separee: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  presse: { backgroundColor: couleurs.surfaceHaute },
  rang: { width: 24, textAlign: "center", fontFamily: polices.texteNoir, fontSize: 12, fontVariant: ["tabular-nums"] },
  visage: { width: 32, height: 32, borderRadius: 16 },
  sansVisage: { backgroundColor: couleurs.surfaceHaute, alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  joueur: { flex: 1, minWidth: 0, gap: 3 },
  titre: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  nom: { flexShrink: 1, fontFamily: polices.texteNoir, fontSize: 13, color: couleurs.texte },
  gardien: {
    paddingHorizontal: 4, paddingVertical: 1, backgroundColor: couleurs.infoVoile,
    fontFamily: polices.texteNoir, fontSize: 9, color: couleurs.info,
  },
  toi: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.1), color: couleurs.primaire },
  detail: { flexDirection: "row", alignItems: "center", gap: 3 },
  chiffre: { fontFamily: polices.texteNoir, fontSize: 11, fontVariant: ["tabular-nums"], color: couleurs.texteSecondaire },
  suivant: { marginLeft: 7 },
  matchs: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  total: { fontFamily: polices.texteNoir, fontSize: 13, fontVariant: ["tabular-nums"], color: couleurs.texte },
  unite: { color: couleurs.texteDiscret },
  mouvement: { width: 36, alignItems: "center", justifyContent: "center" },
  mouvementPlein: { flexDirection: "row", gap: 1, paddingVertical: 2, borderRadius: 999 },
  mouvementTexte: { fontFamily: polices.texteNoir, fontSize: 11, fontVariant: ["tabular-nums"] },
  mouvementNul: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteDiscret },
}));
