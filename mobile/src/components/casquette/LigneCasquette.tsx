import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useStylesBloc } from "~/components/competition/Bloc";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/**
 * Une ligne de l'Espace casquette : un match à tenir, une réservation, un
 * lien. Le titre, ce qui le situe, une note éventuelle, et à droite l'état
 * (en direct, terminé) ou le chevron de ce qui s'ouvre. Avec `fin` (un
 * bouton), la ligne n'ouvre rien : c'est le bouton qui agit.
 */
export function LigneCasquette({ icone, titre, detail, note, etat, onPress, fin }: {
  icone?: ComponentProps<typeof Ionicons>["name"];
  titre: string;
  detail?: string | null;
  note?: string | null;
  etat?: "direct" | "termine" | null;
  onPress?: () => void;
  fin?: ReactNode;
}) {
  const stylesBloc = useStylesBloc();
  const styles = useStyles();
  const couleurs = useCouleurs();
  const libelleEtat = etat === "direct" ? "en direct" : etat === "termine" ? "terminé" : null;
  const contenu = (
    <>
      {icone ? (
        <View style={[styles.icone, etat === "direct" && styles.iconeDirect]}>
          <Ionicons name={icone} size={17} color={etat === "direct" ? couleurs.direct : couleurs.primaire} />
        </View>
      ) : null}
      <View style={styles.textes}>
        <Text style={styles.titre} numberOfLines={2}>{titre}</Text>
        {detail ? <Text style={styles.detail} numberOfLines={2}>{detail}</Text> : null}
        {note ? <Text style={styles.note} numberOfLines={1}>{note}</Text> : null}
      </View>
      {fin ?? (etat === "direct" ? (
        <Text style={[styles.etat, styles.direct]}>EN DIRECT</Text>
      ) : etat === "termine" ? (
        <Text style={[styles.etat, styles.termine]}>TERMINÉ</Text>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={couleurs.texteDiscret} />
      ))}
    </>
  );
  if (!onPress) return <View style={stylesBloc.ligne}>{contenu}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={[titre, detail, note, libelleEtat].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed }) => [stylesBloc.ligne, pressed && styles.presse]}
    >
      {contenu}
    </Pressable>
  );
}

const useStyles = creerStyles((couleurs) => ({
  presse: { backgroundColor: couleurs.surfaceHaute },
  icone: { width: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: couleurs.primaireVoile },
  iconeDirect: { backgroundColor: couleurs.directVoile },
  textes: { flex: 1, minWidth: 0, gap: 2 },
  titre: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  detail: { fontFamily: polices.texteGras, fontSize: 12, color: couleurs.texteDiscret },
  note: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  etat: { paddingHorizontal: 6, paddingVertical: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.1) },
  direct: { color: couleurs.direct, backgroundColor: couleurs.directVoile },
  termine: { color: couleurs.texteDiscret, backgroundColor: couleurs.surfaceHaute },
}));
