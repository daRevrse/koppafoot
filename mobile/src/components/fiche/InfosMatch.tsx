import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { dateLongue } from "@/lib/terrains";
import { Ecusson } from "~/components/Ecusson";
import { FormeDesEquipes } from "~/components/fiche/Forme";
import { Pronostic } from "~/components/fiche/Pronostic";
import { useSuivi } from "~/hooks/useSuivi";
import type { Fiche } from "~/lib/fiche-match";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

// Les infos du site (components/match/MatchInfoList) : le pronostic, la
// forme des deux équipes, puis le coup d'envoi, le lieu et la compétition.

const PROCHES = ["Aujourd'hui", "Demain", "Hier"];

function Ligne({ visuel, label, valeur, note, onPress, action }: {
  visuel: ReactNode;
  label: string;
  valeur: string;
  note?: string | null;
  onPress?: () => void;
  action?: ReactNode;
}) {
  const styles = useStyles();
  const contenu = (
    <>
      <View style={styles.visuel}>{visuel}</View>
      <View style={styles.textes}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={[styles.valeur, onPress && styles.lien]} numberOfLines={1}>{valeur}</Text>
        {note ? <Text style={styles.note} numberOfLines={1}>{note.toUpperCase()}</Text> : null}
      </View>
      {action}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="link" onPress={onPress} style={({ pressed }) => [styles.ligne, pressed && styles.presse]}>
      {contenu}
    </Pressable>
  ) : (
    <View style={styles.ligne}>{contenu}</View>
  );
}

function Icone({ nom }: { nom: ComponentProps<typeof Ionicons>["name"] }) {
  const couleurs = useCouleurs();
  return <Ionicons name={nom} size={18} color={couleurs.texteDiscret} />;
}

export function InfosMatch({ fiche }: { fiche: Fiche }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const suivi = useSuivi();
  const lignes: ReactNode[] = [];

  if (fiche.date || fiche.heure) {
    const valeur = [fiche.date ? dateLongue(fiche.date) : null, fiche.heure].filter(Boolean).join(" · ");
    const proche = fiche.date ? libelleDuJour(fiche.date) : null;
    lignes.push(
      <Ligne key="coup" visuel={<Icone nom="calendar-outline" />} label="Coup d'envoi" valeur={valeur}
        note={proche && PROCHES.includes(proche) ? proche : null} />,
    );
  }

  const { nom, ville } = fiche.lieu;
  if (nom || ville) {
    const recherche = [nom, ville].filter(Boolean).join(", ");
    lignes.push(
      <Ligne key="lieu" visuel={<Icone nom="location-outline" />} label="Lieu" valeur={(nom || ville) as string}
        note={nom ? ville : null}
        onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(recherche)}`)} />,
    );
  }

  const c = fiche.competition;
  if (c) {
    lignes.push(
      <Ligne
        key="comp"
        visuel={c.logo ? <Ecusson url={c.logo} nom={c.nom} taille={24} /> : <Icone nom="trophy-outline" />}
        label="Compétition"
        valeur={c.nom}
        note={c.sousTitre}
        onPress={() => router.push({ pathname: "/competition/[cid]", params: { cid: c.id } })}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={suivi.ids.has(c.id) ? "Ne plus suivre cette compétition" : "Suivre cette compétition"}
            accessibilityState={{ selected: suivi.ids.has(c.id) }}
            onPress={() => void suivi.basculer(c.id)}
            hitSlop={10}
          >
            <Ionicons
              name={suivi.ids.has(c.id) ? "star" : "star-outline"}
              size={18}
              color={suivi.ids.has(c.id) ? couleurs.accent : couleurs.texteDiscret}
            />
          </Pressable>
        }
      />,
    );
  }

  return (
    <View style={styles.colonne}>
      <Pronostic fiche={fiche} />
      <FormeDesEquipes fiche={fiche} />
      {lignes.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.titre}>DÉTAILS</Text>
          <View style={styles.liste}>{lignes}</View>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  colonne: { gap: 16 },
  section: { marginHorizontal: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  titre: {
    paddingHorizontal: 16, paddingTop: 16, fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11),
    color: couleurs.texteDiscret,
  },
  liste: { marginTop: 4 },
  ligne: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  visuel: { width: 28, alignItems: "center" },
  textes: { flex: 1, minWidth: 0 },
  label: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: couleurs.texteDiscret },
  valeur: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  lien: { color: couleurs.texte },
  note: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.1), color: couleurs.texteDiscret },
}));
