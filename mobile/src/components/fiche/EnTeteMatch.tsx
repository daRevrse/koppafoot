import { Ionicons } from "@expo/vector-icons";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avecVia } from "@/lib/audience";
import type { Buteur } from "@/lib/buteurs";
import { libelleDuJour } from "@/lib/dates";
import { nomCourt } from "@/lib/terrain";
import { Ecusson } from "~/components/Ecusson";
import { PointDirect } from "~/components/direct/PointDirect";
import { urlDuSite } from "~/lib/config";
import {
  additionnelEnCours, chronoAffiche, formatCompteARebours, libellePeriode, resteAvantCoupDEnvoi, texteDePartage,
  type CampDeFiche, type Fiche,
} from "~/lib/fiche-match";
import { ouvrirSurLeSite } from "~/lib/navigateur";
import { espacement, polices } from "~/theme";

// Le tableau d'affichage du site (components/match/MatchHero) : SOMBRE PAR
// CONSTRUCTION, dans les deux thèmes. Du noir et des blancs translucides, le
// vert du chrono et l'ambre du temps additionnel.
const VERT = "#34d399";
const AMBRE = "#FCD34D";
const ROUGE = "#f87171";
const blanc = (opacite: number) => `rgba(255,255,255,${opacite})`;

const aCommence = (fiche: Fiche) => fiche.statut === "live" || fiche.statut === "completed";

/** Partager le lien du match, avec ce qu'il faut savoir avant de l'ouvrir. */
export function partagerLaFiche(fiche: Fiche): void {
  const lien = urlDuSite(avecVia(fiche.lienSite, "partage"));
  void Share.share({ message: `${texteDePartage(fiche)}\n${lien}` }).catch(() => {});
}

/**
 * La barre du haut, collée : retour et partage, et le score en petit dès
 * que le tableau est sorti de l'écran (`compact`).
 */
export function BarreFiche({ fiche, maintenant, compact, onRetour }: {
  fiche: Fiche;
  maintenant: number;
  compact: boolean;
  onRetour: () => void;
}) {
  const chrono = chronoAffiche(fiche, maintenant);
  const additionnel = additionnelEnCours(fiche);
  return (
    <SafeAreaView edges={["top"]} style={styles.barreFond}>
      <View style={styles.barre}>
        <Pressable accessibilityRole="button" accessibilityLabel="Revenir à l'écran précédent" onPress={onRetour} hitSlop={8} style={styles.bouton}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <View style={[styles.compact, !compact && styles.cache]} accessibilityElementsHidden={!compact}>
          <Ecusson url={fiche.domicile.logo} nom={fiche.domicile.nom} taille={20} />
          <View style={styles.compactCentre}>
            <Text style={styles.compactScore}>
              {aCommence(fiche) ? `${fiche.domicile.score ?? 0} – ${fiche.exterieur.score ?? 0}` : fiche.heure ?? "VS"}
            </Text>
            {fiche.statut === "live" && chrono ? (
              <Text style={styles.compactChrono}>
                {chrono}
                {additionnel ? <Text style={styles.ambre}>{` +${additionnel}`}</Text> : null}
              </Text>
            ) : null}
          </View>
          <Ecusson url={fiche.exterieur.logo} nom={fiche.exterieur.nom} taille={20} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Partager ce match" onPress={() => partagerLaFiche(fiche)} hitSlop={8} style={styles.bouton}>
          <Ionicons name="share-outline" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Camp({ camp }: { camp: CampDeFiche }) {
  return (
    <View style={styles.camp}>
      <Ecusson url={camp.logo} nom={camp.nom} taille={48} />
      <Text style={styles.nomCamp} numberOfLines={2}>{camp.nom.toUpperCase()}</Text>
    </View>
  );
}

/** Ce qui se lit sous le score, ou à sa place avant le coup d'envoi. */
function Centre({ fiche, maintenant }: { fiche: Fiche; maintenant: number }) {
  if (aCommence(fiche)) {
    const periode = libellePeriode(fiche, maintenant);
    const chrono = chronoAffiche(fiche, maintenant);
    const additionnel = additionnelEnCours(fiche);
    return (
      <View style={styles.centre}>
        <Text style={styles.score} accessibilityLabel={`${fiche.domicile.score ?? 0} à ${fiche.exterieur.score ?? 0}`}>
          {fiche.domicile.score ?? 0}
          <Text style={styles.tiret}> – </Text>
          {fiche.exterieur.score ?? 0}
        </Text>
        {fiche.statut === "live" ? (
          <>
            <Text style={styles.periode}>{periode.toUpperCase()}</Text>
            {chrono ? (
              <Text style={styles.chrono}>
                {chrono}
                {additionnel ? <Text style={styles.ambre}>{` +${additionnel}`}</Text> : null}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.termine}>{periode.toUpperCase()}</Text>
        )}
        <TirsAuBut fiche={fiche} />
      </View>
    );
  }
  if (fiche.statut === "cancelled") {
    return (
      <View style={styles.centre}>
        <Text style={[styles.score, styles.estompe]}>–</Text>
        <Text style={styles.annule}>ANNULÉ</Text>
      </View>
    );
  }
  // Le coup d'envoi, à la place du « VS » ; le compte à rebours dans les
  // dernières vingt-quatre heures.
  const reste = resteAvantCoupDEnvoi(fiche, maintenant);
  const jour = reste !== null ? formatCompteARebours(reste) : fiche.date ? libelleDuJour(fiche.date) : null;
  return (
    <View style={styles.centre}>
      {jour ? <Text style={styles.jour}>{jour.toUpperCase()}</Text> : null}
      {fiche.heure ? <Text style={styles.heure}>{fiche.heure}</Text> : null}
      {!jour && !fiche.heure ? <Text style={styles.vs}>VS</Text> : null}
    </View>
  );
}

/** La séance de tirs au but : sans elle, un 2-2 se lit comme un nul. */
function TirsAuBut({ fiche }: { fiche: Fiche }) {
  if (fiche.penaltyHome == null || fiche.penaltyAway == null) return null;
  return <Text style={styles.tirs}>{`TIRS AU BUT · ${fiche.penaltyHome}–${fiche.penaltyAway}`}</Text>;
}

/** Les buteurs d'un camp, alignés vers le centre, leurs minutes à la suite. */
function ListeDeButeurs({ buteurs, droite }: { buteurs: Buteur[]; droite: boolean }) {
  return (
    <View style={[styles.buteurs, droite ? styles.aGauche : styles.aDroite]}>
      {buteurs.map((b) => (
        <View key={`${b.nom}-${b.csc}`}>
          <Text style={[styles.buteur, droite ? styles.texteAGauche : styles.texteADroite]}>
            {b.nom}
            {b.csc ? <Text style={styles.pale}> (c.s.c.)</Text> : null}
            {b.minutes.length > 0
              ? <Text style={styles.pale}>{`  ${b.minutes.join(", ")}`}</Text>
              : b.nombre > 1 ? <Text style={styles.pale}>{`  ×${b.nombre}`}</Text> : null}
          </Text>
          {b.passeurs.length > 0 ? (
            <Text style={[styles.passeur, droite ? styles.texteAGauche : styles.texteADroite]}>
              {`passe de ${b.passeurs.map((p) => nomCourt(p, 18)).join(", ")}`}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** Le tableau d'affichage : la compétition, les deux camps, le score, les buteurs. */
export function EnTeteMatch({ fiche, maintenant }: { fiche: Fiche; maintenant: number }) {
  const { buteurs } = fiche;
  return (
    <View style={styles.entete}>
      <View style={styles.contexte}>
        {fiche.statut === "live" ? <PointDirect /> : null}
        {fiche.competition ? (
          <Pressable accessibilityRole="link" onPress={() => fiche.competition?.slug && ouvrirSurLeSite(`/c/${fiche.competition.slug}`)}>
            <Text style={styles.competition}>{fiche.competition.nom.toUpperCase()}</Text>
          </Pressable>
        ) : (
          <Text style={styles.competition}>MATCH AMICAL</Text>
        )}
        {fiche.competition?.sousTitre ? (
          <>
            <Text style={styles.point}>·</Text>
            <Text style={styles.sousTitre}>{fiche.competition.sousTitre.toUpperCase()}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.affiche}>
        <Camp camp={fiche.domicile} />
        <Centre fiche={fiche} maintenant={maintenant} />
        <Camp camp={fiche.exterieur} />
      </View>

      {buteurs.home.length > 0 || buteurs.away.length > 0 ? (
        <View style={styles.lignesButeurs}>
          <ListeDeButeurs buteurs={buteurs.home} droite={false} />
          <Ionicons name="football-outline" size={13} color={blanc(0.35)} style={styles.ballon} />
          <ListeDeButeurs buteurs={buteurs.away} droite />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  barreFond: { backgroundColor: "#000" },
  barre: { height: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16 },
  bouton: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: blanc(0.15),
    alignItems: "center", justifyContent: "center",
  },
  compact: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  cache: { opacity: 0 },
  compactCentre: { alignItems: "center" },
  compactScore: { fontFamily: polices.titre, fontSize: 18, color: "#fff" },
  compactChrono: { fontFamily: polices.texteNoir, fontSize: 10, color: VERT },
  ambre: { color: AMBRE },

  entete: { backgroundColor: "#000", paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20 },
  contexte: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8 },
  competition: { fontFamily: polices.texteNoir, fontSize: 13, letterSpacing: espacement(13, 0.06), color: "#fff" },
  point: { color: blanc(0.3) },
  sousTitre: { fontFamily: polices.texteGras, fontSize: 11, letterSpacing: espacement(11, 0.14), color: blanc(0.5) },

  affiche: { flexDirection: "row", alignItems: "flex-start", marginTop: 16 },
  camp: { flex: 1, alignItems: "center", gap: 8 },
  nomCamp: { fontFamily: polices.texteNoir, fontSize: 11, color: "#fff", textAlign: "center" },
  centre: { flex: 1, alignItems: "center", gap: 6, paddingTop: 8 },
  score: { fontFamily: polices.titre, fontSize: 36, lineHeight: 38, color: "#fff" },
  tiret: { color: blanc(0.3) },
  estompe: { color: blanc(0.25) },
  periode: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: VERT },
  chrono: { fontFamily: polices.texteNoir, fontSize: 14, color: VERT, fontVariant: ["tabular-nums"] },
  termine: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.16), color: blanc(0.5) },
  annule: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.16), color: ROUGE },
  jour: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.1), color: VERT },
  heure: { fontFamily: polices.titre, fontSize: 30, lineHeight: 32, color: "#fff" },
  vs: { fontFamily: polices.texteNoir, fontSize: 14, fontStyle: "italic", color: blanc(0.3) },
  tirs: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: blanc(0.6) },

  lignesButeurs: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 16 },
  ballon: { marginTop: 2 },
  buteurs: { flex: 1, gap: 4 },
  aDroite: { alignItems: "flex-end" },
  aGauche: { alignItems: "flex-start" },
  buteur: { fontFamily: polices.texteGras, fontSize: 11, color: blanc(0.75) },
  texteADroite: { textAlign: "right" },
  texteAGauche: { textAlign: "left" },
  pale: { color: blanc(0.45) },
  passeur: { fontFamily: polices.texteDemi, fontSize: 10, color: blanc(0.4) },
});
