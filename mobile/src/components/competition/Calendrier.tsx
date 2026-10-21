import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { dateLongue } from "@/lib/terrains";
import type { Competition, CompMatch } from "@/types";
import { Puces } from "~/components/competition/Puces";
import { LigneMatch } from "~/components/direct/LigneMatch";
import { EtatVide } from "~/components/EtatVide";
import {
  etiquetteDuMatch, filtresDuCalendrier, joursDuCalendrier, matchsDuFiltre, type FiltreCalendrier,
} from "~/lib/page-competition";
import { couleurs, espacement, polices } from "~/theme";

const titreDuJour = (date: string | null) => {
  if (!date) return "DATE À DÉFINIR";
  return dateLongue(date).toUpperCase();
};

/**
 * Le calendrier (CalendarTab du site) : une pastille par poule quand il y en
 * a plusieurs, puis les matchs jour par jour, dans l'ordre, en lignes du
 * Direct ; chacune ouvre sa fiche.
 */
export function Calendrier({ competition, matchs, onOuvrir }: {
  competition: Competition;
  matchs: CompMatch[] | null;
  onOuvrir: (m: CompMatch) => void;
}) {
  const [filtre, setFiltre] = useState<FiltreCalendrier>("tous");
  if (matchs === null) return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;

  const filtres = filtresDuCalendrier(matchs);
  // Un filtre qui ne vaut plus rien (la poule a disparu) revient à « Tous ».
  const actif = filtres.some((f) => f.cle === filtre) ? filtre : "tous";
  const jours = joursDuCalendrier(matchsDuFiltre(matchs, actif));

  if (jours.length === 0) return <EtatVide icone="calendar-outline" texte="Le calendrier n'est pas encore disponible." />;

  return (
    <View>
      {filtres.length > 2 ? <Puces puces={filtres} actif={actif} onChange={setFiltre} /> : null}
      <View style={styles.jours}>
        {jours.map((jour) => (
          <View key={jour.date ?? "sans-date"}>
            <Text style={styles.jour} accessibilityRole="header">{titreDuJour(jour.date)}</Text>
            <View style={styles.liste}>
              {jour.matchs.map((m) => (
                <LigneMatch
                  key={m.id}
                  entree={{ match: m, competition }}
                  etiquette={etiquetteDuMatch(m)}
                  onPress={() => onOuvrir(m)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chargement: { paddingVertical: 40 },
  jours: { gap: 20 },
  jour: {
    paddingHorizontal: 16, paddingBottom: 8, fontFamily: polices.texteNoir, fontSize: 11,
    letterSpacing: espacement(11, 0.1), color: couleurs.texte,
  },
  liste: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
});
