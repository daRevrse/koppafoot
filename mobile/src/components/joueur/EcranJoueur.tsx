import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { avecVia } from "@/lib/audience";
import { LIBELLE_FORME, type FormeJoueur } from "@/lib/etat-de-forme";
import { formaterNote } from "@/lib/notes";
import { BarreDEtatSurNoir } from "~/components/BarreDEtatSurNoir";
import { Ecusson } from "~/components/Ecusson";
import { EtatFiche } from "~/components/fiche/EtatFiche";
import { PastilleNote } from "~/components/fiche/JoueurDuMatch";
import { useFicheJoueur } from "~/hooks/useFicheJoueur";
import { urlDuSite } from "~/lib/config";
import type { FicheJoueur } from "~/lib/fiche-joueur";
import { initiales } from "~/lib/initiales";
import { ouvrirLeLien } from "~/lib/push";
import { creerStyles, espacement, palettes, polices, useCouleurs } from "~/theme";

const blanc = (opacite: number) => `rgba(255,255,255,${opacite})`;

function Cadre({ titre, children }: { titre: string; children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.cadre}>
      <Text style={styles.cadreTitre} accessibilityRole="header">{titre.toUpperCase()}</Text>
      {children}
    </View>
  );
}

/** Le visage : la photo, ou les initiales. */
function Visage({ nom, photo, taille }: { nom: string; photo: string | null; taille: number }) {
  const styles = useStyles();
  const forme = { width: taille, height: taille, borderRadius: taille / 2 };
  return photo ? (
    <Image source={{ uri: photo }} style={[forme, styles.visageBord]} contentFit="cover" accessibilityIgnoresInvertColors />
  ) : (
    <View style={[forme, styles.visageVide]}>
      <Text style={[styles.initiales, { fontSize: Math.round(taille * 0.34) }]}>{initiales(nom)}</Text>
    </View>
  );
}

/** La forme (la case Forme de BilanDuProfil) : le niveau et la moyenne, puis la note de chaque match, qui l'ouvre. */
function Forme({ forme }: { forme: FormeJoueur | null }) {
  const styles = useStyles();
  const matchs = (forme?.matchs ?? []).slice(0, 5);
  if (!forme || matchs.length === 0) return <Text style={styles.vide}>Pas encore de match noté.</Text>;
  return (
    <View style={styles.forme}>
      {forme.niveau && forme.indice !== null ? (
        <Text style={styles.niveau}>{`${LIBELLE_FORME[forme.niveau]} · ${formaterNote(forme.indice, "fr")} de moyenne`}</Text>
      ) : (
        <Text style={styles.vide}>Il faut deux matchs notés pour la calculer.</Text>
      )}
      <View style={styles.notes}>
        {matchs.map((m) => (
          <Pressable
            key={m.matchId}
            accessibilityRole="link"
            accessibilityLabel={`${m.resultat === "V" ? "Victoire" : m.resultat === "N" ? "Nul" : "Défaite"} ${m.score} contre ${m.adversaire}, note ${formaterNote(m.note, "fr")}`}
            disabled={!m.lien}
            onPress={() => m.lien && void ouvrirLeLien(m.lien, true)}
            style={styles.note}
          >
            <PastilleNote note={m.note} />
            <Text style={styles.noteAdversaire} numberOfLines={1}>{m.adversaire}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Ce que montre la fiche d'un joueur, sans sa barre du haut : l'en-tête, les
 * chiffres, la forme, l'arbitrage, les équipes, les infos, la bio, la galerie.
 * L'onglet Évolution d'un joueur ou d'un arbitre le reprend pour sa fiche.
 */
export function ContenuFicheJoueur({ fiche, forme }: { fiche: Extract<FicheJoueur, { genre: "fiche" }>; forme: FormeJoueur | null }) {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const identite = [fiche.role, fiche.poste, fiche.numero ? `N°${fiche.numero}` : null].filter(Boolean).join(" · ");
  const infos = [
    fiche.pied ? ["Pied", fiche.pied] : null,
    fiche.niveau ? ["Niveau", fiche.niveau] : null,
    fiche.licence ? ["Licence", fiche.licence.replace("Licence ", "")] : null,
    fiche.age !== null ? ["Âge", `${fiche.age} ans`] : null,
    fiche.taille ? ["Taille", `${fiche.taille} cm`] : null,
    fiche.poids ? ["Poids", `${fiche.poids} kg`] : null,
  ].filter((x): x is string[] => !!x);

  return (
    <>
      <View style={styles.entete}>
        {fiche.couverture ? (
          <>
            <Image source={{ uri: fiche.couverture }} style={[StyleSheet.absoluteFill, styles.couverture]} contentFit="cover" />
            <View style={[StyleSheet.absoluteFill, styles.voile]} />
          </>
        ) : null}
        <Visage nom={fiche.nom} photo={fiche.photo} taille={88} />
        <Text style={styles.nom} accessibilityRole="header">{fiche.nom.toUpperCase()}</Text>
        {identite ? <Text style={styles.identite}>{identite.toUpperCase()}</Text> : null}
        <View style={styles.details}>
          {fiche.ville ? <Text style={styles.detail}>{fiche.ville.toUpperCase()}</Text> : null}
          {fiche.abonnes > 0 ? <Text style={[styles.detail, styles.vert]}>{`${fiche.abonnes} ABONNÉ${fiche.abonnes > 1 ? "S" : ""}`}</Text> : null}
        </View>
      </View>

      <View style={styles.colonne}>
        <View style={styles.chiffres}>
          {[["Matchs", fiche.matchs], ["Buts", fiche.buts], ["Passes déc.", fiche.passes]].map(([l, n]) => (
            <View key={l} style={styles.case}>
              <Text style={styles.chiffre}>{n}</Text>
              <Text style={styles.legende}>{String(l).toUpperCase()}</Text>
            </View>
          ))}
        </View>

        {fiche.arbitrage ? (
          <Cadre titre="Arbitrage">
            <View style={styles.infos}>
              {[
                ["Matchs arbitrés", String(fiche.arbitrage.matchs)],
                ["Note /5", fiche.arbitrage.note !== null ? formaterNote(fiche.arbitrage.note, "fr") : "–"],
                ["Avis", fiche.arbitrage.avis ? String(fiche.arbitrage.avis) : "Pas encore noté"],
              ].map(([l, v]) => (
                <View key={l} style={styles.info}>
                  <Text style={styles.infoLabel}>{l.toUpperCase()}</Text>
                  <Text style={styles.infoValeur}>{v}</Text>
                </View>
              ))}
            </View>
            {fiche.arbitrage.corps ? (
              <Text style={styles.vide}>
                {`${fiche.arbitrage.corps.chef ? "Dirige" : "Membre de"} « ${fiche.arbitrage.corps.nom} » · ${fiche.arbitrage.corps.membres} arbitre${fiche.arbitrage.corps.membres > 1 ? "s" : ""}`}
              </Text>
            ) : null}
          </Cadre>
        ) : null}

        <Cadre titre="Forme">
          <Forme forme={forme} />
        </Cadre>

        {fiche.equipes.length > 0 ? (
          <Cadre titre={fiche.equipes.length > 1 ? "Équipes" : "Équipe"}>
            {fiche.equipes.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="link"
                onPress={() => router.push({ pathname: "/club/[id]", params: { id: e.id } })}
                style={({ pressed }) => [styles.equipe, pressed && styles.presse]}
              >
                <Ecusson url={e.logo} nom={e.nom} taille={32} />
                <View style={styles.flexible}>
                  <Text style={styles.equipeNom} numberOfLines={1}>{e.nom}</Text>
                  <Text style={styles.equipeBilan}>
                    {[e.dirige ? "Manager" : null, e.joues > 0 ? `${e.victoires} V · ${e.nuls} N · ${e.defaites} D` : "Pas encore de match"].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color={couleurs.texteDiscret} />
              </Pressable>
            ))}
          </Cadre>
        ) : null}

        {infos.length > 0 ? (
          <Cadre titre="Infos">
            <View style={styles.infos}>
              {infos.map(([l, v]) => (
                <View key={l} style={styles.info}>
                  <Text style={styles.infoLabel}>{l.toUpperCase()}</Text>
                  <Text style={styles.infoValeur}>{v}</Text>
                </View>
              ))}
            </View>
          </Cadre>
        ) : null}

        {fiche.bio ? (
          <Cadre titre="Bio">
            <Text style={styles.bio}>{fiche.bio}</Text>
          </Cadre>
        ) : null}

        {fiche.galerie.length > 0 ? (
          <Cadre titre="Galerie">
            <View style={styles.galerie}>
              {fiche.galerie.slice(0, 9).map((u) => (
                <Image key={u} source={{ uri: u }} style={styles.photo} contentFit="cover" />
              ))}
            </View>
          </Cadre>
        ) : null}
      </View>
    </>
  );
}

/**
 * La fiche d'un joueur (/profile/[uid] du site) : son visage et ce qu'il
 * est, ses chiffres et sa forme, ses équipes, ses infos, sa bio, sa galerie.
 * Un compte sans fiche publique ne montre que son nom et sa photo.
 */
export function EcranJoueur({ uid }: { uid: string }) {
  const styles = useStyles();
  const router = useRouter();
  const { fiche, forme } = useFicheJoueur(uid);
  if (!fiche) return <EtatFiche introuvable={fiche === null} texte="Ce joueur n'existe pas ou n'est plus disponible." />;

  const retour = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const partager = () =>
    void Share.share({ message: `${fiche.nom} sur KoppaFoot\n${urlDuSite(avecVia(`/profile/${uid}`, "partage"))}` }).catch(() => {});

  return (
    <View style={styles.ecran}>
      <BarreDEtatSurNoir />
      <SafeAreaView edges={["top"]} style={styles.barreFond}>
        <View style={styles.barre}>
          <Pressable accessibilityRole="button" accessibilityLabel="Revenir à l'écran précédent" onPress={retour} hitSlop={8} style={styles.bouton}>
            <Ionicons name="chevron-back" size={18} color="#fff" />
          </Pressable>
          {fiche.genre === "fiche" ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Partager cette fiche" onPress={partager} hitSlop={8} style={styles.bouton}>
              <Ionicons name="share-outline" size={18} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.contenu}>
        {fiche.genre === "fiche" ? (
          <ContenuFicheJoueur fiche={fiche} forme={forme} />
        ) : (
          <View style={styles.entete}>
            <Visage nom={fiche.nom} photo={fiche.photo} taille={88} />
            <Text style={styles.nom}>{fiche.nom.toUpperCase()}</Text>
            <Text style={styles.ferme}>Ce compte n&apos;a pas de fiche publique.</Text>
          </View>
        )}
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

  entete: { alignItems: "center", gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, backgroundColor: "#000", overflow: "hidden" },
  couverture: { opacity: 0.35 },
  voile: { backgroundColor: "rgba(0,0,0,0.6)" },
  visageBord: { borderWidth: 2, borderColor: blanc(0.15) },
  // Sur l'en-tête noir, dans les deux thèmes.
  visageVide: { backgroundColor: palettes.sombre.primaireVoile, alignItems: "center", justifyContent: "center" },
  initiales: { fontFamily: polices.texteNoir, color: palettes.sombre.primaire },
  nom: { marginTop: 8, textAlign: "center", fontFamily: polices.titre, fontSize: 26, lineHeight: 28, color: "#fff" },
  identite: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.16), color: "#6ee7b7" },
  details: { flexDirection: "row", gap: 16 },
  detail: { fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.14), color: blanc(0.55) },
  vert: { color: "#6ee7b7" },
  ferme: { marginTop: 8, fontFamily: polices.texte, fontSize: 14, color: blanc(0.6) },

  colonne: { gap: 16, paddingTop: 16 },
  chiffres: {
    flexDirection: "row", marginHorizontal: 16, backgroundColor: couleurs.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  case: { flex: 1, alignItems: "center", paddingVertical: 16 },
  chiffre: { fontFamily: polices.titre, fontSize: 26, color: couleurs.texte },
  legende: { marginTop: 2, fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.14), color: couleurs.texteDiscret },

  cadre: {
    marginHorizontal: 16, paddingVertical: 14, backgroundColor: couleurs.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure, gap: 10,
  },
  cadreTitre: { paddingHorizontal: 16, fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: couleurs.texteDiscret },
  vide: { paddingHorizontal: 16, fontFamily: polices.texte, fontSize: 13, color: couleurs.texteSecondaire },
  forme: { gap: 12 },
  niveau: { paddingHorizontal: 16, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  notes: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  note: { width: 56, alignItems: "center", gap: 4 },
  noteAdversaire: { fontFamily: polices.texteGras, fontSize: 9, color: couleurs.texteDiscret },

  equipe: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  presse: { backgroundColor: couleurs.surfaceHaute },
  flexible: { flex: 1, minWidth: 0 },
  equipeNom: { fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  equipeBilan: { marginTop: 2, fontFamily: polices.texteGras, fontSize: 11, color: couleurs.texteDiscret },

  infos: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, rowGap: 12 },
  info: { width: "33%" },
  infoLabel: { fontFamily: polices.texteNoir, fontSize: 9, letterSpacing: espacement(9, 0.14), color: couleurs.texteDiscret },
  infoValeur: { marginTop: 2, fontFamily: polices.texteGras, fontSize: 14, color: couleurs.texte },
  bio: { paddingHorizontal: 16, fontFamily: polices.texte, fontSize: 14, lineHeight: 21, color: couleurs.texteSecondaire },
  galerie: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 16 },
  photo: { width: "32%", aspectRatio: 1 },
}));
