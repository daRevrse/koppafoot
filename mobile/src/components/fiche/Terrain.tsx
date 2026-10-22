import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { versFormation } from "@/lib/formations";
import type { MarquesJoueur } from "@/lib/recit-du-match";
import { disposerSurTerrain, nomCourt, rayonPastille, RAYON_MAX_RANGS } from "@/lib/terrain";
import type { LineupEntry } from "@/types";
import { polices } from "~/theme";

// Le terrain du site (components/match/TerrainCompo), dessiné avec des vues :
// un demi-terrain, notre but en bas. Le site dessine en SVG dans un repère
// 100 × 104 ; la boîte garde ce rapport, une unité vaut 1 % de la largeur et
// 1/1,04 % de la hauteur. Les places viennent de lib/terrain, partagé.

const HAUTEUR_SUR_LARGEUR = 104 / 100;
const LIGNES = "rgba(255,255,255,0.5)";
/** La largeur donnée au nom court sous une pastille (« J. Mensah », onze signes au plus). */
const LARGEUR_ETIQUETTE = 84;

/** Un trait de terrain, en unités du dessin (x, y, largeur, hauteur). */
function Trait({ x, y, l, h }: { x: number; y: number; l: number; h: number }) {
  return (
    <View
      style={{
        position: "absolute", left: `${x}%`, top: `${y / 1.04}%`, width: `${l}%`, height: `${h / 1.04}%`,
        borderWidth: 1, borderColor: LIGNES, pointerEvents: "none",
      }}
    />
  );
}

function Marques({ m, homme, rayon }: { m: MarquesJoueur | undefined; homme: boolean; rayon: number }) {
  if (!m && !homme) return null;
  const pastille = Math.max(14, rayon * 0.9);
  const buts = (m?.buts ?? 0) + (m?.csc ?? 0);
  return (
    <>
      {buts > 0 ? (
        <View style={[styles.marque, styles.but, { width: pastille, height: pastille, borderRadius: pastille / 2, right: -pastille / 3, top: -pastille / 3 }, m?.buts ? null : styles.csc]}>
          {buts > 1 ? (
            <Text style={[styles.butTexte, { fontSize: pastille * 0.62 }, m?.buts ? null : styles.cscTexte]}>{buts}</Text>
          ) : (
            <Ionicons name="football" size={pastille * 0.78} color={m?.buts ? "#111827" : "#dc2626"} />
          )}
        </View>
      ) : null}
      {m && (m.rouge || m.jaunes > 0) ? (
        <View style={[styles.carton, { left: -pastille / 4, top: -pastille / 4, backgroundColor: m.rouge ? "#ef4444" : "#facc15" }]} />
      ) : null}
      {homme ? <Text style={[styles.etoile, { left: -pastille / 3, bottom: -pastille / 4 }]}>★</Text> : null}
    </>
  );
}

/** Les onze sur le terrain : la photo ou le numéro, le nom court dessous, les marques du match. */
export function Terrain({ titulaires, formation, photos, marques, homme, onJoueur }: {
  titulaires: LineupEntry[];
  formation: string | null;
  photos?: Record<string, string | null | undefined>;
  marques?: Record<string, MarquesJoueur>;
  homme?: string | null;
  /** Toucher un joueur qui a un compte : sa fiche. */
  onJoueur?: (uid: string) => void;
}) {
  const [largeur, setLargeur] = useState(0);
  const { places, ecart } = disposerSurTerrain(titulaires, undefined, "haut", versFormation(formation));
  // Le rayon du site, en unités du dessin, converti en points d'écran.
  const rayon = (rayonPastille(ecart, Math.min(4.2, RAYON_MAX_RANGS)) / 100) * largeur;

  return (
    <View
      style={[styles.cadre, { aspectRatio: 1 / HAUTEUR_SUR_LARGEUR }]}
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
      accessibilityRole="image"
      accessibilityLabel="Composition sur le terrain"
    >
      <LinearGradient colors={["#1f9d57", "#0f7a3f"]} style={StyleSheet.absoluteFill} />
      {/* Les bandes de tonte, à peine visibles. */}
      {[0, 2, 4, 6].map((n) => (
        <View key={n} style={[styles.bande, { top: `${(n * 13) / 1.04}%`, height: `${13 / 1.04}%` }]} />
      ))}
      <Trait x={3} y={3} l={94} h={98} />
      <Trait x={22} y={71} l={56} h={30} />
      <Trait x={36} y={89} l={28} h={12} />
      <Trait x={42} y={101} l={16} h={3} />
      {/* Le rond central, dont on ne voit que la moitié qui entre dans notre camp. */}
      <View style={[styles.rondCentral, { left: "34%", width: "32%", top: `${(3 - 16) / 1.04}%`, height: `${32 / 1.04}%` }]} />

      {largeur > 0
        ? places.map((place, i) => {
            const joueur = place.entry;
            const photo = joueur ? photos?.[joueur.playerId] ?? null : null;
            const d = rayon * 2;
            // La place est plus large que la pastille : le nom court déborde
            // dessous, comme l'étiquette du site.
            const l = Math.max(d, LARGEUR_ETIQUETTE);
            return (
              <Pressable
                key={joueur?.playerId ?? `vide-${i}`}
                disabled={!joueur?.userId || !onJoueur}
                accessibilityRole={joueur?.userId ? "link" : undefined}
                accessibilityLabel={joueur ? joueur.name : undefined}
                onPress={() => joueur?.userId && onJoueur?.(joueur.userId)}
                style={[styles.place, { left: (place.x / 100) * largeur - l / 2, top: (place.y / 100) * largeur - d / 2, width: l }]}
              >
                <View style={[styles.pastille, { width: d, height: d, borderRadius: rayon }, !joueur && styles.pastilleVide]}>
                  {joueur && photo ? (
                    <Image source={{ uri: photo }} style={{ width: d * 0.92, height: d * 0.92, borderRadius: rayon * 0.92 }} contentFit="cover" />
                  ) : (
                    <Text style={[styles.numero, { fontSize: rayon * 0.95 }, !joueur && styles.numeroVide]}>
                      {joueur ? joueur.number || "–" : place.etiquette}
                    </Text>
                  )}
                  {joueur ? <Marques m={marques?.[joueur.playerId]} homme={!!homme && homme === joueur.playerId} rayon={rayon} /> : null}
                </View>
                {joueur ? (
                  <Text style={styles.nom} numberOfLines={1}>{nomCourt(joueur.name)}</Text>
                ) : null}
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: { width: "100%", overflow: "hidden" },
  bande: { position: "absolute", left: 0, right: 0, backgroundColor: "rgba(255,255,255,0.04)", pointerEvents: "none" },
  rondCentral: { position: "absolute", borderWidth: 1, borderColor: LIGNES, borderRadius: 999, pointerEvents: "none" },
  place: { position: "absolute", alignItems: "center" },
  pastille: { backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  pastilleVide: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: "#ffffff" },
  numero: { fontFamily: polices.texteNoir, color: "#064e3b" },
  numeroVide: { color: "#ffffff", opacity: 0.65 },
  nom: {
    marginTop: 3, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 999, overflow: "hidden",
    backgroundColor: "rgba(4,21,13,0.82)", color: "#ffffff", fontFamily: polices.texteGras, fontSize: 10,
  },
  marque: { position: "absolute", alignItems: "center", justifyContent: "center", borderWidth: 1 },
  but: { backgroundColor: "#ffffff", borderColor: "#111827" },
  csc: { backgroundColor: "#fee2e2", borderColor: "#dc2626" },
  butTexte: { fontFamily: polices.texteNoir, color: "#111827" },
  cscTexte: { color: "#dc2626" },
  carton: { position: "absolute", width: 8, height: 11, borderRadius: 1 },
  etoile: { position: "absolute", color: "#FBBF24", fontSize: 13 },
});
