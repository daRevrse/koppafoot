import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { couleurs, polices } from "~/theme";

export interface SegmentRepartition {
  cle: string;
  /** Sa part, de 0 à 100 : la largeur du segment. */
  pct: number;
  /** Ce qui se lit en haut : l'écusson et « V · 40 % ». */
  haut: ReactNode;
  /** Le nombre, en grand, en bas. */
  bas: ReactNode;
  /** Ce que dit le lecteur d'écran. */
  libelle: string;
}

/**
 * La barre de répartition du site (components/match/BarreRepartition) : des
 * segments carrés, larges de leur part, celui en tête en vert. Le bilan d'un
 * face-à-face ; le pronostic (PR C), avec `onChoisir`.
 */
export function BarreRepartition({ segments, libelle, enAvant = null, choisi = null, onChoisir, occupe = false }: {
  segments: SegmentRepartition[];
  libelle: string;
  enAvant?: string | null;
  choisi?: string | null;
  onChoisir?: (cle: string) => void;
  occupe?: boolean;
}) {
  return (
    <View style={styles.barre} accessibilityRole={onChoisir ? undefined : "summary"} accessibilityLabel={libelle}>
      {segments.map((s, i) => {
        const vert = enAvant === s.cle;
        const style = [styles.segment, i > 0 && styles.separe, vert && styles.vert, { flexGrow: Math.max(s.pct, 0) }];
        const contenu = (
          <>
            <View style={styles.haut}>
              {typeof s.haut === "string" ? <Text style={[styles.hautTexte, vert && styles.texteVert]}>{s.haut}</Text> : s.haut}
            </View>
            <Text style={[styles.bas, vert && styles.texteVert]}>{s.bas}</Text>
          </>
        );
        return onChoisir ? (
          <Pressable
            key={s.cle}
            accessibilityRole="button"
            accessibilityLabel={s.libelle}
            accessibilityState={{ selected: choisi === s.cle, disabled: occupe }}
            disabled={occupe}
            onPress={() => onChoisir(s.cle)}
            style={({ pressed }) => [...style, pressed && !vert && styles.presse]}
          >
            {contenu}
          </Pressable>
        ) : (
          <View key={s.cle} style={style} accessible accessibilityLabel={s.libelle}>
            {contenu}
          </View>
        );
      })}
    </View>
  );
}

/** Le texte d'en haut d'un segment, à composer avec un écusson. */
export function TexteDeSegment({ children, vert = false }: { children: ReactNode; vert?: boolean }) {
  return <Text style={[styles.hautTexte, vert && styles.texteVert]}>{children}</Text>;
}

const styles = StyleSheet.create({
  barre: { flexDirection: "row", overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  segment: {
    flexBasis: 0, minWidth: 92, paddingHorizontal: 12, paddingVertical: 10, gap: 12,
    justifyContent: "space-between", backgroundColor: couleurs.surface,
  },
  separe: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: couleurs.bordure },
  vert: { backgroundColor: "#10b981" },
  presse: { backgroundColor: couleurs.surfaceHaute },
  haut: { flexDirection: "row", alignItems: "center", gap: 6 },
  hautTexte: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texte },
  bas: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  texteVert: { color: "#04150d" },
});
