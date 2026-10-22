import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { estLigneDossard } from "@/lib/dossards";
import { effectifParPoste } from "@/lib/fiche-club";
import type { CompPlayer } from "@/types";
import { EtatVide } from "~/components/EtatVide";
import { usePhotosDesLignes } from "~/hooks/usePhotos";
import { useAuth } from "~/lib/auth";
import { initiales } from "~/lib/initiales";
import { couleurs, espacement, polices } from "~/theme";

/**
 * L'effectif rangé comme une feuille de match (components/team/EffectifParPoste
 * du site) : du but vers l'attaque, puis par numéro. Le compte connecté se
 * reconnaît à « Toi ». Rattacher une ligne à son compte se fait sur le site.
 */
export function EffectifParPoste({ joueurs, clubId, feminin }: {
  joueurs: CompPlayer[];
  clubId: string | null | undefined;
  feminin: boolean;
}) {
  const { utilisateur } = useAuth();
  const photos = usePhotosDesLignes(joueurs, clubId);
  const lignes = joueurs.map((p) => ({ ...p, nom: p.name, numero: p.number, poste: p.position ?? null }));
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
              const photo = photos[j.id];
              const toi = !!j.user_id && j.user_id === utilisateur?.uid;
              return (
                <View key={j.id} style={[styles.ligne, i > 0 && styles.separee]}>
                  <Text style={styles.numero}>{j.number?.trim() || "–"}</Text>
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.visage} contentFit="cover" />
                  ) : (
                    <View style={[styles.visage, styles.sansVisage]}>
                      {/* Une ligne au dossard n'a pas d'initiales : « N°10 » est déjà son nom et son numéro. */}
                      {estLigneDossard(j.id)
                        ? <Ionicons name="person" size={14} color={couleurs.texteDiscret} />
                        : <Text style={styles.initiales}>{initiales(j.name)}</Text>}
                    </View>
                  )}
                  <Text style={styles.nom} numberOfLines={1}>{j.name}</Text>
                  {toi ? <Text style={styles.toi}>TOI</Text> : null}
                </View>
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
