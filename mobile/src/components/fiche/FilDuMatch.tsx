import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { OWN_GOAL_DETAIL, issuePenalty } from "@/lib/evenements";
import { composerFil, libelleDuFait, TEXTES_FIL, type EvenementDuFil } from "@/lib/fil-du-match";
import { libelleMinute } from "@/lib/minute-du-match";
import { joueursDuRemplacement } from "@/lib/recit-du-match";
import type { Genre } from "@/lib/genre";
import { JoueurDuMatch } from "~/components/fiche/JoueurDuMatch";
import { derouleDeLaFiche, type Fiche } from "~/lib/fiche-match";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

// Le fil du site (components/match/MatchTimeline) : chaque fait du côté de
// son acteur, la minute sur l'axe central, les repères en travers. Le récit
// lui-même vient de lib/fil-du-match, partagé avec le site.

const t = TEXTES_FIL.fr;

function Marqueur({ e, annule }: { e: EvenementDuFil; annule: boolean }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const eteint = couleurs.texteDiscret;
  switch (e.type) {
    case "goal":
      return <Ionicons name="football" size={14} color={annule ? eteint : couleurs.primaire} />;
    case "yellow_card":
      // Le jaune du carton, pas l'ambre du texte : il foncerait en thème clair.
      return <View style={[styles.carton, styles.cartonJaune]} />;
    case "red_card":
      return <View style={[styles.carton, { backgroundColor: couleurs.direct }]} />;
    case "substitution":
      return <Ionicons name="swap-horizontal" size={14} color="#60a5fa" />;
    case "save":
      return <Ionicons name="hand-left" size={13} color={couleurs.primaire} />;
    case "foul":
      return <Ionicons name="warning" size={13} color="#fb923c" />;
    case "offside":
      return <Ionicons name="flag" size={13} color={eteint} />;
    case "penalty":
      return <Ionicons name="locate" size={13} color={annule ? eteint : couleurs.primaire} />;
    default:
      return null;
  }
}

/** Un fait rangé dans son camp. Le joueur d'abord, l'action ensuite, en petit. */
function Ligne({ e, droite }: { e: EvenementDuFil; droite: boolean }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const enCours = e.type === "goal" && e.varStatus === "checking";
  const issue = e.type === "penalty" ? issuePenalty(e.detail) : null;
  const annule = (e.type === "goal" && e.varStatus === "cancelled") || issue === "retire";
  const attente = e.type === "penalty" && !issue;
  const nom = (e.playerName ?? "").trim();
  const remplacement = e.type === "substitution" ? joueursDuRemplacement(e) : null;
  const passeur = e.type === "goal" && e.detail !== OWN_GOAL_DETAIL ? e.assistPlayerName?.trim() : null;
  const aligne = droite ? styles.texteAGauche : styles.texteADroite;

  return (
    <View style={[styles.ligne, droite ? styles.rangee : styles.rangeeInverse]}>
      <View style={styles.marqueur}>
        <Marqueur e={e} annule={annule} />
      </View>
      <View style={[styles.textes, droite ? styles.aGauche : styles.aDroite]}>
        {remplacement ? (
          <>
            {remplacement.entre ? (
              <View style={[styles.joueurChangement, droite ? styles.rangee : styles.rangeeInverse]}>
                <Ionicons name="arrow-up" size={11} color={couleurs.primaire} accessibilityLabel="Entre" />
                <Text style={[styles.nom, aligne]}>{remplacement.entre}</Text>
              </View>
            ) : null}
            {remplacement.sort ? (
              <View style={[styles.joueurChangement, droite ? styles.rangee : styles.rangeeInverse]}>
                <Ionicons name="arrow-down" size={11} color={couleurs.direct} accessibilityLabel="Sort" />
                <Text style={[styles.sortant, aligne]}>{remplacement.sort}</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            {nom ? <Text style={[styles.nom, aligne, annule && styles.barre]}>{nom}</Text> : null}
            <Text style={[styles.action, aligne, annule && styles.barre]}>{libelleDuFait(e, t, "fr").toUpperCase()}</Text>
            {passeur ? <Text style={[styles.passeur, aligne]}>{t.passeDe(passeur)}</Text> : null}
          </>
        )}
        {enCours || annule || attente ? (
          <Text style={[styles.var, annule ? styles.varAnnule : styles.varAttente]}>
            {(annule ? (issue === "retire" ? t.retire : t.refuse) : attente ? t.aTirer : "VAR").toUpperCase()}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function FilDuMatch({ fiche, photoHomme, genreHomme }: {
  fiche: Fiche;
  photoHomme: string | null;
  genreHomme: Genre | null;
}) {
  return (
    <View>
      {/* Le dénouement du récit vit avec le récit (page compétition, `fil`). */}
      <JoueurDuMatch fiche={fiche} photo={photoHomme} genre={genreHomme} />
      <Fil fiche={fiche} />
    </View>
  );
}

function Fil({ fiche }: { fiche: Fiche }) {
  const styles = useStyles();
  const events = fiche.liveState?.events ?? [];
  const vide = fiche.statut === "completed"
    ? "Aucun fait de jeu enregistré sur ce match"
    : fiche.statut === "live"
      ? "En attente du premier fait de jeu"
      : "Le fil s'ouvre au coup d'envoi";
  const elements = composerFil(events, fiche.domicile.teamId, derouleDeLaFiche(fiche), vide, t);

  if (elements.length === 0) {
    return (
      <View style={styles.cadre}>
        <Text style={styles.note}>{vide.toUpperCase()}</Text>
      </View>
    );
  }

  // Le plus récent en haut : c'est ce qu'on vient voir pendant un direct.
  const fil = [...elements].reverse();
  return (
    <View style={styles.cadre}>
      <View style={styles.axe} />
      {fil.map((el) => {
        if (el.genre === "repere") {
          return (
            <View key={el.cle} style={styles.repere}>
              <View style={styles.filet} />
              <Text style={styles.repereTexte}>{el.texte.toUpperCase()}</Text>
              <View style={styles.filet} />
            </View>
          );
        }
        if (el.genre === "note") {
          return (
            <View key="note" style={styles.noteBloc}>
              <Text style={styles.note}>{el.texte.toUpperCase()}</Text>
            </View>
          );
        }
        const e = el.e;
        const chezLui = e.teamId === fiche.domicile.teamId;
        return (
          <View key={e.id} style={styles.fait}>
            <View style={styles.cote}>{chezLui ? <Ligne e={e} droite={false} /> : null}</View>
            <View style={styles.minute}>
              <Text style={styles.minuteTexte}>
                {e.minute
                  ? libelleMinute(e.period, e.minute, fiche.dureeMiTemps, "'", fiche.dureeProlongation)
                  : "·"}
              </Text>
            </View>
            <View style={styles.cote}>{!chezLui ? <Ligne e={e} droite /> : null}</View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  cadre: { backgroundColor: couleurs.surface, padding: 16, gap: 14 },
  // L'axe central, derrière les minutes.
  axe: { position: "absolute", top: 24, bottom: 24, left: "50%", width: 1, marginLeft: -0.5, backgroundColor: couleurs.bordure },
  repere: { flexDirection: "row", alignItems: "center", gap: 12 },
  filet: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: couleurs.bordure },
  repereTexte: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.12), color: couleurs.texteSecondaire,
    backgroundColor: couleurs.surface, paddingHorizontal: 4,
  },
  noteBloc: { alignItems: "center", paddingVertical: 16 },
  note: {
    fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: couleurs.texteDiscret,
    textAlign: "center", backgroundColor: couleurs.surface, paddingHorizontal: 8, paddingVertical: 24,
  },
  fait: { flexDirection: "row", alignItems: "flex-start", gap: 4 },
  cote: { flex: 1, minWidth: 0 },
  minute: { width: 44, alignItems: "center" },
  // Sur le fond du panneau, pour masquer l'axe qui passe derrière.
  minuteTexte: {
    fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteSecondaire, backgroundColor: couleurs.surface,
    minWidth: 28, height: 28, lineHeight: 28, textAlign: "center", fontVariant: ["tabular-nums"],
  },
  ligne: { alignItems: "flex-start", gap: 6 },
  rangee: { flexDirection: "row" },
  rangeeInverse: { flexDirection: "row-reverse" },
  marqueur: { height: 16, justifyContent: "center", marginTop: 2 },
  carton: { width: 10, height: 14 },
  textes: { flexShrink: 1, gap: 2 },
  aDroite: { alignItems: "flex-end" },
  aGauche: { alignItems: "flex-start" },
  texteADroite: { textAlign: "right" },
  texteAGauche: { textAlign: "left" },
  joueurChangement: { alignItems: "center", gap: 4 },
  nom: { fontFamily: polices.texteNoir, fontSize: 13, lineHeight: 16, color: couleurs.texte, flexShrink: 1 },
  sortant: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire, flexShrink: 1 },
  action: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.05), color: couleurs.texteSecondaire },
  passeur: { fontFamily: polices.texteDemi, fontSize: 11, color: couleurs.texteSecondaire },
  barre: { color: couleurs.texteDiscret, textDecorationLine: "line-through" },
  var: { marginTop: 4, paddingHorizontal: 6, paddingVertical: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: 0.8 },
  varAnnule: { backgroundColor: couleurs.directVoile, color: couleurs.direct },
  varAttente: { backgroundColor: couleurs.accentVoile, color: couleurs.accent },
  cartonJaune: { backgroundColor: "#FBBF24" },
}));
