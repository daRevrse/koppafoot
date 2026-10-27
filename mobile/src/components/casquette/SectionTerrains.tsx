import { ActivityIndicator, StyleSheet, Text } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { duree, finCreneau } from "@/lib/terrains";
import type { Booking } from "@/types";
import { LigneCasquette } from "~/components/casquette/LigneCasquette";
import { Bloc, stylesBloc } from "~/components/competition/Bloc";
import { demandeur, PAGES_DU_SITE } from "~/lib/espace-casquette";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { couleurs, espacement, polices } from "~/theme";

/** « Terrain du Lac · Aujourd'hui · 18:00 → 19:30 (1 h 30) » */
const creneau = (b: Booking, avecJour: boolean) =>
  [b.venueName, avecJour ? libelleDuJour(b.date) : null, `${b.time} → ${finCreneau(b.time, b.duration)} (${duree(b.duration)})`]
    .filter(Boolean)
    .join(" · ");

/**
 * Mes terrains (/mes-terrains du site) : les demandes qui attendent une
 * réponse, puis les réservations du jour. On répond sur le site.
 */
export function SectionTerrains({ reservations }: { reservations: { aRepondre: Booking[]; duJour: Booking[] } | null }) {
  const ouvrir = () => ouvrirSurLeSite(PAGES_DU_SITE.reservations);
  return (
    <Bloc titre="Mes terrains" action={{ libelle: "Gérer", onPress: () => ouvrirSurLeSite(PAGES_DU_SITE.terrains) }}>
      {reservations === null ? (
        <ActivityIndicator color={couleurs.texteDiscret} style={styles.chargement} />
      ) : reservations.aRepondre.length === 0 && reservations.duJour.length === 0 ? (
        // La casquette est là : une phrase plutôt qu'une section qui disparaît.
        <Text style={stylesBloc.vide}>Rien à traiter aujourd&apos;hui.</Text>
      ) : null}

      {reservations && reservations.aRepondre.length > 0 ? (
        <>
          <Text style={styles.groupe}>{`À répondre · ${reservations.aRepondre.length}`.toUpperCase()}</Text>
          {reservations.aRepondre.map((b) => (
            <LigneCasquette key={b.id} icone="mail-unread-outline" titre={demandeur(b)} detail={creneau(b, true)} onPress={ouvrir} />
          ))}
        </>
      ) : null}

      {reservations && reservations.duJour.length > 0 ? (
        <>
          <Text style={styles.groupe}>AUJOURD&apos;HUI</Text>
          {reservations.duJour.map((b) => (
            <LigneCasquette key={b.id} icone="calendar-outline" titre={demandeur(b)} detail={creneau(b, false)} onPress={ouvrir} />
          ))}
        </>
      ) : null}
    </Bloc>
  );
}

const styles = StyleSheet.create({
  chargement: { paddingBottom: 16 },
  groupe: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire,
  },
});
