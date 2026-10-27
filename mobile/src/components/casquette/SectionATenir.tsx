import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import type { Match } from "@/types";
import { LigneCasquette } from "~/components/casquette/LigneCasquette";
import { Bloc, stylesBloc } from "~/components/competition/Bloc";
import type { JourneeTenue } from "~/hooks/useEspaceCasquette";
import { confiePar, PAGES_DU_SITE } from "~/lib/espace-casquette";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { routeDeLaCompetition } from "~/lib/routes";
import { couleurs, espacement, polices } from "~/theme";

const quand = (m: Match) => (m.date ? `${libelleDuJour(m.date)}${m.time ? ` à ${m.time}` : ""}` : m.time);

/**
 * Matchs à tenir (la page /live-ops du site) : les matchs confiés un par un,
 * puis les matchs du jour des compétitions tenues, puis, pour un scoreur,
 * les amicaux qui cherchent quelqu'un. Chaque match ouvre sa console sur le site.
 */
export function SectionATenir({ uid, confies, journees, amicaux }: {
  uid: string;
  confies: Match[];
  journees: JourneeTenue[];
  amicaux: number | null;
}) {
  const router = useRouter();
  const rien = confies.length === 0 && journees.length === 0;
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

      {amicaux ? (
        <LigneCasquette
          icone="hand-left-outline"
          titre={amicaux > 1 ? `${amicaux} amicaux cherchent un scoreur` : "1 amical cherche un scoreur"}
          detail="On le prend sur le site"
          onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.console)}
        />
      ) : null}

      <LigneCasquette
        icone="school-outline"
        titre="S'entraîner sur la console"
        onPress={() => ouvrirSurLeSite(PAGES_DU_SITE.entrainement)}
      />
    </Bloc>
  );
}

const styles = StyleSheet.create({
  competition: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  competitionTexte: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire },
});
