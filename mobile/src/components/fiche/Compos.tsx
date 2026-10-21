import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { marquesDesJoueurs } from "@/lib/recit-du-match";
import { Terrain } from "~/components/fiche/Terrain";
import type { Fiche } from "~/lib/fiche-match";
import { retourSelection } from "~/lib/retour";
import { couleurs, espacement, polices } from "~/theme";

/**
 * Les compositions du site (components/match/MatchLineups) : une bascule
 * Domicile / Extérieur, le terrain des titulaires, le banc dessous. Les
 * visages des joueurs arrivent avec le joueur du match (PR B) ; d'ici là, la
 * pastille garde son numéro — c'est le cas courant chez les amateurs.
 */
export function Compos({ fiche }: { fiche: Fiche }) {
  // L'extérieur d'abord si le domicile n'a pas de feuille, comme sur le site.
  const [cote, setCote] = useState<"home" | "away">(
    fiche.domicile.lineup.length === 0 && fiche.exterieur.lineup.length > 0 ? "away" : "home",
  );
  const camp = cote === "home" ? fiche.domicile : fiche.exterieur;
  const titulaires = camp.lineup.filter((e) => e.role === "starter");
  const remplacants = camp.lineup.filter((e) => e.role === "substitute");
  const marques = marquesDesJoueurs(fiche.liveState?.events ?? []);
  const aVenir = fiche.statut === "scheduled";

  return (
    <View style={styles.bloc}>
      <View style={styles.bascule}>
        {(["home", "away"] as const).map((k, i) => {
          const c = k === "home" ? fiche.domicile : fiche.exterieur;
          const on = cote === k;
          return (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (on) return;
                retourSelection();
                setCote(k);
              }}
              style={[styles.choix, i === 1 && styles.choixDroite, on && styles.choixActif]}
            >
              <Text style={[styles.choixTexte, on && styles.choixTexteActif]} numberOfLines={1}>
                {c.nom.toUpperCase()}
                {c.formation ? <Text style={on ? styles.formationActive : styles.formation}>{`  ${c.formation}`}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {titulaires.length === 0 ? (
        <View style={styles.vide}>
          <Text style={styles.videTitre}>{aVenir ? "COMPOSITION À VENIR" : "PAS DE COMPOSITION"}</Text>
          <Text style={styles.videTexte}>
            {aVenir ? "Le manager la publie avant le coup d'envoi." : "Personne ne l'a saisie pour ce match."}
          </Text>
        </View>
      ) : (
        <Terrain titulaires={titulaires} formation={camp.formation} marques={marques} homme={fiche.mvp.playerId} />
      )}

      {remplacants.length > 0 ? (
        <View style={styles.banc}>
          <Text style={styles.bancTitre}>BANC</Text>
          {remplacants.map((r) => {
            const entre = marques[r.playerId]?.entreeA ?? null;
            return (
              <Text key={r.playerId} style={styles.remplacant}>
                <Text style={styles.numero}>{`${r.number || "–"} `}</Text>
                {r.name}
                {entre !== null ? <Text style={styles.entre}>{`  ↑ ${entre}'`}</Text> : null}
              </Text>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { paddingHorizontal: 16, gap: 12 },
  bascule: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  choix: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: couleurs.surface },
  choixDroite: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: couleurs.bordure },
  choixActif: { backgroundColor: couleurs.texte },
  choixTexte: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.05), color: couleurs.texteDiscret, textAlign: "center" },
  choixTexteActif: { color: couleurs.fond },
  formation: { color: couleurs.texteDiscret },
  formationActive: { color: "rgba(8,13,11,0.5)" },
  vide: { backgroundColor: couleurs.surface, paddingHorizontal: 16, paddingVertical: 40, alignItems: "center", gap: 6 },
  videTitre: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: couleurs.texteDiscret },
  videTexte: { fontFamily: polices.texteDemi, fontSize: 12, color: couleurs.texteDiscret, textAlign: "center" },
  banc: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 6 },
  bancTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret },
  remplacant: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  numero: { color: couleurs.texteDiscret },
  entre: { color: couleurs.primaire },
});
