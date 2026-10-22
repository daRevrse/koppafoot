import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { estLigneDossard } from "@/lib/dossards";
import { effectifParPoste } from "@/lib/fiche-club";
import { EtatVide } from "~/components/EtatVide";
import { useAuth } from "~/lib/auth";
import { initiales } from "~/lib/initiales";
import { couleurs, espacement, polices } from "~/theme";

/** Une ligne d'effectif, d'où qu'elle vienne : une équipe de compétition, un club. */
export interface LigneDEffectif {
  cle: string;
  nom: string;
  numero: string | null;
  poste: string | null;
  photo: string | null;
  /** Le compte derrière la ligne : il ouvre sa fiche. Null sans compte. */
  uid: string | null;
}

/**
 * L'effectif rangé comme une feuille de match (components/team/EffectifParPoste
 * du site) : du but vers l'attaque, puis par numéro. Le compte connecté se
 * reconnaît à « Toi », et un joueur qui a un compte ouvre sa fiche.
 */
export function ListeEffectif({ lignes, feminin }: { lignes: LigneDEffectif[]; feminin: boolean }) {
  const router = useRouter();
  const { utilisateur } = useAuth();
  const groupes = effectifParPoste(lignes, "fr", feminin);
  if (groupes.length === 0) return <EtatVide icone="people-outline" texte="Effectif non communiqué." />;

  return (
    <View style={styles.colonne}>
      {groupes.map((g) => (
        <View key={g.titre}>
          <Text style={styles.titre} accessibilityRole="header">
            {g.titre.toUpperCase()}
            <Text style={styles.nombre}>{`  ${g.joueurs.length}`}</Text>
          </Text>
          <View style={styles.cadre}>
            {g.joueurs.map((j, i) => {
              const toi = !!j.uid && j.uid === utilisateur?.uid;
              return (
                <Pressable
                  key={j.cle}
                  // Un joueur qui a un compte a sa fiche ; une ligne sans compte, non.
                  disabled={!j.uid}
                  accessibilityRole={j.uid ? "link" : undefined}
                  onPress={() => j.uid && router.push({ pathname: "/joueur/[uid]", params: { uid: j.uid } })}
                  style={({ pressed }) => [styles.ligne, i > 0 && styles.separee, pressed && styles.presse]}
                >
                  <Text style={styles.numero}>{j.numero?.trim() || "–"}</Text>
                  {j.photo ? (
                    <Image source={{ uri: j.photo }} style={styles.visage} contentFit="cover" />
                  ) : (
                    <View style={[styles.visage, styles.sansVisage]}>
                      {/* Une ligne au dossard n'a pas d'initiales : « N°10 » est déjà son nom et son numéro. */}
                      {estLigneDossard(j.cle)
                        ? <Ionicons name="person" size={14} color={couleurs.texteDiscret} />
                        : <Text style={styles.initiales}>{initiales(j.nom)}</Text>}
                    </View>
                  )}
                  <Text style={styles.nom} numberOfLines={1}>{j.nom}</Text>
                  {toi ? <Text style={styles.toi}>TOI</Text> : null}
                  {j.uid ? <Ionicons name="chevron-forward" size={14} color={couleurs.texteDiscret} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  colonne: { gap: 16, paddingHorizontal: 16 },
  titre: { marginBottom: 6, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.15), color: couleurs.texteDiscret },
  nombre: { color: couleurs.bordureForte },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  ligne: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  separee: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  presse: { backgroundColor: couleurs.surfaceHaute },
  numero: { width: 24, textAlign: "right", fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.texteDiscret },
  visage: { width: 30, height: 30, borderRadius: 15 },
  sansVisage: { backgroundColor: couleurs.surfaceHaute, alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  nom: { flex: 1, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  toi: {
    paddingHorizontal: 6, paddingVertical: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: 0.5,
    color: couleurs.primaire, backgroundColor: couleurs.primaireVoile,
  },
});
