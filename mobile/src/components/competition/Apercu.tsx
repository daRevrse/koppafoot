import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { computeTopScorers } from "@/lib/performances-competition";
import { computeStandings } from "@/lib/poules";
import type { Competition, CompMatch, CompTeam } from "@/types";
import { Bouton } from "~/components/Bouton";
import { Bloc, stylesBloc } from "~/components/competition/Bloc";
import { LigneMatch } from "~/components/direct/LigneMatch";
import { Ecusson } from "~/components/Ecusson";
import { EtatVide } from "~/components/EtatVide";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { etiquetteDuMatch, matchsDeLApercu, type OngletCompetition } from "~/lib/page-competition";
import { couleurs, espacement, polices } from "~/theme";

/** « Demain · Groupe A » : le jour d'un match de l'Aperçu, et sa poule ou son tour. */
const etiquetteAvecJour = (m: CompMatch) =>
  [m.date ? libelleDuJour(m.date) : null, etiquetteDuMatch(m)].filter(Boolean).join(" · ");

/** Le meilleur joueur du tournoi, une fois la compétition terminée (MvpDuMatch du site, une échelle au-dessus). */
function MeilleurJoueur({ competition, equipes }: { competition: Competition; equipes: CompTeam[] }) {
  const equipe = equipes.find((e) => e.id === competition.mvpTeamId);
  const titre = competition.category === "women" ? "Meilleure joueuse du tournoi" : "Meilleur joueur du tournoi";
  return (
    <View style={styles.mvp}>
      <Ionicons name="trophy" size={26} color="#FBBF24" />
      <View style={styles.flexible}>
        <Text style={styles.mvpTitre}>{titre.toUpperCase()}</Text>
        <Text style={styles.mvpNom} numberOfLines={1}>{competition.mvpPlayerName}</Text>
        {equipe ? <Text style={styles.mvpEquipe} numberOfLines={1}>{equipe.name.toUpperCase()}</Text> : null}
      </View>
    </View>
  );
}

/** Les inscriptions : ouvertes, on renvoie sur le site, où un manager inscrit son équipe ; closes, on le dit. */
function Inscriptions({ competition }: { competition: Competition }) {
  if (competition.status === "registration") {
    return (
      <View style={[styles.bandeau, styles.bandeauOuvert]}>
        <Text style={styles.bandeauTitre}>Inscriptions ouvertes</Text>
        <Text style={styles.bandeauTexte}>Tu diriges une équipe ? Inscris-la à cette compétition.</Text>
        <Bouton titre="S'inscrire sur le site" onPress={() => ouvrirSurLeSite(`/c/${competition.slug}`)} />
      </View>
    );
  }
  if (competition.status === "registration_closed") {
    return (
      <View style={styles.bandeau}>
        <Text style={styles.bandeauTitre}>Inscriptions closes</Text>
        <Text style={styles.bandeauTexte}>
          Les équipes sont connues, le calendrier arrive. Suis la compétition pour ne pas rater le coup d&apos;envoi.
        </Text>
      </View>
    );
  }
  return null;
}

/**
 * L'Aperçu, qui ouvre la page : le meilleur joueur une fois le tournoi fini,
 * les inscriptions, puis ce qui se joue — le direct, les prochains matchs,
 * les derniers résultats —, les leaders des poules et les meilleurs buteurs.
 * Chaque cadre mène à l'onglet qui dit tout.
 */
export function Apercu({ competition, matchs, equipes, onOuvrir, onOnglet }: {
  competition: Competition;
  matchs: CompMatch[] | null;
  equipes: CompTeam[];
  onOuvrir: (m: CompMatch) => void;
  onOnglet: (o: OngletCompetition) => void;
}) {
  if (matchs === null) return <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />;
  const { enDirect, aVenir, joues } = matchsDeLApercu(matchs);
  const tousLesMatchs = { libelle: "Tous les matchs", onPress: () => onOnglet("matchs") };
  const lignes = (liste: CompMatch[], avecJour: boolean) =>
    liste.map((m) => (
      <LigneMatch
        key={m.id}
        entree={{ match: m, competition }}
        etiquette={avecJour ? etiquetteAvecJour(m) : etiquetteDuMatch(m)}
        onPress={() => onOuvrir(m)}
      />
    ));

  // Les leaders, une fois qu'une poule a joué : le premier de chacune. La
  // lettre de la poule se lit dès qu'il y en a plusieurs, même si une seule a joué.
  const poules = joues.length > 0 ? computeStandings(matchs, equipes, competition.format) : [];
  const leaders = poules.filter((p) => p.rows[0]?.played > 0);
  const plusieursPoules = poules.length > 1;
  const buteurs = computeTopScorers(matchs).slice(0, 3);
  const parId = new Map(equipes.map((e) => [e.id, e]));
  const rienAJouer = enDirect.length === 0 && aVenir.length === 0 && joues.length === 0;

  return (
    <View style={styles.colonne}>
      {competition.mvpPlayerName ? <MeilleurJoueur competition={competition} equipes={equipes} /> : null}
      <Inscriptions competition={competition} />

      {rienAJouer ? <EtatVide icone="calendar-outline" texte="Le calendrier n'est pas encore disponible." /> : null}
      {enDirect.length > 0 ? <Bloc titre="En direct" action={tousLesMatchs}>{lignes(enDirect, false)}</Bloc> : null}
      {aVenir.length > 0 ? <Bloc titre="À venir" action={enDirect.length ? undefined : tousLesMatchs}>{lignes(aVenir, true)}</Bloc> : null}
      {joues.length > 0 ? (
        <Bloc titre="Derniers résultats" action={enDirect.length || aVenir.length ? undefined : tousLesMatchs}>
          {lignes(joues, true)}
        </Bloc>
      ) : null}

      {leaders.length > 0 ? (
        <Bloc titre={plusieursPoules ? "En tête des poules" : "En tête"} action={{ libelle: "Classement", onPress: () => onOnglet("classement") }}>
          {leaders.map((p) => {
            const tete = p.rows[0];
            return (
              <View key={p.group} style={stylesBloc.ligne}>
                {plusieursPoules ? <Text style={styles.poule}>{p.group}</Text> : null}
                <Ecusson url={tete.team.logoUrl} nom={tete.team.name} taille={22} />
                <Text style={styles.nom} numberOfLines={1}>{tete.team.name}</Text>
                <Text style={styles.points}>{`${tete.points} PTS`}</Text>
              </View>
            );
          })}
        </Bloc>
      ) : null}

      {buteurs.length > 0 ? (
        <Bloc titre="Meilleurs buteurs" action={{ libelle: "Stats", onPress: () => onOnglet("stats") }}>
          {buteurs.map((b, i) => {
            const equipe = parId.get(b.teamId);
            return (
              <View key={`${b.teamId}-${b.playerName}`} style={stylesBloc.ligne}>
                <Text style={styles.poule}>{i + 1}</Text>
                <View style={styles.flexible}>
                  <Text style={styles.nom} numberOfLines={1}>{b.playerName}</Text>
                  {equipe ? <Text style={styles.equipe} numberOfLines={1}>{equipe.name.toUpperCase()}</Text> : null}
                </View>
                <Text style={styles.buts}>{b.goals}</Text>
              </View>
            );
          })}
        </Bloc>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chargement: { paddingVertical: 40 },
  colonne: { gap: 16 },
  flexible: { flex: 1, minWidth: 0 },
  mvp: {
    flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 16, padding: 16,
    backgroundColor: "rgba(251,191,36,0.08)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(251,191,36,0.35)",
  },
  mvpTitre: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: "#FBBF24" },
  mvpNom: { marginTop: 4, fontFamily: polices.titre, fontSize: 20, color: couleurs.texte },
  mvpEquipe: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  bandeau: {
    marginHorizontal: 16, padding: 16, gap: 8, backgroundColor: couleurs.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  bandeauOuvert: { backgroundColor: couleurs.primaireVoile, borderColor: couleurs.primaire },
  bandeauTitre: { fontFamily: polices.titreMoyen, fontSize: 18, color: couleurs.texte },
  bandeauTexte: { fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
  poule: { width: 16, textAlign: "center", fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.texteDiscret },
  nom: { flex: 1, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  equipe: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  points: { fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.texte },
  buts: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
});
