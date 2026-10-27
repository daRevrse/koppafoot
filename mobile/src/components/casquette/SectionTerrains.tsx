import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { libelleDuJour } from "@/lib/dates";
import { duree, finCreneau } from "@/lib/terrains";
import type { Booking } from "@/types";
import { BoutonGeste } from "~/components/casquette/BoutonGeste";
import { LigneCasquette } from "~/components/casquette/LigneCasquette";
import { Bloc, useStylesBloc } from "~/components/competition/Bloc";
import type { DemandeATraiter } from "~/hooks/useEspaceCasquette";
import { useAuth } from "~/lib/auth";
import { repondreALaDemande } from "~/lib/casquette-api";
import { demandeur, PAGES_DU_SITE } from "~/lib/espace-casquette";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { retourImpact } from "~/lib/retour";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

/** « Terrain du Lac · Aujourd'hui · 18:00 → 19:30 (1 h 30) » */
const creneau = (b: Booking, avecJour: boolean) =>
  [b.venueName, avecJour ? libelleDuJour(b.date) : null, `${b.time} → ${finCreneau(b.time, b.duration)} (${duree(b.duration)})`]
    .filter(Boolean)
    .join(" · ");

/** « 18:30 → 19:30, déjà pris pour Ama » : ce que la demande recouvre. */
const chevauchement = (c: Booking) =>
  `${c.time} → ${finCreneau(c.time, c.duration)}, ${c.kind === "blocage" ? "un créneau que tu as bloqué" : `déjà pris pour ${demandeur(c)}`}`;

/**
 * Mes terrains (/mes-terrains du site) : les demandes qui attendent une
 * réponse, qu'on confirme ou refuse d'ici, puis les réservations du jour.
 * Le serveur prévient l'équipe et ouvre les frais de réservation s'il y en a ;
 * proposer un autre créneau se fait sur le site.
 */
export function SectionTerrains({ reservations }: {
  reservations: { aRepondre: DemandeATraiter[]; duJour: Booking[] } | null;
}) {
  const stylesBloc = useStylesBloc();
  const styles = useStyles();
  const couleurs = useCouleurs();
  const { utilisateur } = useAuth();
  const [enCours, setEnCours] = useState<string | null>(null);
  const ouvrir = () => ouvrirSurLeSite(PAGES_DU_SITE.reservations);

  // La demande traitée quitte la liste d'elle-même : l'écouteur voit son nouveau statut.
  async function repondre(b: Booking, action: "confirmer" | "refuser") {
    if (!utilisateur) return;
    retourImpact();
    setEnCours(b.id);
    try {
      await repondreALaDemande(utilisateur, b.id, action);
    } catch (e) {
      Alert.alert("La réponse n'est pas passée", e instanceof Error ? e.message : undefined);
    } finally {
      setEnCours(null);
    }
  }

  // Confirmer par-dessus un créneau pris n'est pas interdit (deux surfaces,
  // peut-être), mais on le dit en toutes lettres, comme le site.
  function confirmer({ demande: b, conflit }: DemandeATraiter) {
    if (enCours) return;
    if (!conflit) return void repondre(b, "confirmer");
    Alert.alert(
      "Deux équipes sur le même créneau ?",
      `${demandeur(b)} demande ${b.time} → ${finCreneau(b.time, b.duration)}, et ${chevauchement(conflit)}. Confirmer les deux, c'est en décevoir une.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer quand même", onPress: () => void repondre(b, "confirmer") },
      ],
    );
  }

  function refuser(b: Booking) {
    if (enCours) return;
    Alert.alert(
      "Refuser cette demande ?",
      `${demandeur(b)} recevra une notification. Pour proposer un autre créneau, réponds depuis le site.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Proposer un créneau", onPress: ouvrir },
        { text: "Refuser", style: "destructive", onPress: () => void repondre(b, "refuser") },
      ],
    );
  }

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
          {reservations.aRepondre.map((d) => (
            <View key={d.demande.id}>
              <LigneCasquette icone="mail-unread-outline" titre={demandeur(d.demande)} detail={creneau(d.demande, true)} onPress={ouvrir} />
              {d.conflit ? <Text style={styles.conflit}>{`Chevauche ${chevauchement(d.conflit)}.`}</Text> : null}
              <View style={styles.gestes}>
                <BoutonGeste
                  libelle="Refuser"
                  variante="contour"
                  accessibilityLabel={`Refuser la demande de ${demandeur(d.demande)}`}
                  inactif={enCours !== null}
                  onPress={() => refuser(d.demande)}
                />
                <BoutonGeste
                  libelle="Confirmer"
                  accessibilityLabel={`Confirmer la demande de ${demandeur(d.demande)}`}
                  occupe={enCours === d.demande.id}
                  inactif={enCours !== null}
                  onPress={() => confirmer(d)}
                />
              </View>
            </View>
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

// Les gestes et l'avertissement s'alignent sur le texte de la ligne, après son icône (16 + 34 + 12).
const RETRAIT = 62;

const useStyles = creerStyles((couleurs) => ({
  chargement: { paddingBottom: 16 },
  groupe: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.primaire,
  },
  conflit: { paddingLeft: RETRAIT, paddingRight: 16, paddingBottom: 8, fontFamily: polices.texteGras, fontSize: 12, color: couleurs.accent },
  gestes: { flexDirection: "row", gap: 8, paddingLeft: RETRAIT, paddingRight: 16, paddingBottom: 14 },
}));
