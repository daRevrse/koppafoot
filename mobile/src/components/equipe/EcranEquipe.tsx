import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { cibleCompetition } from "@/lib/audience";
import { libelleDuJour } from "@/lib/dates";
import { rangerLesMatchs } from "@/lib/fiche-club";
import { BarreOnglets } from "~/components/BarreOnglets";
import { Ecusson } from "~/components/Ecusson";
import { EffectifParPoste } from "~/components/equipe/EffectifParPoste";
import { BarreEquipe, EnTeteEquipe } from "~/components/equipe/EnTeteEquipe";
import { MatchsDeLEquipe } from "~/components/equipe/MatchsDeLEquipe";
import { EtatFiche } from "~/components/fiche/EtatFiche";
import { useAudience } from "~/hooks/useAudience";
import { useCompetition } from "~/hooks/useCompetition";
import { bilanDeLEquipe, matchsDeLEquipe, placeDansLaPoule, rangLisible } from "~/lib/page-equipe";
import { retourSelection } from "~/lib/retour";
import { couleurs, espacement, polices } from "~/theme";

/** Au-delà de ce défilement, le nom de l'équipe est sorti de l'écran : la barre le reprend. */
const SEUIL_COMPACT = 110;

type OngletEquipe = "effectif" | "matchs";

/**
 * La page d'une équipe dans sa compétition (c/[slug]/teams/[tid] du site) :
 * le bandeau, le prochain match — la seule chose ici qui périme — et le
 * bilan, puis l'effectif ou les matchs.
 */
export function EcranEquipe({ cid, tid }: { cid: string; tid: string }) {
  const router = useRouter();
  const { competition, matchs, equipes, equipesLues, introuvable } = useCompetition(cid);
  // Une page de la compétition : elle compte dans son audience, comme sur le site.
  useAudience(competition ? cibleCompetition(competition.id) : null);
  const [onglet, setOnglet] = useState<OngletEquipe>("effectif");
  const [compact, setCompact] = useState(false);
  const equipe = equipes.find((e) => e.id === tid) ?? null;

  if (!competition || !equipe) {
    const absente = introuvable || (equipesLues && !equipe);
    return (
      <EtatFiche
        introuvable={absente}
        texte={introuvable ? "Cette compétition n'existe pas ou n'est plus disponible." : "Cette équipe n'existe pas dans cette compétition."}
      />
    );
  }

  const feminin = competition.category === "women";
  const vus = matchsDeLEquipe(matchs ?? [], equipe.id, competition);
  const bilan = bilanDeLEquipe(vus);
  const prochain = rangerLesMatchs(vus).aVenir[0] ?? null;
  const place = placeDansLaPoule(competition, matchs ?? [], equipes, equipe);
  const nJoueurs = equipe.players.length;
  const joueurs = `${nJoueurs} ${feminin ? "joueuse" : "joueur"}${nJoueurs > 1 ? "s" : ""}`;
  const ouvrir = (mid: string) => router.push({ pathname: "/match/[cid]/[mid]", params: { cid: competition.id, mid } });
  const retour = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={styles.ecran}>
      <StatusBar style="light" />
      <BarreEquipe equipe={equipe} competition={competition} compact={compact} onRetour={retour} />
      <ScrollView
        stickyHeaderIndices={[2]}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const replie = e.nativeEvent.contentOffset.y > SEUIL_COMPACT;
          if (replie !== compact) setCompact(replie);
        }}
        contentContainerStyle={styles.contenu}
      >
        <EnTeteEquipe
          equipe={equipe}
          competition={competition}
          place={place ? `${rangLisible(place.rang)} · ${place.points} pts` : null}
          forme={bilan.forme}
          joueurs={joueurs}
          onCompetition={() => router.push({ pathname: "/competition/[cid]", params: { cid: competition.id } })}
        />

        <View style={styles.resume}>
          {prochain ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => ouvrir(prochain.id)}
              style={({ pressed }) => [styles.carte, styles.prochain, pressed && styles.presse]}
            >
              <View style={styles.flexible}>
                <Text style={styles.surtitre}>
                  {[prochain.statut === "en_direct" ? "En direct" : "Prochain match", prochain.etape, prochain.domicile ? "Domicile" : "Extérieur"]
                    .filter(Boolean).join(" · ").toUpperCase()}
                </Text>
                <View style={styles.adversaire}>
                  <Ecusson url={prochain.adversaire.logo} nom={prochain.adversaire.nom} taille={22} />
                  <Text style={styles.adversaireNom} numberOfLines={1}>{prochain.adversaire.nom}</Text>
                </View>
                {prochain.date ? (
                  <Text style={styles.quand} numberOfLines={1}>
                    {[libelleDuJour(prochain.date), prochain.heure, prochain.lieu].filter(Boolean).join(" · ")}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={couleurs.texteDiscret} />
            </Pressable>
          ) : (
            <Text style={[styles.carte, styles.aucun]}>Aucun match à venir.</Text>
          )}

          {bilan.joues > 0 ? (
            <View style={styles.carte}>
              <Text style={styles.surtitre}>DANS LA COMPÉTITION</Text>
              <View style={styles.bilan}>
                {[
                  { n: bilan.joues, l: "Joués", ton: couleurs.texte },
                  { n: bilan.gagnes, l: "Gagnés", ton: couleurs.primaire },
                  { n: bilan.nuls, l: "Nuls", ton: couleurs.texte },
                  { n: bilan.perdus, l: "Perdus", ton: couleurs.direct },
                ].map((c) => (
                  <View key={c.l} style={styles.case}>
                    <Text style={[styles.chiffre, { color: c.ton }]}>{c.n}</Text>
                    <Text style={styles.legende}>{c.l.toUpperCase()}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.buts}>{`Buts ${bilan.pour}–${bilan.contre}`}</Text>
            </View>
          ) : null}
        </View>

        <BarreOnglets
          onglets={["effectif", "matchs"] as OngletEquipe[]}
          libelles={{
            effectif: nJoueurs > 0 ? `Effectif ${nJoueurs}` : "Effectif",
            matchs: vus.length > 0 ? `Matchs ${vus.length}` : "Matchs",
          }}
          actif={onglet}
          onChange={(o) => {
            if (o === onglet) return;
            retourSelection();
            setOnglet(o);
          }}
        />
        <View style={styles.panneau}>
          {onglet === "effectif" ? (
            <EffectifParPoste joueurs={equipe.players} clubId={equipe.claimedByTeamId} feminin={feminin} />
          ) : (
            <MatchsDeLEquipe matchs={vus} onOuvrir={(m) => ouvrir(m.id)} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  contenu: { paddingBottom: 48 },
  resume: { gap: 12, padding: 16 },
  carte: { padding: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  prochain: { flexDirection: "row", alignItems: "center", gap: 12 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  flexible: { flex: 1, minWidth: 0 },
  surtitre: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.14), color: couleurs.texteDiscret },
  adversaire: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  adversaireNom: { flex: 1, fontFamily: polices.texteNoir, fontSize: 16, color: couleurs.texte },
  quand: { marginTop: 4, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  aucun: { fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texteDiscret },
  bilan: { flexDirection: "row", marginTop: 10 },
  case: { flex: 1 },
  chiffre: { fontFamily: polices.titre, fontSize: 24 },
  legende: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.14), color: couleurs.texteDiscret },
  buts: { marginTop: 10, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  panneau: { paddingTop: 16, minHeight: 400 },
});
