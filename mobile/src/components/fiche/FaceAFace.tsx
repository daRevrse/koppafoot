import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { repartirCent } from "@/lib/repartition";
import { Ecusson } from "~/components/Ecusson";
import { BarreRepartition, TexteDeSegment } from "~/components/fiche/BarreRepartition";
import type { Fiche } from "~/lib/fiche-match";
import { couleurs, polices } from "~/theme";

/**
 * Le face-à-face (onglet `h2h` de la page compétition) : le bilan d'abord,
 * dessiné comme le pronostic, puis les rencontres. Chacune ouvre sa fiche.
 */
export function FaceAFace({ fiche }: { fiche: Fiche }) {
  const router = useRouter();
  const { faceAFace, bilanFaceAFace: bilan } = fiche.contexte;
  if (faceAFace.length === 0) return null;
  const parts = repartirCent(bilan);
  const max = Math.max(bilan.home, bilan.draw, bilan.away);
  const enTete = (["home", "draw", "away"] as const).filter((k) => bilan[k] === max);
  const enAvant = enTete.length === 1 ? enTete[0] : null;
  const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? "s" : ""}`;

  return (
    <View style={styles.bloc}>
      <BarreRepartition
        libelle={`Face-à-face, ${pluriel(faceAFace.length, "rencontre")}`}
        enAvant={enAvant}
        segments={[
          {
            cle: "home", pct: parts.home, bas: bilan.home,
            haut: (
              <>
                <Ecusson url={fiche.domicile.logo} nom={fiche.domicile.nom} taille={14} />
                <TexteDeSegment vert={enAvant === "home"}>{`V · ${parts.home}%`}</TexteDeSegment>
              </>
            ),
            libelle: `${pluriel(bilan.home, "victoire")} de ${fiche.domicile.nom}`,
          },
          {
            cle: "draw", pct: parts.draw, bas: bilan.draw,
            haut: `N · ${parts.draw}%`,
            libelle: `${bilan.draw} ${bilan.draw > 1 ? "matchs nuls" : "match nul"}`,
          },
          {
            cle: "away", pct: parts.away, bas: bilan.away,
            haut: (
              <>
                <Ecusson url={fiche.exterieur.logo} nom={fiche.exterieur.nom} taille={14} />
                <TexteDeSegment vert={enAvant === "away"}>{`V · ${parts.away}%`}</TexteDeSegment>
              </>
            ),
            libelle: `${pluriel(bilan.away, "victoire")} de ${fiche.exterieur.nom}`,
          },
        ]}
      />

      <View style={styles.liste}>
        {faceAFace.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="link"
            accessibilityLabel={`${m.homeTeamName} ${m.scoreHome} à ${m.scoreAway} ${m.awayTeamName}`}
            onPress={() => fiche.competition && router.push({
              pathname: "/match/[cid]/[mid]", params: { cid: fiche.competition.id, mid: m.id },
            })}
            style={({ pressed }) => [styles.rencontre, pressed && styles.presse]}
          >
            <Text style={[styles.equipe, styles.aDroite]} numberOfLines={1}>{m.homeTeamName}</Text>
            <Text style={styles.score}>
              {m.scoreHome}
              <Text style={styles.tiret}> – </Text>
              {m.scoreAway}
            </Text>
            <Text style={styles.equipe} numberOfLines={1}>{m.awayTeamName}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginHorizontal: 16, gap: 20 },
  liste: { borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  rencontre: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: couleurs.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  equipe: { flex: 1, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  aDroite: { textAlign: "right" },
  score: { fontFamily: polices.titre, fontSize: 16, color: couleurs.texte, fontVariant: ["tabular-nums"] },
  tiret: { color: couleurs.texteDiscret },
});
