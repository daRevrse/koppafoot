import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avecVia } from "@/lib/audience";
import { BarreDEtatSurNoir } from "~/components/BarreDEtatSurNoir";
import { BarreOnglets } from "~/components/BarreOnglets";
import { Ecusson } from "~/components/Ecusson";
import { MatchsDeLEquipe } from "~/components/equipe/MatchsDeLEquipe";
import { EtatFiche } from "~/components/fiche/EtatFiche";
import { ListeEffectif } from "~/components/ListeEffectif";
import { useFicheDuClub } from "~/hooks/useFicheDuClub";
import { urlDuSite } from "~/lib/config";
import type { FicheClub } from "~/lib/fiche-du-club";
import { initiales } from "~/lib/initiales";
import { ouvrirLeLien } from "~/lib/push";
import { retourSelection } from "~/lib/retour";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

const blanc = (opacite: number) => `rgba(255,255,255,${opacite})`;
const PASTILLE: Record<"V" | "N" | "D", { fond: string; texte: string }> = {
  V: { fond: "#34d399", texte: "#000" },
  N: { fond: blanc(0.25), texte: "#fff" },
  D: { fond: "#ef4444", texte: "#fff" },
};

type OngletClub = "effectif" | "matchs" | "competitions";

/** L'en-tête du club (BandeauEquipe du site) : sombre, sa bannière derrière. */
function EnTeteClub({ fiche }: { fiche: FicheClub }) {
  const styles = useStyles();
  const couleur = fiche.genre === "fiche" ? fiche.couleur : null;
  const banniere = fiche.genre === "fiche" ? fiche.banniere : null;
  return (
    <View style={styles.entete}>
      {banniere ? (
        <>
          <Image source={{ uri: banniere }} style={[StyleSheet.absoluteFill, styles.banniere]} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, styles.voile]} />
        </>
      ) : null}
      <View style={styles.identite}>
        {fiche.logo ? (
          <Ecusson url={fiche.logo} nom={fiche.nom} taille={72} />
        ) : (
          <View style={[styles.initiale, couleur ? { backgroundColor: couleur } : null]}>
            <Text style={styles.initialeTexte}>{initiales(fiche.nom)}</Text>
          </View>
        )}
        <View style={styles.textes}>
          {fiche.genre === "fiche" && fiche.ville ? <Text style={styles.ville}>{fiche.ville.toUpperCase()}</Text> : null}
          <Text style={styles.nom} numberOfLines={2} accessibilityRole="header">{fiche.nom.toUpperCase()}</Text>
          {fiche.genre === "fiche" && fiche.slogan ? <Text style={styles.slogan} numberOfLines={2}>{fiche.slogan}</Text> : null}
        </View>
      </View>
      {fiche.genre === "fiche" ? (
        <View style={styles.puces}>
          {fiche.niveau ? <Text style={styles.puce}>{fiche.niveau.toUpperCase()}</Text> : null}
          {fiche.recrute ? <Text style={[styles.puce, styles.vert]}>RECRUTE</Text> : null}
          {fiche.membres > 0 ? <Text style={styles.puce}>{`${fiche.membres} MEMBRE${fiche.membres > 1 ? "S" : ""}`}</Text> : null}
          {fiche.abonnes > 0 ? <Text style={[styles.puce, styles.vert]}>{`${fiche.abonnes} ABONNÉ${fiche.abonnes > 1 ? "S" : ""}`}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Ce que montre la fiche d'un club, sans sa barre du haut : l'en-tête, le
 * bilan et la forme, les meilleurs buteurs et passeurs, puis l'effectif, les
 * matchs et les compétitions. L'onglet Évolution d'un manager le reprend.
 */
export function FicheDuClubContenu({ fiche }: { fiche: FicheClub }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const [onglet, setOnglet] = useState<OngletClub>("effectif");
  if (fiche.genre === "fantome") {
    return (
      <>
        <EnTeteClub fiche={fiche} />
        <Text style={styles.fantome}>Ce club n&apos;a pas de fiche : il est né d&apos;une feuille de match.</Text>
      </>
    );
  }
  const { bilan } = fiche;
  const versJoueur = (uid: string) => router.push({ pathname: "/joueur/[uid]", params: { uid } });
  const onglets: OngletClub[] = ["effectif", "matchs", ...(fiche.competitions.length > 0 ? ["competitions" as const] : [])];

  return (
    <>
      <EnTeteClub fiche={fiche} />
      <View style={styles.colonne}>
        <View style={styles.carte}>
          <Text style={styles.surtitre}>BILAN</Text>
          {bilan.joues > 0 ? (
            <>
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
              <View style={styles.bas}>
                <Text style={styles.buts}>
                  {`Buts ${bilan.butsPour}–${bilan.butsContre}${bilan.sansEncaisser ? ` · ${bilan.sansEncaisser} sans encaisser` : ""}`}
                </Text>
                {fiche.forme.length > 0 ? (
                  <View style={styles.forme}>
                    {fiche.forme.map((r, i) => (
                      <View key={i} style={[styles.pastille, { backgroundColor: PASTILLE[r].fond }]}>
                        <Text style={[styles.pastilleTexte, { color: PASTILLE[r].texte }]}>{r}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={styles.vide}>Pas encore de match joué.</Text>
          )}
        </View>

        {fiche.meneurs.buteurs.length > 0 || fiche.meneurs.passeurs.length > 0 ? (
          <View style={styles.meneurs}>
            {([["Buteurs", fiche.meneurs.buteurs], ["Passeurs", fiche.meneurs.passeurs]] as const).map(([titre, liste]) =>
              liste.length > 0 ? (
                <View key={titre} style={[styles.carte, styles.meneur]}>
                  <Text style={styles.surtitre}>{titre.toUpperCase()}</Text>
                  {liste.slice(0, 3).map((m) => (
                    <Pressable
                      key={m.cle}
                      disabled={!m.uid}
                      onPress={() => m.uid && versJoueur(m.uid)}
                      style={styles.meneurLigne}
                    >
                      <Text style={[styles.meneurNom, m.uid && styles.souligne]} numberOfLines={1}>{m.nom}</Text>
                      <Text style={styles.meneurValeur}>{m.valeur}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null,
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.ongletsHaut}>
        <BarreOnglets
          onglets={onglets}
          libelles={{
            effectif: fiche.effectif.length ? `Effectif ${fiche.effectif.length}` : "Effectif",
            matchs: fiche.matchs.length ? `Matchs ${fiche.matchs.length}` : "Matchs",
            competitions: "Compétitions",
          }}
          actif={onglet}
          onChange={(o) => {
            if (o === onglet) return;
            retourSelection();
            setOnglet(o);
          }}
        />
      </View>
      <View style={styles.panneau}>
        {onglet === "effectif" ? (
          <View style={styles.colonne}>
            {fiche.manager || fiche.staff.length > 0 ? (
              <View style={[styles.carte, styles.encadrement]}>
                {fiche.manager ? (
                  <Pressable onPress={() => fiche.manager && versJoueur(fiche.manager.uid)} style={styles.managerLigne}>
                    {fiche.manager.photo ? (
                      <Image source={{ uri: fiche.manager.photo }} style={styles.managerPhoto} contentFit="cover" />
                    ) : (
                      <View style={[styles.managerPhoto, styles.sansPhoto]}>
                        <Text style={styles.managerInitiales}>{initiales(fiche.manager.nom)}</Text>
                      </View>
                    )}
                    <View style={styles.textes}>
                      <Text style={styles.surtitre}>MANAGER</Text>
                      <Text style={[styles.managerNom, styles.souligne]} numberOfLines={1}>{fiche.manager.nom}</Text>
                    </View>
                  </Pressable>
                ) : null}
                {fiche.staff.map((m) => (
                  <View key={`${m.nom}-${m.titre}`}>
                    <Text style={styles.surtitre}>{(m.titre || "Staff").toUpperCase()}</Text>
                    <Text style={styles.staffNom}>{m.nom}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={styles.sansMarge}>
              <ListeEffectif
                feminin={false}
                lignes={fiche.effectif.map((j) => ({ cle: j.id, nom: j.nom, numero: j.numero, poste: j.poste, photo: j.photo, uid: j.uid }))}
              />
            </View>
          </View>
        ) : null}
        {onglet === "matchs" ? <MatchsDeLEquipe matchs={fiche.matchs} onOuvrir={(m) => void ouvrirLeLien(m.lien, true)} /> : null}
        {onglet === "competitions" ? (
          <View style={[styles.carte, styles.liste]}>
            {fiche.competitions.map((c, i) => (
              <Pressable
                key={c.lien}
                accessibilityRole="link"
                onPress={() => void ouvrirLeLien(c.lienEquipe, true)}
                style={({ pressed }) => [styles.compLigne, i > 0 && styles.separee, pressed && styles.presse]}
              >
                <Ionicons name="trophy-outline" size={18} color={couleurs.primaire} />
                <View style={styles.textes}>
                  <Text style={styles.compNom} numberOfLines={1}>{c.nom}</Text>
                  <Text style={styles.compDetail}>
                    {[c.groupe ? `Groupe ${c.groupe}` : null, c.rang ? `${c.rang === 1 ? "1ᵉʳ" : `${c.rang}ᵉ`}${c.points !== null ? ` · ${c.points} pts` : ""}` : null]
                      .filter(Boolean).join(" · ") || "Inscrit"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={couleurs.texteDiscret} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </>
  );
}

/** La fiche d'un club (/teams/[id] du site, sa partie publique). */
export function EcranClub({ id }: { id: string }) {
  const styles = useStyles();
  const router = useRouter();
  const fiche = useFicheDuClub(id);
  if (!fiche) return <EtatFiche introuvable={fiche === null} texte="Ce club n'existe pas ou n'est plus disponible." />;
  const retour = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const partager = () =>
    void Share.share({ message: `${fiche.nom} sur KoppaFoot\n${urlDuSite(avecVia(`/teams/${id}`, "partage"))}` }).catch(() => {});
  return (
    <View style={styles.ecran}>
      <BarreDEtatSurNoir />
      <SafeAreaView edges={["top"]} style={styles.barreFond}>
        <View style={styles.barre}>
          <Pressable accessibilityRole="button" accessibilityLabel="Revenir à l'écran précédent" onPress={retour} hitSlop={8} style={styles.bouton}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Partager ce club" onPress={partager} hitSlop={8} style={styles.bouton}>
            <Ionicons name="share-outline" size={18} color="#fff" />
          </Pressable>
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.contenu}>
        <FicheDuClubContenu fiche={fiche} />
      </ScrollView>
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  barreFond: { backgroundColor: "#000" },
  barre: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  bouton: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: blanc(0.15),
    alignItems: "center", justifyContent: "center",
  },
  contenu: { paddingBottom: 48 },

  entete: { backgroundColor: "#000", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20, overflow: "hidden" },
  banniere: { opacity: 0.4 },
  voile: { backgroundColor: "rgba(0,0,0,0.65)" },
  identite: { flexDirection: "row", alignItems: "center", gap: 16 },
  initiale: {
    width: 72, height: 72, borderWidth: 1, borderColor: blanc(0.15), backgroundColor: blanc(0.1),
    alignItems: "center", justifyContent: "center",
  },
  initialeTexte: { fontFamily: polices.titre, fontSize: 28, color: "#fff" },
  textes: { flex: 1, minWidth: 0 },
  ville: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.16), color: "#6ee7b7" },
  nom: { marginTop: 4, fontFamily: polices.titre, fontSize: 24, lineHeight: 26, color: "#fff" },
  slogan: { marginTop: 4, fontFamily: polices.texteMoyen, fontStyle: "italic", fontSize: 13, color: blanc(0.7) },
  puces: { flexDirection: "row", flexWrap: "wrap", columnGap: 18, rowGap: 6, marginTop: 16 },
  puce: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: blanc(0.6) },
  vert: { color: "#6ee7b7" },
  fantome: { padding: 16, fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire },

  colonne: { gap: 12, paddingTop: 16 },
  carte: { marginHorizontal: 16, padding: 16, backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  surtitre: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.14), color: couleurs.texteDiscret },
  bilan: { flexDirection: "row", marginTop: 10 },
  case: { flex: 1 },
  chiffre: { fontFamily: polices.titre, fontSize: 24 },
  legende: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.14), color: couleurs.texteDiscret },
  bas: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 12 },
  buts: { flexShrink: 1, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteSecondaire },
  forme: { flexDirection: "row", gap: 2 },
  pastille: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  pastilleTexte: { fontFamily: polices.texteNoir, fontSize: 9 },
  vide: { marginTop: 8, fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
  meneurs: { flexDirection: "row", gap: 0 },
  meneur: { flex: 1, gap: 8 },
  meneurLigne: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  meneurNom: { flex: 1, fontFamily: polices.texteGras, fontSize: 13, color: couleurs.texte },
  meneurValeur: { fontFamily: polices.titre, fontSize: 16, color: couleurs.texte },
  souligne: { textDecorationLine: "underline", textDecorationColor: couleurs.bordureForte },

  ongletsHaut: { marginTop: 16 },
  panneau: { paddingTop: 16, minHeight: 300 },
  encadrement: { gap: 12 },
  managerLigne: { flexDirection: "row", alignItems: "center", gap: 12 },
  managerPhoto: { width: 36, height: 36, borderRadius: 18 },
  sansPhoto: { backgroundColor: couleurs.primaireVoile, alignItems: "center", justifyContent: "center" },
  managerInitiales: { fontFamily: polices.texteNoir, fontSize: 12, color: couleurs.primaire },
  managerNom: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 15, color: couleurs.texte },
  staffNom: { marginTop: 2, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texteSecondaire },
  sansMarge: { marginTop: 4 },
  liste: { marginHorizontal: 16, padding: 0 },
  compLigne: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  separee: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure },
  presse: { backgroundColor: couleurs.surfaceHaute },
  compNom: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  compDetail: { marginTop: 2, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },
}));
