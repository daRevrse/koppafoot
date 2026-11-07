import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, View,
  type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent,
} from "react-native";
import { accorder } from "@/lib/genre";
import { CarteDuRole } from "~/components/evolution/CarteDuRole";
import { DosDeLaCarte } from "~/components/evolution/DosDeLaCarte";
import { useMouvementReduit } from "~/hooks/useMouvementReduit";
import { useAuth } from "~/lib/auth";
import {
  apresGlisse, ecartALaCarte, estUnGlisseHorizontal, indexInitial, PRESENTATION, prendreLeRoleVise, retenirLeRoleVise, voisins,
} from "~/lib/pile-des-roles";
import { retourSelection } from "~/lib/retour";
import { nomDuRole, ROLES } from "~/lib/roles";
import { creerStyles, espacement, palettes, polices, useCouleurs } from "~/theme";

const N = ROLES.length;
/**
 * Les voisines : plus petites, voilées de la couleur du fond, à 62 % d'une
 * largeur de carte du centre. Un voile et non une transparence : une carte
 * transparente laisserait voir celle qui passe dessous.
 */
const ECHELLE_VOISINE = 0.86;
const DECALAGE_VOISINE = 0.62;
const VOILE_VOISINE = 0.45;
/**
 * Le ressort qui pose la carte : amorti au plus juste (le seuil critique est
 * 2√(raideur × masse) ≈ 31), donc vif, sans rebond, et qui garde l'élan du doigt.
 */
const RESSORT = { stiffness: 240, damping: 31, mass: 1 };
const NATIF = Platform.OS !== "web";
/** Ce qu'un lecteur d'écran ne voit pas : les cartes voisines, décoratives. */
const CACHEE = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants", "aria-hidden": true } as const;

const modulo = (k: number) => ((k % N) + N) % N;

/** L'ordre des cartes, de dessus en dessous : la plus proche du centre devant. */
function ordreDesCartes(position: number): number[] {
  const z = new Array<number>(N);
  ROLES.map((_r, i) => i)
    .sort((a, b) => Math.abs(ecartALaCarte(a, position, N)) - Math.abs(ecartALaCarte(b, position, N)))
    .forEach((i, rang) => {
      z[i] = N - rang;
    });
  return z;
}

/**
 * L'onglet Évolution d'un compte sans rôle : « Quel rôle veux-tu jouer ? »,
 * puis un carrousel de cartes — joueur, manager, arbitre —, chacune avec
 * l'affiche et les couleurs de son rôle. Toutes les cartes suivent une même
 * position : le doigt la tire, et la carte de devant, ses voisines et celle
 * qui passe de l'autre côté bougent ensemble ; lâchée, un ressort la pose en
 * gardant l'élan du doigt. Les flèches font le même mouvement. « Devenir … »
 * retourne la carte sur le formulaire d'activation (DosDeLaCarte). Sans
 * compte, on feuillette, et « Devenir … » mène à la connexion : la pile se
 * rouvre ensuite sur ce rôle.
 */
export function ChoixDuRole() {
  const styles = useStyles();
  const couleurs = useCouleurs();
  const router = useRouter();
  const { utilisateur, profil } = useAuth();
  const mouvementReduit = useMouvementReduit();
  // La carte de devant : elle change dès que le doigt se lève, ou dès la flèche.
  const [index, setIndex] = useState(() => indexInitial(prendreLeRoleVise()));
  // La position du carrousel, un réel non borné qui suit le doigt ; `cible`,
  // l'entier où elle va se poser.
  const [position] = useState(() => new Animated.Value(index));
  const cible = useRef(index);
  // Les cartes se recouvrent : la plus proche du centre passe au-dessus.
  const [ordre, setOrdre] = useState(() => ordreDesCartes(index));
  const [retournee, setRetournee] = useState(false);
  // Le dos reste monté après « Retour » : la carte se remet à l'endroit sans
  // se vider, et les champs gardent ce qu'on y a tapé.
  const [dosVu, setDosVu] = useState(false);
  const [zone, setZone] = useState({ largeur: 0, hauteur: 0 });
  const anime = useRef(false);
  const depart = useRef({ x: 0, y: 0 });
  const dernier = useRef({ dx: 0, t: 0, vx: 0 });

  const meta = ROLES[index];
  const presentation = PRESENTATION[meta.role];
  const clair = couleurs === palettes.clair;
  const accent = clair ? presentation.couleurs.accentClair : presentation.couleurs.accentSombre;
  const { precedent, suivant } = voisins(index, N);

  // La carte la plus grande qui tienne : 3:4, les voisines dépassant sur les côtés.
  const largeurCarte = Math.min(zone.largeur * 0.74, zone.hauteur * 0.75);
  const hauteurCarte = largeurCarte / 0.75;
  /** Ce qui sépare deux cartes : le chemin du doigt pour passer de l'une à l'autre. */
  const pas = DECALAGE_VOISINE * largeurCarte;

  useEffect(() => {
    const id = position.addListener(({ value }) => {
      const z = ordreDesCartes(value);
      setOrdre((avant) => (avant.every((v, i) => v === z[i]) ? avant : z));
    });
    return () => position.removeListener(id);
  }, [position]);

  // La place, la taille et le voile de chaque carte, tirés de la même position
  // (lib/pile-des-roles, ecartALaCarte). Au-delà d'une place, la carte
  // s'efface — elle est alors dessous —, et c'est hors de vue qu'elle passe
  // de l'autre côté.
  const mouvements = useMemo(
    () =>
      ROLES.map((_r, i) => {
        const ecart = Animated.add(Animated.modulo(Animated.add(Animated.multiply(position, -1), i + N / 2), N), -N / 2);
        return {
          translateX: Animated.multiply(ecart, pas),
          scale: ecart.interpolate({ inputRange: [-1.5, -1, 0, 1, 1.5], outputRange: [0.8, ECHELLE_VOISINE, 1, ECHELLE_VOISINE, 0.8] }),
          opacity: ecart.interpolate({ inputRange: [-1.5, -1, 1, 1.5], outputRange: [0, 1, 1, 0] }),
          voile: ecart.interpolate({ inputRange: [-1, 0, 1], outputRange: [VOILE_VOISINE, 0, VOILE_VOISINE], extrapolate: "clamp" }),
        };
      }),
    [position, pas],
  );

  /** Pose le carrousel sur `cible`, avec l'élan `vitesse` (en places par seconde). */
  function poser(vitesse = 0) {
    if (mouvementReduit) {
      position.setValue(cible.current);
      return;
    }
    anime.current = true;
    Animated.spring(position, { toValue: cible.current, velocity: vitesse, ...RESSORT, useNativeDriver: NATIF }).start(() => {
      anime.current = false;
    });
  }

  /** Une carte plus loin (`sens` 1) ou plus près (-1). */
  function tourner(sens: 1 | -1, vitesse = 0) {
    retourSelection();
    cible.current += sens;
    setIndex(modulo(cible.current));
    setDosVu(false);
    poser(vitesse);
  }

  function suivante() {
    if (anime.current || retournee) return;
    tourner(1);
  }

  function precedente() {
    if (anime.current || retournee) return;
    tourner(-1);
  }

  // Le glissé : tout le carrousel suit le doigt, puis le ressort pose la carte
  // la plus proche, élan compris. Un geste vertical n'est jamais pris, et la
  // carte retournée ne se feuillette pas.
  const ecart = (e: GestureResponderEvent) => ({
    dx: e.nativeEvent.pageX - depart.current.x,
    dy: e.nativeEvent.pageY - depart.current.y,
  });
  const glisse = {
    // Appelé au début de tout geste, au doigt comme à la souris : on note d'où
    // il part, sans prendre la main (un toucher reste un toucher).
    onStartShouldSetResponder: (e: GestureResponderEvent) => {
      depart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
      dernier.current = { dx: 0, t: e.nativeEvent.timestamp, vx: 0 };
      return false;
    },
    onMoveShouldSetResponder: (e: GestureResponderEvent) => {
      if (retournee || anime.current || pas <= 0) return false;
      const { dx, dy } = ecart(e);
      return estUnGlisseHorizontal(dx, dy);
    },
    onResponderTerminationRequest: () => false,
    onResponderMove: (e: GestureResponderEvent) => {
      const { dx } = ecart(e);
      const t = e.nativeEvent.timestamp;
      const precedentGeste = dernier.current;
      const dt = t - precedentGeste.t;
      dernier.current = { dx, t, vx: dt > 0 ? (dx - precedentGeste.dx) / dt : precedentGeste.vx };
      if (pas > 0) position.setValue(cible.current - dx / pas);
    },
    onResponderRelease: (e: GestureResponderEvent) => {
      const { dx } = ecart(e);
      const vx = dernier.current.vx;
      const vers = apresGlisse(index, dx, N, vx);
      // L'élan du doigt, en places par seconde : un doigt vers la gauche fait avancer.
      const vitesse = pas > 0 ? (-vx * 1000) / pas : 0;
      if (vers === suivant) tourner(1, vitesse);
      else if (vers === precedent) tourner(-1, vitesse);
      else poser(vitesse);
    },
    onResponderTerminate: () => poser(),
  };

  function devenir() {
    // Tant que le carrousel bouge, la carte de devant n'est pas en place :
    // la retourner maintenant la ferait tourner de travers.
    if (anime.current) return;
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
  const placeCarte = {
    left: (zone.largeur - largeurCarte) / 2, top: (zone.hauteur - hauteurCarte) / 2, width: largeurCarte, height: hauteurCarte,
  };

  return (
    <View style={styles.ecran}>
      <Text style={styles.question} accessibilityRole="header">QUEL RÔLE VEUX-TU JOUER ?</Text>

      <View
        style={styles.zone}
        onLayout={(e: LayoutChangeEvent) => setZone({ largeur: e.nativeEvent.layout.width, hauteur: e.nativeEvent.layout.height })}
      >
        <View
          style={StyleSheet.absoluteFill}
          {...(retournee ? {} : glisse)}
          accessible={!retournee}
          accessibilityRole={retournee ? undefined : "adjustable"}
          accessibilityLabel={retournee ? undefined : `Rôle : ${nomDuRole(meta.titre, profil?.gender)}`}
          accessibilityValue={retournee ? undefined : { text: `${index + 1} sur ${N}` }}
          accessibilityActions={retournee ? undefined : [{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={actionAccessible}
        >
          {ROLES.map((r, i) => {
              const devant = i === index;
              const m = mouvements[i];
              const style = retournee
                ? devant ? styles.carteRetournee : styles.carteEffacee
                : [styles.carte, placeCarte, { zIndex: ordre[i], opacity: m.opacity, transform: [{ translateX: m.translateX }, { scale: m.scale }] }];
              return (
                <Animated.View key={r.role} style={style} {...(devant ? {} : CACHEE)}>
                  <CarteDuRole
                    role={r.role}
                    retournee={devant && retournee}
                    mouvementReduit={mouvementReduit}
                    dos={devant && dosVu ? <DosDeLaCarte role={r.role} onRetour={remettre} /> : null}
                  />
                  {retournee ? null : (
                    <Animated.View style={[styles.voile, { backgroundColor: couleurs.fond, opacity: m.voile }]} />
                  )}
                </Animated.View>
              );
            })}
        </View>

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
  zone: { flex: 1, minHeight: 220, overflow: "hidden" },
  carte: { position: "absolute" },
  carteRetournee: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 2 },
  voile: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, borderRadius: 12, pointerEvents: "none" },
  carteEffacee: { position: "absolute", top: 0, left: 0, width: 0, height: 0, opacity: 0 },
  fleche: {
    position: "absolute", top: "50%", marginTop: -20, zIndex: 3, width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
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
