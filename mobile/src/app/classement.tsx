import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { LayoutAnimation, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MATCHS_NOTES_CLASSEMENT, type LigneJoueurPubliee, type TriClassement } from "@/lib/classement";
import { Bouton } from "~/components/Bouton";
import { LigneDeClassement } from "~/components/classement/LigneDeClassement";
import { SqueletteDirect } from "~/components/direct/SqueletteDirect";
import { EnTetePage } from "~/components/EnTetePage";
import { EtatVide } from "~/components/EtatVide";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";
import { useAuth } from "~/lib/auth";
import {
  chargerClassement, messageVide, pageDuClassement, triDOuverture, type FiltreClassement,
} from "~/lib/classement-joueurs";
import { retourSelection } from "~/lib/retour";
import { creerStyles, espacement, polices, useCouleurs } from "~/theme";

const TRIS: { cle: TriClassement; libelle: string }[] = [
  { cle: "note", libelle: "Note" },
  { cle: "contribution", libelle: "Buts + passes" },
];

const FILTRES: { cle: FiltreClassement; libelle: string }[] = [
  { cle: "tous", libelle: "Tous" },
  { cle: "joueurs", libelle: "Joueurs" },
  { cle: "gardiens", libelle: "Gardiens" },
];

/**
 * Le classement des joueurs (/top-players du site), ouvert depuis les filtres
 * du Direct : cent joueurs, gardiens compris, sur leurs cinq derniers matchs.
 * Le tri (la note, ou les buts et passes), le filtre, puis dix lignes par
 * page avec deux flèches, comme le site : cent lignes demanderaient huit
 * écrans de défilement.
 */
export default function EcranClassement() {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur } = useAuth();
  const mouvementReduit = useMouvementReduit();
  const defilement = useRef<ScrollView>(null);
  const [joueurs, setJoueurs] = useState<LigneJoueurPubliee[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [recharge, setRecharge] = useState(false);
  // Null : le tri d'ouverture, décidé une fois le classement lu.
  const [tri, setTri] = useState<TriClassement | null>(null);
  const [filtre, setFiltre] = useState<FiltreClassement>("tous");
  const [page, setPage] = useState(0);
  const [methode, setMethode] = useState(false);

  const lire = useCallback(async () => {
    try {
      setJoueurs(await chargerClassement());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, []);
  useEffect(() => {
    let vivant = true;
    chargerClassement()
      .then((j) => {
        if (vivant) setJoueurs(j);
      })
      .catch(() => {
        if (vivant) setErreur(true);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const triMontre = tri ?? (joueurs ? triDOuverture(joueurs) : "note");
  const selection = joueurs ? pageDuClassement(joueurs, triMontre, filtre, page) : null;

  function changer(maj: () => void) {
    retourSelection();
    if (!mouvementReduit) LayoutAnimation.configureNext(LayoutAnimation.create(150, "easeInEaseOut", "opacity"));
    maj();
  }

  function allerA(n: number) {
    changer(() => setPage(n));
    defilement.current?.scrollTo({ y: 0, animated: !mouvementReduit });
  }

  let liste;
  if (!joueurs || !selection) {
    liste = erreur ? (
      <EtatVide icone="cloud-offline-outline" texte="Le classement ne se charge pas. Vérifie ta connexion.">
        <Bouton titre="Réessayer" variante="contour" onPress={() => void lire()} />
      </EtatVide>
    ) : (
      <SqueletteDirect />
    );
  } else if (selection.total === 0) {
    const [ligne1, ligne2] = messageVide(joueurs.length, triMontre);
    liste = (
      <View style={styles.cadre}>
        <Text style={styles.vide}>{`${ligne1}\n${ligne2}`}</Text>
      </View>
    );
  } else {
    liste = (
      <View style={styles.cadre}>
        {selection.lignes.map((l, i) => (
          <LigneDeClassement
            key={l.cle}
            ligne={l}
            tri={triMontre}
            premiere={i === 0}
            toi={!!l.uid && l.uid === utilisateur?.uid}
            onPress={l.uid ? () => router.push({ pathname: "/joueur/[uid]", params: { uid: l.uid as string } }) : undefined}
          />
        ))}
        {selection.pages > 1 ? (
          <View style={styles.pages}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: selection.page === 0 }}
              disabled={selection.page === 0}
              onPress={() => allerA(selection.page - 1)}
              hitSlop={6}
              style={({ pressed }) => [styles.fleche, selection.page === 0 && styles.eteinte, pressed && styles.presse]}
            >
              <Ionicons name="chevron-back" size={14} color={couleurs.texteSecondaire} />
              <Text style={styles.flecheTexte}>Précédent</Text>
            </Pressable>
            <Text style={styles.compteur}>
              {`${selection.premier}–${selection.dernier}`}
              <Text style={styles.compteurTotal}>{` sur ${selection.total}`}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: selection.page >= selection.pages - 1 }}
              disabled={selection.page >= selection.pages - 1}
              onPress={() => allerA(selection.page + 1)}
              hitSlop={6}
              style={({ pressed }) => [styles.fleche, selection.page >= selection.pages - 1 && styles.eteinte, pressed && styles.presse]}
            >
              <Text style={styles.flecheTexte}>Suivant</Text>
              <Ionicons name="chevron-forward" size={14} color={couleurs.texteSecondaire} />
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.ecran} edges={["top"]}>
      <EnTetePage
        titre="Classement"
        action={
          <View style={styles.actions}>
            <Text style={styles.fenetre}>5 DERNIERS MATCHS</Text>
            {/* Le mode de calcul se demande, il ne s'impose pas : on le
                consulte une fois, pas à chaque visite. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Comment ce classement est calculé"
              accessibilityState={{ expanded: methode }}
              onPress={() => changer(() => setMethode((v) => !v))}
              hitSlop={6}
              style={({ pressed }) => [styles.info, methode && styles.infoOuverte, pressed && !methode && styles.presse]}
            >
              <Ionicons name="information" size={18} color={methode ? couleurs.surBouton : couleurs.texteSecondaire} />
            </Pressable>
          </View>
        }
      />
      <ScrollView
        ref={defilement}
        contentContainerStyle={styles.contenu}
        refreshControl={
          <RefreshControl
            refreshing={recharge}
            onRefresh={async () => {
              setRecharge(true);
              await lire();
              setRecharge(false);
            }}
            tintColor={couleurs.primaire}
            colors={[couleurs.primaire]}
            progressBackgroundColor={couleurs.surface}
          />
        }
      >
        {methode ? (
          <View style={styles.methode}>
            <Text style={styles.methodeTexte}>
              {"Tout le monde est classé sur sa "}
              <Text style={styles.gras}>note moyenne</Text>
              {" des cinq derniers matchs, celle que la console calcule pendant le direct. Les plus récents comptent davantage : c'est le même chiffre que l'état de forme du joueur."}
            </Text>
            <Text style={styles.methodeTexte}>
              {"Un "}
              <Text style={styles.gras}>joueur de champ</Text>
              {" est noté sur ses buts, ses passes décisives et ses tirs, et perd des points sur ses fautes et ses cartons. Un "}
              <Text style={styles.gras}>gardien</Text>
              {" gagne des points sur ses arrêts et quand il ne prend pas de but, et en perd sur chaque but encaissé."}
            </Text>
            <Text style={styles.methodeTexte}>
              {`Il faut ${MATCHS_NOTES_CLASSEMENT} matchs notés pour être classé : une entrée en jeu trop courte n'est pas notée. Le tri « Buts + passes » compte, lui, toutes les contributions, dès le premier but. Compétitions locales et matchs amicaux confondus.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.reglages}>
          <View style={styles.bascule} accessibilityRole="radiogroup" accessibilityLabel="Trier par">
            {TRIS.map((t, i) => {
              const actif = t.cle === triMontre;
              return (
                <Pressable
                  key={t.cle}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: actif }}
                  onPress={() => {
                    if (!actif) changer(() => { setTri(t.cle); setPage(0); });
                  }}
                  style={[styles.choix, i > 0 && styles.choixSuivant, actif && styles.choixActif]}
                >
                  <Text style={[styles.choixTexte, actif && styles.choixTexteActif]}>{t.libelle.toUpperCase()}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.filtres} accessibilityRole="tablist" accessibilityLabel="Afficher">
            {FILTRES.map((f) => {
              const actif = f.cle === filtre;
              return (
                <Pressable
                  key={f.cle}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: actif }}
                  onPress={() => {
                    if (!actif) changer(() => { setFiltre(f.cle); setPage(0); });
                  }}
                  style={[styles.puce, actif && styles.puceActive]}
                >
                  <Text style={[styles.puceTexte, actif && styles.puceTexteActive]}>{f.libelle}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {liste}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, backgroundColor: couleurs.fond },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  // La seule réserve qui compte, toujours en vue : la fenêtre de cinq matchs.
  fenetre: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden", backgroundColor: couleurs.accentVoile,
    fontFamily: polices.texteNoir, fontSize: 10, letterSpacing: espacement(10, 0.06), color: couleurs.accent,
  },
  info: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: couleurs.bordure,
    alignItems: "center", justifyContent: "center",
  },
  infoOuverte: { backgroundColor: couleurs.bouton, borderColor: couleurs.bouton },
  presse: { backgroundColor: couleurs.surfaceHaute },
  contenu: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32, gap: 12 },
  methode: {
    gap: 8, padding: 12, backgroundColor: couleurs.surfaceHaute,
    borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure,
  },
  methodeTexte: { fontFamily: polices.texte, fontSize: 12, lineHeight: 18, color: couleurs.texteSecondaire },
  gras: { fontFamily: polices.texteNoir, color: couleurs.texte },
  // Le tri, puis le filtre : deux réglages, deux formes.
  reglages: { gap: 10 },
  bascule: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordureForte },
  choix: { flex: 1, alignItems: "center", paddingVertical: 9 },
  choixSuivant: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: couleurs.bordureForte },
  choixActif: { backgroundColor: couleurs.bouton },
  choixTexte: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.08), color: couleurs.texteDiscret },
  choixTexteActif: { color: couleurs.surBouton },
  filtres: { flexDirection: "row", gap: 6 },
  puce: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: couleurs.surfaceHaute },
  puceActive: { backgroundColor: couleurs.primaireVoile },
  puceTexte: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteSecondaire },
  puceTexteActive: { color: couleurs.primaire },
  cadre: { backgroundColor: couleurs.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: couleurs.bordure },
  vide: {
    paddingHorizontal: 16, paddingVertical: 48, textAlign: "center",
    fontFamily: polices.texteGras, fontSize: 12, lineHeight: 19, color: couleurs.texteDiscret,
  },
  pages: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: couleurs.bordure,
  },
  fleche: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 999 },
  eteinte: { opacity: 0.3 },
  flecheTexte: { fontFamily: polices.texteNoir, fontSize: 11, color: couleurs.texteSecondaire },
  compteur: { fontFamily: polices.texteNoir, fontSize: 11, fontVariant: ["tabular-nums"], color: couleurs.texteSecondaire },
  compteurTotal: { color: couleurs.texteDiscret },
}));
