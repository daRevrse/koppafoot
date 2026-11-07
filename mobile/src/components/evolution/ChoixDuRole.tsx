import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  Animated, Easing, LayoutAnimation, Platform, Pressable, Text, View,
  type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent,
} from "react-native";
import { accorder } from "@/lib/genre";
import { AFFICHES } from "~/components/evolution/affiches";
import { CarteDuRole } from "~/components/evolution/CarteDuRole";
import { DosDeLaCarte } from "~/components/evolution/DosDeLaCarte";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";
import { useAuth } from "~/lib/auth";
import {
  apresGlisse, estUnGlisseHorizontal, indexInitial, PRESENTATION, prendreLeRoleVise, retenirLeRoleVise, voisins,
} from "~/lib/pile-des-roles";
import { retourSelection } from "~/lib/retour";
import { nomDuRole, ROLES } from "~/lib/roles";
import { creerStyles, espacement, palettes, polices, useCouleurs } from "~/theme";

const N = ROLES.length;
/** La carte des voisines : plus petite, décalée, estompée, derrière. */
const ECHELLE_VOISINE = 0.86;
const DECALAGE_VOISINE = 0.62;
const OPACITE_VOISINE = 0.55;
const DUREE = 250;
const NATIF = Platform.OS !== "web";
/** Ce qu'un lecteur d'écran ne voit pas : les cartes voisines, décoratives. */
const CACHEE = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", "aria-hidden": true } as const;

/**
 * L'onglet Évolution d'un compte sans rôle : « Quel rôle veux-tu jouer ? »,
 * puis une pile de cartes à feuilleter — joueur, manager, arbitre —, chacune
 * avec l'affiche et les couleurs de son rôle. On change de carte en la
 * faisant glisser ou avec les flèches ; « Devenir … » retourne la carte sur
 * le formulaire d'activation (DosDeLaCarte). Sans compte, on feuillette, et
 * « Devenir … » mène à la connexion : la pile se rouvre ensuite sur ce rôle.
 */
export function ChoixDuRole() {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const mouvementReduit = useMouvementReduit();
  const [index, setIndex] = useState(() => indexInitial(prendreLeRoleVise()));
  const [retournee, setRetournee] = useState(false);
  // Le dos reste monté après « Retour » : la carte se remet à l'endroit sans
  // se vider, et les champs gardent ce qu'on y a tapé.
  const [dosVu, setDosVu] = useState(false);
  const [zone, setZone] = useState({ largeur: 0, hauteur: 0 });
  const [decalage] = useState(() => new Animated.Value(0));
  const [avance] = useState(() => new Animated.Value(1));
  const anime = useRef(false);

  const meta = ROLES[index];
  const presentation = PRESENTATION[meta.role];
  const clair = couleurs === palettes.clair;
  const accent = clair ? presentation.couleurs.accentClair : presentation.couleurs.accentSombre;
  const { precedent, suivant } = voisins(index, N);

  // La carte la plus grande qui tienne : 3:4, les voisines dépassant sur les côtés.
  const largeurCarte = Math.min(zone.largeur * 0.64, zone.hauteur * 0.75);
  const hauteurCarte = largeurCarte / 0.75;

  /** La carte `vers` vient devant, depuis la place de sa voisine. */
  function amener(vers: number, sens: 1 | -1) {
    if (vers === index) return;
    retourSelection();
    setIndex(vers);
    setDosVu(false);
    if (mouvementReduit) {
      decalage.setValue(0);
      avance.setValue(1);
      return;
    }
    anime.current = true;
    decalage.setValue(sens * DECALAGE_VOISINE * largeurCarte);
    avance.setValue(0);
    Animated.parallel([
      Animated.timing(decalage, { toValue: 0, duration: DUREE, easing: Easing.out(Easing.cubic), useNativeDriver: NATIF }),
      Animated.timing(avance, { toValue: 1, duration: DUREE, easing: Easing.out(Easing.cubic), useNativeDriver: NATIF }),
    ]).start(() => {
      anime.current = false;
    });
  }

  function suivante() {
    if (anime.current || retournee) return;
    amener(suivant, 1);
  }

  function precedente() {
    if (anime.current || retournee) return;
    amener(precedent, -1);
  }

  // Le glissé : la carte suit le doigt, puis sort (vers la gauche, la suivante)
  // et la suivante vient devant. Un geste vertical n'est jamais pris, et la
  // carte retournée ne se feuillette pas.
  const depart = useRef({ x: 0, y: 0 });
  const ecart = (e: GestureResponderEvent) => ({
    dx: e.nativeEvent.pageX - depart.current.x,
    dy: e.nativeEvent.pageY - depart.current.y,
  });
  const remettreEnPlace = () => Animated.timing(decalage, { toValue: 0, duration: 150, useNativeDriver: NATIF }).start();
  const glisse = {
    onTouchStart: (e: GestureResponderEvent) => {
      depart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    },
    onMoveShouldSetResponder: (e: GestureResponderEvent) => {
      if (retournee || anime.current) return false;
      const { dx, dy } = ecart(e);
      return estUnGlisseHorizontal(dx, dy);
    },
    onResponderMove: (e: GestureResponderEvent) => decalage.setValue(ecart(e).dx),
    onResponderRelease: (e: GestureResponderEvent) => {
      const { dx } = ecart(e);
      const vers = apresGlisse(index, dx, N);
      if (vers === index) {
        remettreEnPlace();
        return;
      }
      const sens = dx < 0 ? 1 : -1;
      if (mouvementReduit) {
        amener(vers, sens);
        return;
      }
      anime.current = true;
      Animated.timing(decalage, { toValue: -sens * largeurCarte * 1.1, duration: DUREE, useNativeDriver: NATIF }).start(() => {
        anime.current = false;
        amener(vers, sens);
      });
    },
    onResponderTerminate: remettreEnPlace,
  };

  function devenir() {
    if (!utilisateur) {
      retenirLeRoleVise(meta.role);
      router.push({ pathname: "/connexion", params: { raison: "role" } });
      return;
    }
    retourSelection();
    if (!mouvementReduit) LayoutAnimation.configureNext(LayoutAnimation.create(300, "easeInEaseOut", "opacity"));
    setDosVu(true);
    setRetournee(true);
  }

  function remettre() {
    if (!mouvementReduit) LayoutAnimation.configureNext(LayoutAnimation.create(300, "easeInEaseOut", "opacity"));
    setRetournee(false);
  }

  function actionAccessible(e: AccessibilityActionEvent) {
    if (e.nativeEvent.actionName === "increment") suivante();
    else if (e.nativeEvent.actionName === "decrement") precedente();
  }

  const titre = accorder(profil?.gender ?? null, meta.titre[0], meta.titre[1]);

  function voisine(i: number, sens: 1 | -1) {
    const role = ROLES[i].role;
    return (
      <View
        key={`voisine-${sens}`}
        style={[
          styles.voisine,
          {
            width: largeurCarte, height: hauteurCarte, opacity: OPACITE_VOISINE, borderColor: PRESENTATION[role].couleurs.accentSombre,
            backgroundColor: PRESENTATION[role].couleurs.carte,
            transform: [{ translateX: sens * DECALAGE_VOISINE * largeurCarte }, { scale: ECHELLE_VOISINE }],
          },
        ]}
        {...CACHEE}
      >
        <Image source={AFFICHES[role]} style={styles.afficheVoisine} contentFit="cover" />
      </View>
    );
  }

  return (
    <View style={styles.ecran}>
      <Text style={styles.question} accessibilityRole="header">QUEL RÔLE VEUX-TU JOUER ?</Text>

      <View
        style={styles.zone}
        onLayout={(e: LayoutChangeEvent) => setZone({ largeur: e.nativeEvent.layout.width, hauteur: e.nativeEvent.layout.height })}
      >
        {!retournee && largeurCarte > 0 ? [voisine(precedent, -1), voisine(suivant, 1)] : null}

        <Animated.View
          {...(retournee ? {} : glisse)}
          accessible={!retournee}
          accessibilityRole={retournee ? undefined : "adjustable"}
          accessibilityLabel={retournee ? undefined : `Rôle : ${nomDuRole(meta.titre, profil?.gender)}`}
          accessibilityValue={retournee ? undefined : { text: `${index + 1} sur ${N}` }}
          accessibilityActions={retournee ? undefined : [{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={actionAccessible}
          style={[
            retournee
              ? styles.carteRetournee
              : {
                width: largeurCarte, height: hauteurCarte,
                opacity: avance.interpolate({ inputRange: [0, 1], outputRange: [OPACITE_VOISINE, 1] }),
                transform: [
                  { translateX: decalage },
                  { scale: avance.interpolate({ inputRange: [0, 1], outputRange: [ECHELLE_VOISINE, 1] }) },
                ],
              },
          ]}
        >
          <CarteDuRole
            role={meta.role}
            retournee={retournee}
            mouvementReduit={mouvementReduit}
            dos={dosVu ? <DosDeLaCarte role={meta.role} onRetour={remettre} /> : null}
          />
        </Animated.View>

        {!retournee ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rôle précédent"
              aria-label="Rôle précédent"
              onPress={precedente}
              hitSlop={8}
              style={({ pressed }) => [styles.fleche, styles.flecheGauche, pressed && styles.presse]}
            >
              <Ionicons name="chevron-back" size={20} color={couleurs.texte} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Rôle suivant"
              aria-label="Rôle suivant"
              onPress={suivante}
              hitSlop={8}
              style={({ pressed }) => [styles.fleche, styles.flecheDroite, pressed && styles.presse]}
            >
              <Ionicons name="chevron-forward" size={20} color={couleurs.texte} />
            </Pressable>
          </>
        ) : null}
      </View>

      {!retournee ? (
        <View style={styles.bas}>
          <View style={styles.points} {...CACHEE}>
            {ROLES.map((r, i) => (
              <View key={r.role} style={[styles.point, i === index && { backgroundColor: accent, width: 18 }]} />
            ))}
          </View>
          <Text style={[styles.accroche, { color: accent }]}>{presentation.accroche.toUpperCase()}</Text>
          <Text style={styles.nom}>{nomDuRole(meta.titre, profil?.gender).toUpperCase()}</Text>
          <Text style={styles.phrase}>{meta.phrase}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Devenir ${titre.toLowerCase()}`}
            aria-label={`Devenir ${titre.toLowerCase()}`}
            onPress={devenir}
            style={({ pressed }) => [styles.devenir, { backgroundColor: presentation.couleurs.bouton }, pressed && styles.devenirPresse]}
          >
            <Text style={styles.devenirTexte}>{`Devenir ${titre}`.toUpperCase()}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = creerStyles((couleurs) => ({
  ecran: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  question: { paddingTop: 4, paddingBottom: 12, fontFamily: polices.titre, fontSize: 22, color: couleurs.texte },
  zone: { flex: 1, minHeight: 220, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  voisine: { position: "absolute", borderRadius: 12, borderWidth: 2, overflow: "hidden" },
  afficheVoisine: { flex: 1 },
  carteRetournee: { alignSelf: "stretch", flex: 1 },
  fleche: {
    position: "absolute", width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    backgroundColor: couleurs.surface, borderWidth: 1, borderColor: couleurs.bordure,
  },
  flecheGauche: { left: 0 },
  flecheDroite: { right: 0 },
  presse: { backgroundColor: couleurs.surfaceHaute },
  bas: { alignItems: "center", gap: 6, paddingTop: 14 },
  points: { flexDirection: "row", gap: 6, marginBottom: 6 },
  point: { width: 6, height: 6, borderRadius: 3, backgroundColor: couleurs.bordureForte },
  accroche: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11, 0.14), textAlign: "center" },
  nom: { fontFamily: polices.titre, fontSize: 28, lineHeight: 32, color: couleurs.texte, textAlign: "center" },
  phrase: { fontFamily: polices.texte, fontSize: 14, color: couleurs.texteSecondaire, textAlign: "center", marginBottom: 8 },
  devenir: { alignSelf: "stretch", paddingVertical: 14, alignItems: "center" },
  devenirPresse: { opacity: 0.85 },
  devenirTexte: { fontFamily: polices.texteNoir, fontSize: 11, letterSpacing: espacement(11), color: "#FFFFFF" },
}));
