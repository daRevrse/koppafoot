import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import type { Match } from "@/types";
import { BoutonGeste } from "~/components/casquette/BoutonGeste";
import { LigneCasquette } from "~/components/casquette/LigneCasquette";
import { Bloc, useStylesBloc } from "~/components/competition/Bloc";
import type { JourneeTenue } from "~/hooks/useEspaceCasquette";
import { useAuth } from "~/lib/auth";
import { couvrirAmical } from "~/lib/casquette-api";
import { confiePar, PAGES_DU_SITE } from "~/lib/espace-casquette";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { retourImpact } from "~/lib/retour";
import { routeDeLaCompetition } from "~/lib/routes";
import { creerStyles, espacement, polices } from "~/theme";

const quand = (m: Match) => (m.date ? `${libelleDuJour(m.date)}${m.time ? ` à ${m.time}` : ""}` : m.time);

/** Combien d'amicaux à prendre on liste ici ; les autres, sur le site. */
const AMICAUX_MONTRES = 5;

/**
 * Matchs à tenir (la page /live-ops du site) : les matchs confiés un par un,
 * puis les matchs du jour des compétitions tenues, puis, pour un scoreur,
 * les amicaux qui cherchent quelqu'un, qu'il prend d'ici (« Je couvre »).
 * Chaque match tenu ouvre sa console sur le site.
 */
export function SectionATenir({ uid, confies, journees, amicaux }: {
  uid: string;
  confies: Match[];
  journees: JourneeTenue[];
  amicaux: Match[];
}) {
  const stylesBloc = useStylesBloc();
  const styles = useStyles();
  const router = useRouter();
  const { utilisateur } = useAuth();
  const [enCours, setEnCours] = useState<string | null>(null);
  const rien = confies.length === 0 && journees.length === 0;

  // Le match pris passe de lui-même dans les matchs confiés : l'écouteur le voit arriver.
  function couvrir(m: Match) {
    if (!utilisateur || enCours) return;
    Alert.alert("Prendre ce match ?", `${m.homeTeamName} – ${m.awayTeamName}, ${quand(m)}. Tu tiendras sa console.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Je couvre",
        onPress: async () => {
          retourImpact();
          setEnCours(m.id);
          try {
            await couvrirAmical(utilisateur, m.id);
          } catch (e) {
            Alert.alert("Le match n'a pas été pris", e instanceof Error ? e.message : undefined);
          } finally {
            setEnCours(null);
          }
        },
      },
    ]);
  }
  return (
    <Bloc titre="Matchs à tenir" action={{ libelle: "Toute la console", onPress: () => ouvrirSurLeSite(PAGES_DU_SITE.console) }}>
      {rien ? <Text style={stylesBloc.vide}>Aucun match à tenir pour l&apos;instant.</Text> : null}

      {confies.map((m) => (
        <LigneCasquette
          key={m.id}
          icone="radio-outline"
          titre={`${m.homeTeamName} – ${m.awayTeamName}`}
          detail={[quand(m), m.venueName].filter(Boolean).join(" · ")}
          note={confiePar(m, uid)}
          etat={m.status === "live" ? "direct" : null}
          onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.consoleAmical(m.id))}
        />
      ))}

      {journees.map(({ competition: c, matchs }) => (
        <View key={c.id}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${c.name}, les matchs d'aujourd'hui`}
            onPress={() => {
              const route = routeDeLaCompetition(c);
              if (route) router.push(route);
            }}
            style={styles.competition}
          >
            <Text style={styles.competitionTexte} numberOfLines={1}>{`${c.name} · aujourd'hui`.toUpperCase()}</Text>
          </Pressable>
          {matchs.map((m) => (
            <LigneCasquette
              key={m.id}
              icone="radio-outline"
              titre={`${m.homeTeamName} – ${m.awayTeamName}`}
              detail={[m.time, m.venueName].filter(Boolean).join(" · ")}
              etat={m.status === "live" ? "direct" : m.status === "completed" ? "termine" : null}
              onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.consoleMatch(c.id, m.id))}
            />
          ))}
        </View>
      ))}

      {amicaux.length > 0 ? (
        <>
          <Text style={styles.groupe}>AMICAUX SANS SCOREUR</Text>
          {amicaux.slice(0, AMICAUX_MONTRES).map((m) => (
            <LigneCasquette
              key={m.id}
              icone="hand-left-outline"
              titre={`${m.homeTeamName} – ${m.awayTeamName}`}
              detail={[quand(m), m.venueName].filter(Boolean).join(" · ")}
              fin={
                <BoutonGeste
                  libelle="Je couvre"
                  accessibilityLabel={`Je couvre ${m.homeTeamName} contre ${m.awayTeamName}`}
                  occupe={enCours === m.id}
                  inactif={enCours !== null}
                  onPress={() => couvrir(m)}
                />
              }
            />
          ))}
          {amicaux.length > AMICAUX_MONTRES ? (
            <LigneCasquette
              titre={`Les ${amicaux.length - AMICAUX_MONTRES} autres, sur le site`}
              onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.console)}
            />
          ) : null}
        </>
      ) : null}

      <LigneCasquette
        icone="school-outline"
        titre="S'entraîner sur la console"
        onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.entrainement)}
      />
    </Bloc>
  );
}

const useStyles = creerStyles((couleurs) => ({
  competition: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  competitionTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
  groupe: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.accent,
  },
}));
