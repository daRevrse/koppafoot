import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { montant, type BlocOffre, type Jauge, type Tarifs, type VueOffre } from "~/lib/offre-app";
import { couleurs, espacement, polices } from "~/theme";

const date = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

/** « jusqu'au 31 décembre 2026 », ou « sans échéance ». */
const echeance = (b: BlocOffre) => (b.jusquAu ? `jusqu'au ${date(b.jusquAu)}` : "sans échéance");

/**
 * Le contenu de la page Offre : le gratuit qui le reste, KoppaFoot+ (à qui
 * gère, ou sans compte), ce que le compte utilise face aux plafonds, et
 * « Pas de pubs ». Des tarifs, aucun bouton de paiement (lib/offre-app).
 */
export function ContenuOffre({ vue }: { vue: VueOffre }) {
  return (
    <ScrollView contentContainerStyle={styles.contenu}>
      <Text style={styles.sousTitre}>
        Jouer, suivre un match, s&apos;inscrire à une compétition, arbitrer : c&apos;est gratuit et ça le reste.
      </Text>

      {vue.plus ? (
        <View style={[styles.bloc, vue.plus.actif && styles.blocActif]}>
          <EnTeteBloc icone="diamond-outline" nom="KoppaFoot+" bloc={vue.plus} />
          <Text style={styles.texte}>
            {vue.plus.actif
              ? vue.plus.horsProfil
                ? "Il retire la publicité. Le reste de KoppaFoot+ sert à qui gère des équipes, des compétitions ou des terrains."
                : "Les plafonds de ce que tu gères sont levés, et la publicité est retirée."
              : vue.jauges
                ? "Ce que KoppaFoot+ débloque pour toi :"
                : "Pour qui gère des équipes, des compétitions ou des terrains :"}
          </Text>
          <View style={styles.avantages}>
            {vue.plus.avantages.map((a) => (
              <View key={a} style={styles.avantage}>
                <Ionicons name="checkmark" size={15} color={couleurs.primaire} />
                <Text style={styles.avantageTexte}>{a}</Text>
              </View>
            ))}
          </View>
          <LesTarifs tarifs={vue.plus.tarifs} />
        </View>
      ) : null}

      {vue.jauges && vue.jauges.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.titreSection} accessibilityRole="header">CHEZ TOI</Text>
          <Text style={styles.note}>
            {vue.limitesActives && vue.limitesDepuis
              ? `En vigueur depuis le ${date(vue.limitesDepuis)}.`
              : "Les limites de l'offre gratuite ne s'appliquent pas encore. On te préviendra avant."}
          </Text>
          <View style={styles.cadre}>
            {vue.jauges.map((j, i) => <LigneJauge key={j.libelle} jauge={j} premiere={i === 0} />)}
          </View>
        </View>
      ) : null}

      {vue.sansPub ? (
        <View style={[styles.bloc, vue.sansPub.actif && styles.blocActif]}>
          <EnTeteBloc icone="eye-off-outline" nom="Pas de pubs" bloc={vue.sansPub} />
          <Text style={styles.texte}>
            Retire les emplacements des partenaires et les annonces, partout dans l&apos;application. Rien d&apos;autre
            ne change.
          </Text>
          <LesTarifs tarifs={vue.sansPub.tarifs} />
        </View>
      ) : null}
    </ScrollView>
  );
}

function EnTeteBloc({ icone, nom, bloc }: { icone: "diamond-outline" | "eye-off-outline"; nom: string; bloc: BlocOffre }) {
  return (
    <View style={styles.enTeteBloc}>
      <Ionicons name={icone} size={20} color={couleurs.primaire} />
      <Text style={styles.nom}>{nom.toUpperCase()}</Text>
      {bloc.actif ? (
        <View style={styles.pastille}>
          <Text style={styles.pastilleTexte}>{`EN COURS · ${echeance(bloc)}`.toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Les deux durées et leur prix ; « soit … par mois » pour l'année, comme le site. */
function LesTarifs({ tarifs }: { tarifs: Tarifs }) {
  if (tarifs.mois === null && tarifs.an === null) {
    return <Text style={styles.note}>Tarif à venir.</Text>;
  }
  return (
    <View style={styles.tarifs}>
      {tarifs.mois !== null ? (
        <View style={styles.tarif}>
          <Text style={styles.duree}>1 MOIS</Text>
          <Text style={styles.prix}>{montant(tarifs.mois)}</Text>
        </View>
      ) : null}
      {tarifs.an !== null ? (
        <View style={styles.tarif}>
          <Text style={styles.duree}>1 AN</Text>
          <Text style={styles.prix}>{montant(tarifs.an)}</Text>
          <Text style={styles.parMois}>{`soit ${montant(Math.round(tarifs.an / 12))} par mois`}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LigneJauge({ jauge: j, premiere }: { jauge: Jauge; premiere: boolean }) {
  return (
    <View style={[styles.jauge, !premiere && styles.trait]}>
      <Text style={styles.jaugeLibelle}>{j.libelle}</Text>
      <Text style={[styles.jaugeValeur, !j.illimite && j.usage !== null && j.usage >= j.max && { color: couleurs.accent }]}>
        {j.illimite ? "illimité" : j.usage === null ? String(j.max) : `${j.usage} / ${j.max}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 20 },
  sousTitre: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: couleurs.texteSecondaire },
  bloc: {
    gap: 12, padding: 16,
    backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  // En cours : le cadre prend la couleur du site (border-emerald-600).
  blocActif: { borderColor: couleurs.primaire, borderWidth: 1 },
  enTeteBloc: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 },
  nom: { fontFamily: polices.titre, fontSize: 20, color: couleurs.texte },
  pastille: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: couleurs.primaireVoile },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.1), color: couleurs.primaire },
  texte: { fontFamily: polices.texte, fontSize: 14, lineHeight: 20, color: couleurs.texteSecondaire },
  avantages: { gap: 8 },
  avantage: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  avantageTexte: { flex: 1, fontFamily: polices.texteGras, fontSize: 14, lineHeight: 19, color: couleurs.texte },
  tarifs: { flexDirection: "row", gap: 8, marginTop: 4 },
  tarif: { flex: 1, gap: 2, padding: 12, backgroundColor: couleurs.surfaceHaute },
  duree: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.12), color: couleurs.texteDiscret },
  prix: { fontFamily: polices.titre, fontSize: 18, color: couleurs.texte },
  parMois: { fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
  note: { fontFamily: polices.texteGras, fontSize: 12, lineHeight: 17, color: couleurs.texteDiscret },
  section: { gap: 8 },
  titreSection: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10), color: couleurs.texteDiscret },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  jauge: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  trait: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  jaugeLibelle: { flex: 1, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  jaugeValeur: { fontFamily: polices.titre, fontSize: 17, color: couleurs.texte },
});
